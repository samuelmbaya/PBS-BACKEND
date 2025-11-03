require('dotenv').config({ path: '../.env' });
console.log('Mongo URI in test:', process.env.MONGODB_URI);
const request = require('supertest');
const { expect } = require('chai');
const { app, connectToMongo } = require('../server');
const { ObjectId } = require('mongodb');

describe('GET API Tests', function () {
  this.timeout(10000);

  let testUserId, testProductId;

  before(async function () {
    this.timeout(15000);
    const db = await connectToMongo();
    console.log('Test database connected for GET tests');

    // Create test user
    const userResult = await db.collection('Users').insertOne({
      name: 'Test User',
      email: 'gettest@example.com',
      password: Buffer.from('password123').toString('base64'),
      createdAt: new Date()
    });
    testUserId = userResult.insertedId.toString();

    // Create test product
    const productResult = await db.collection('Products').insertOne({
      name: 'Test Product',
      description: 'Test description',
      price: 49.99,
      category: 'Electronics',
      imageUrl: 'http://example.com/image.jpg',
      stock: 10,
      createdAt: new Date()
    });
    testProductId = productResult.insertedId.toString();

    // Create test cart item
    await db.collection('Cart').insertOne({
      productId: testProductId,
      quantity: 2,
      userId: testUserId
    });

    // Create test order
    await db.collection('Orders').insertOne({
      userId: testUserId,
      items: [{ productId: testProductId, quantity: 1 }],
      totalAmount: 49.99,
      status: 'pending',
      deliveryData: { address: '123 Test St' },
      paymentMethod: 'card',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  after(async function () {
    const db = await connectToMongo();
    // Cleanup test data
    await db.collection('Users').deleteOne({ _id: new ObjectId(testUserId) });
    await db.collection('Products').deleteOne({ _id: new ObjectId(testProductId) });
    await db.collection('Cart').deleteMany({ userId: testUserId });
    await db.collection('Orders').deleteMany({ userId: testUserId });
    console.log('Test data cleaned up');
  });

  /* ---------------- USERS GET TESTS ---------------- */

  describe('GET /users', () => {
    it('should fetch all users successfully', async () => {
      const res = await request(app).get('/users');
      
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('message', 'Users fetched successfully');
      expect(res.body).to.have.property('data');
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.greaterThan(0);
    });

    it('should return users without password field', async () => {
      const res = await request(app).get('/users');
      
      expect(res.status).to.equal(200);
      const users = res.body.data;
      users.forEach(user => {
        expect(user).to.not.have.property('password');
        expect(user).to.have.property('email');
        expect(user).to.have.property('_id');
      });
    });

    it('should include the test user in the response', async () => {
      const res = await request(app).get('/users');
      
      expect(res.status).to.equal(200);
      const testUser = res.body.data.find(u => u._id === testUserId);
      expect(testUser).to.exist;
      expect(testUser.email).to.equal('gettest@example.com');
      expect(testUser.name).to.equal('Test User');
    });
  });

  /* ---------------- PRODUCTS GET TESTS ---------------- */

  describe('GET /products', () => {
    it('should fetch all products successfully', async () => {
      const res = await request(app).get('/products');
      
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('data');
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.greaterThan(0);
    });

    it('should return products with all required fields', async () => {
      const res = await request(app).get('/products');
      
      expect(res.status).to.equal(200);
      const products = res.body.data;
      products.forEach(product => {
        expect(product).to.have.property('_id');
        expect(product).to.have.property('name');
        expect(product).to.have.property('price');
        expect(product).to.have.property('category');
      });
    });

    it('should include the test product in the response', async () => {
      const res = await request(app).get('/products');
      
      expect(res.status).to.equal(200);
      const testProduct = res.body.data.find(p => p._id === testProductId);
      expect(testProduct).to.exist;
      expect(testProduct.name).to.equal('Test Product');
      expect(testProduct.price).to.equal(49.99);
      expect(testProduct.category).to.equal('Electronics');
    });

    it('should return empty array if no products exist', async function () {
      const db = await connectToMongo();
      await db.collection('Products').deleteMany({});
      
      const res = await request(app).get('/products');
      
      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('array');
      expect(res.body.data).to.have.length(0);

      // Restore test product
      await db.collection('Products').insertOne({
        _id: new ObjectId(testProductId),
        name: 'Test Product',
        description: 'Test description',
        price: 49.99,
        category: 'Electronics',
        imageUrl: 'http://example.com/image.jpg',
        stock: 10,
        createdAt: new Date()
      });
    });
  });

  /* ---------------- CART GET TESTS ---------------- */

  describe('GET /cart', () => {
    it('should fetch all cart items successfully', async () => {
      const res = await request(app).get('/cart');
      
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('data');
      expect(res.body.data).to.be.an('array');
    });

    it('should return cart items with required fields', async () => {
      const res = await request(app).get('/cart');
      
      expect(res.status).to.equal(200);
      if (res.body.data.length > 0) {
        const cartItem = res.body.data[0];
        expect(cartItem).to.have.property('productId');
        expect(cartItem).to.have.property('quantity');
      }
    });

    it('should include the test cart item', async () => {
      const res = await request(app).get('/cart');
      
      expect(res.status).to.equal(200);
      const testCartItem = res.body.data.find(item => item.productId === testProductId);
      expect(testCartItem).to.exist;
      expect(testCartItem.quantity).to.equal(2);
    });

    it('should return empty array if cart is empty', async function () {
      const db = await connectToMongo();
      await db.collection('Cart').deleteMany({});
      
      const res = await request(app).get('/cart');
      
      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('array');
      expect(res.body.data).to.have.length(0);

      // Restore test cart item
      await db.collection('Cart').insertOne({
        productId: testProductId,
        quantity: 2,
        userId: testUserId
      });
    });
  });

  /* ---------------- ORDERS GET TESTS ---------------- */

  describe('GET /orders', () => {
    it('should fetch all orders successfully', async () => {
      const res = await request(app).get('/orders');
      
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('data');
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.greaterThan(0);
    });

    it('should fetch orders for a specific user', async () => {
      const res = await request(app).get(`/orders?userId=${testUserId}`);
      
      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('array');
      res.body.data.forEach(order => {
        expect(order.userId).to.equal(testUserId);
      });
    });

    it('should return orders with all required fields', async () => {
      const res = await request(app).get('/orders');
      
      expect(res.status).to.equal(200);
      const orders = res.body.data;
      orders.forEach(order => {
        expect(order).to.have.property('_id');
        expect(order).to.have.property('userId');
        expect(order).to.have.property('items');
        expect(order).to.have.property('totalAmount');
        expect(order).to.have.property('status');
        expect(order.items).to.be.an('array');
      });
    });

    it('should return empty array for non-existent user', async () => {
      const fakeUserId = new ObjectId().toString();
      const res = await request(app).get(`/orders?userId=${fakeUserId}`);
      
      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('array');
      expect(res.body.data).to.have.length(0);
    });

    it('should include the test order', async () => {
      const res = await request(app).get(`/orders?userId=${testUserId}`);
      
      expect(res.status).to.equal(200);
      expect(res.body.data.length).to.be.greaterThan(0);
      const order = res.body.data[0];
      expect(order.userId).to.equal(testUserId);
      expect(order.totalAmount).to.equal(49.99);
      expect(order.status).to.equal('pending');
    });
  });
});