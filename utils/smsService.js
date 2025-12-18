// For Kenya, we can use Africa's Talking or Twilio
// This is a placeholder implementation

const sendSMS = async ({ to, message }) => {
  try {
    console.log(`SMS to ${to}: ${message}`);
    
    // In production, integrate with Africa's Talking API:
    // https://developers.africastalking.com/docs/sms/overview
    
    return {
      success: true,
      message: 'SMS sent (simulated in development)'
    };
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
};

module.exports = { sendSMS };