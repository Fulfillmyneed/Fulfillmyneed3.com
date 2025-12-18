const axios = require('axios');
const crypto = require('crypto');

class MPesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.shortCode = process.env.MPESA_SHORTCODE;
    this.passkey = process.env.MPESA_PASSKEY;
    this.environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
    
    this.baseUrl = this.environment === 'production' 
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
    
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Get access token
  async getAccessToken() {
    // Check if token is still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      
      const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          Authorization: `Basic ${auth}`
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Subtract 1 minute for safety
      
      return this.accessToken;
    } catch (error) {
      console.error('Error getting MPesa access token:', error.response?.data || error.message);
      throw new Error('Failed to get MPesa access token');
    }
  }

  // Generate password for STK push
  generatePassword() {
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(`${this.shortCode}${this.passkey}${timestamp}`).toString('base64');
    return { password, timestamp };
  }

  // Initiate STK push (Lip Na M-Pesa Online)
  async initiateSTKPush(phoneNumber, amount, accountReference, transactionDesc) {
    try {
      const token = await this.getAccessToken();
      const { password, timestamp } = this.generatePassword();

      // Format phone number (remove leading 0 and add country code)
      const formattedPhone = phoneNumber.replace(/^0/, '254');

      const payload = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: formattedPhone,
        PartyB: this.shortCode,
        PhoneNumber: formattedPhone,
        CallBackURL: `${process.env.SERVER_URL}/api/v1/mpesa/callback`,
        AccountReference: accountReference,
        TransactionDesc: transactionDesc
      };

      const response = await axios.post(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.ResponseCode === '0') {
        return {
          success: true,
          checkoutRequestID: response.data.CheckoutRequestID,
          customerMessage: response.data.CustomerMessage,
          response: response.data
        };
      } else {
        return {
          success: false,
          error: response.data.ResponseDescription || 'STK push failed',
          response: response.data
        };
      }
    } catch (error) {
      console.error('Error initiating STK push:', error.response?.data || error.message);
      throw new Error('Failed to initiate M-Pesa payment');
    }
  }

  // Check STK push status
  async checkSTKPushStatus(checkoutRequestID) {
    try {
      const token = await this.getAccessToken();
      const { password, timestamp } = this.generatePassword();

      const payload = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestID
      };

      const response = await axios.post(`${this.baseUrl}/mpesa/stkpushquery/v1/query`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: response.data.ResponseCode === '0',
        resultCode: response.data.ResultCode,
        resultDesc: response.data.ResultDesc,
        response: response.data
      };
    } catch (error) {
      console.error('Error checking STK push status:', error.response?.data || error.message);
      throw new Error('Failed to check M-Pesa payment status');
    }
  }

  // Process callback from M-Pesa
  processCallback(data) {
    try {
      const callbackData = data.Body.stkCallback;
      
      if (callbackData.ResultCode === 0) {
        // Payment successful
        const metadata = callbackData.CallbackMetadata?.Item || [];
        const metadataObj = {};
        
        metadata.forEach(item => {
          metadataObj[item.Name] = item.Value;
        });

        return {
          success: true,
          checkoutRequestID: callbackData.CheckoutRequestID,
          merchantRequestID: callbackData.MerchantRequestID,
          amount: metadataObj.Amount,
          mpesaReceiptNumber: metadataObj.MpesaReceiptNumber,
          phoneNumber: metadataObj.PhoneNumber,
          transactionDate: metadataObj.TransactionDate,
          rawData: data
        };
      } else {
        // Payment failed
        return {
          success: false,
          error: callbackData.ResultDesc,
          checkoutRequestID: callbackData.CheckoutRequestID,
          merchantRequestID: callbackData.MerchantRequestID,
          rawData: data
        };
      }
    } catch (error) {
      console.error('Error processing M-Pesa callback:', error);
      throw new Error('Failed to process M-Pesa callback');
    }
  }

  // Register C2B URLs (for production)
  async registerC2BUrls() {
    try {
      const token = await this.getAccessToken();

      const payload = {
        ShortCode: this.shortCode,
        ResponseType: 'Completed',
        ConfirmationURL: `${process.env.SERVER_URL}/api/v1/mpesa/confirmation`,
        ValidationURL: `${process.env.SERVER_URL}/api/v1/mpesa/validation`
      };

      const response = await axios.post(`${this.baseUrl}/mpesa/c2b/v1/registerurl`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error registering C2B URLs:', error.response?.data || error.message);
      throw new Error('Failed to register C2B URLs');
    }
  }

  // Simulate C2B payment (for testing)
  async simulateC2BPayment(phoneNumber, amount, commandId = 'CustomerPayBillOnline') {
    try {
      const token = await this.getAccessToken();
      
      // Format phone number
      const formattedPhone = phoneNumber.replace(/^0/, '254');

      const payload = {
        ShortCode: this.shortCode,
        CommandID: commandId,
        Amount: amount,
        Msisdn: formattedPhone,
        BillRefNumber: 'FulfillME'
      };

      const response = await axios.post(`${this.baseUrl}/mpesa/c2b/v1/simulate`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error simulating C2B payment:', error.response?.data || error.message);
      throw new Error('Failed to simulate C2B payment');
    }
  }

  // Generate payment QR code (for M-Pesa till numbers)
  generateQRCode(amount, reference, type = 'dynamic') {
    try {
      const qrData = {
        MerchantName: 'FulfillME Marketplace',
        RefNo: reference,
        Amount: amount,
        TrxCode: 'PB',
        CPI: this.shortCode,
        Size: '300'
      };

      // In production, you would generate an actual QR code
      // For now, return the data that can be used to generate a QR code
      return {
        success: true,
        data: qrData,
        qrString: `MPESA*${this.shortCode}*${amount}*${reference}`
      };
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }
}

// Create singleton instance
const mpesaService = new MPesaService();

module.exports = mpesaService;