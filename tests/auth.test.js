const request = require('supertest');
const app = require('../server');
const { User } = require('../models');

describe('Authentication API', () => {
  beforeEach(async () => {
    // Clear users table before each test
    await User.destroy({ where: {} });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Test User',
          email: 'test@example.com',
          phone: '+254712345678',
          location: 'Nairobi',
          userType: 'asker',
          password: 'Test12345'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data).toHaveProperty('token');
    });

    it('should return 400 for duplicate email', async () => {
      // First registration
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Test User',
          email: 'test@example.com',
          phone: '+254712345678',
          location: 'Nairobi',
          userType: 'asker',
          password: 'Test12345'
        });

      // Second registration with same email
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Test User 2',
          email: 'test@example.com',
          phone: '+254798765432',
          location: 'Mombasa',
          userType: 'fulfiller',
          password: 'Test12345'
        });

      expect(res.statusCode).toEqual(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Test User',
          email: 'test@example.com',
          phone: '+254712345678',
          location: 'Nairobi',
          userType: 'asker',
          password: 'Test12345'
        });
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test12345'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data).toHaveProperty('token');
    });

    it('should return 401 with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword'
        });

      expect(res.statusCode).toEqual(401);
    });
  });
});