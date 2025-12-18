const request = require('supertest');
const app = require('../server');
const { User, Need, Category } = require('../models');

describe('Needs API', () => {
  let token;
  let userId;
  let categoryId;

  beforeAll(async () => {
    // Create a test user and get token
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Test Asker',
        email: 'asker@example.com',
        phone: '+254712345670',
        location: 'Nairobi',
        userType: 'asker',
        password: 'Test12345'
      });

    token = registerRes.body.data.token;
    userId = registerRes.body.data.user.id;

    // Create a test category
    const category = await Category.create({
      name: 'Test Category',
      description: 'Test category for testing',
      icon: 'fa-test'
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    // Clean up
    await Need.destroy({ where: {} });
    await User.destroy({ where: {} });
    await Category.destroy({ where: {} });
  });

  describe('POST /api/v1/needs', () => {
    it('should create a new need', async () => {
      const res = await request(app)
        .post('/api/v1/needs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Test Need',
          description: 'This is a test need description',
          budget: 1000,
          location: 'Nairobi, Kenya',
          categoryId: categoryId,
          timeline: 'ASAP',
          contactPrefs: ['whatsapp', 'call']
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.need).toHaveProperty('title', 'Test Need');
    });

    it('should return 403 for non-asker users', async () => {
      // Create a fulfiller user
      const fulfillerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Test Fulfiller',
          email: 'fulfiller@example.com',
          phone: '+254712345671',
          location: 'Nairobi',
          userType: 'fulfiller',
          password: 'Test12345'
        });

      const fulfillerToken = fulfillerRes.body.data.token;

      const res = await request(app)
        .post('/api/v1/needs')
        .set('Authorization', `Bearer ${fulfillerToken}`)
        .send({
          title: 'Test Need',
          description: 'This is a test need description',
          budget: 1000,
          location: 'Nairobi, Kenya',
          categoryId: categoryId
        });

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('GET /api/v1/needs', () => {
    beforeEach(async () => {
      // Create test needs
      await Need.create({
        title: 'Test Need 1',
        description: 'Description 1',
        budget: 1000,
        location: 'Nairobi',
        categoryId: categoryId,
        askerId: userId,
        status: 'active'
      });

      await Need.create({
        title: 'Test Need 2',
        description: 'Description 2',
        budget: 2000,
        location: 'Mombasa',
        categoryId: categoryId,
        askerId: userId,
        status: 'active'
      });
    });

    it('should get all needs', async () => {
      const res = await request(app)
        .get('/api/v1/needs');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.needs).toBeInstanceOf(Array);
      expect(res.body.data.needs.length).toBeGreaterThan(0);
    });

    it('should filter needs by location', async () => {
      const res = await request(app)
        .get('/api/v1/needs?location=Nairobi');

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.needs.every(need => 
        need.location.toLowerCase().includes('nairobi')
      )).toBe(true);
    });
  });
});