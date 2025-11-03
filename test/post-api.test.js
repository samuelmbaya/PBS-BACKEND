require('dotenv').config({ path: '../.env' });
console.log('Mongo URI in test:', process.env.MONGODB_URI);
const request = require('supertest');
const { expect } = require('chai');
const { app, connectToMongo } = require('../server');
const { ObjectId } = require('mongodb');

describe('POST API Tests', function () {
  this.timeout(10000);

  let createdUserIds = [];
  let createdProductIds = [];
  let testUserId, testProductId;

  before(async function () {
    this.timeout(15000);
    const db = await connectToMongo();
    console.log('Test database connected for POST tests');

    // Create a test user for order tests
    const userResult = await db.collection('Users').insertOne({
      name: 'Order Test User',
      email: 'ordertest@example.com',
      password: Buffer.from('password123').toString('base64'),
      createdAt: new Date()
    });
    testUserId = userResult.insertedId.toString();

    // Create a test product for cart and order tests
    const productResult = await db.collection('Products').insertOne({
      name: 'Test Product for Orders',
      description: 'Test description',
      price: 99.99,
      category: 'Test',
      imageUrl: '',
      stock: 10,
      createdAt: new Date()
    });
    testProductId = productResult.insertedId.toString();
  });

  after(async function () {
    const db = await connectToMongo();
    
    // Cleanup all created test data
    if (createdUserIds.length > 0) {
      await db.collection('Users').deleteMany({
        _id: { $in: createdUserIds.map(id => new ObjectId(id)) }
      });
    }
    
    if (createdProductIds.length > 0) {
      await db.collection('Products').deleteMany({
        _id: { $in: createdProductIds.map(id => new ObjectId(id)) }
      });
    }

    await db.collection('Users').deleteOne({ _id: new ObjectId(testUserId) });
    await db.collection('Products').deleteOne({ _id: new ObjectId(testProductId) });
    await db.collection('Cart').deleteMany({ productId: testProductId });
    await db.collection('Orders').deleteMany({ userId: testUserId });
    
    console.log('Test data cleaned up');
  });

  /* ---------------- SIGNUP POST TESTS ---------------- */

  describe('POST /signup', () => {
    it('should register a new user successfully', async () => {
      const uniqueEmail = `testuser${Date.now()}@example.com`;
      const res = await request(app)
        .post('/signup')
        .send({
          name: 'Test User',
          email: uniqueEmail,
          password: 'securePass123',
          confirmPassword: 'securePass123'
        });
      
      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('message', 'User created successfully');
      expect(res.body).to.have.property('userId');
      createdUserIds.push(res.body.userId);
    });

    it('should reject signup without email', async () => {
      const res = await request(app)
        .post('/signup')
        .send({
          name: 'Test User',
          password: 'securePass123',
          confirmPassword: 'securePass123'
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Email and password are required');
    });

    it('should reject signup without password', async () => {
      const res = await request(app)
        .post('/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          confirmPassword: 'securePass123'
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Email and password are required');
    });

    it('should reject signup with short password', async () => {
      const res = await request(app)
        .post('/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'short',
          confirmPassword: 'short'
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Password must be at least 8 characters long');
    });

    it('should reject signup with mismatched passwords', async () => {
      const res = await request(app)
        .post('/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'securePass123',
          confirmPassword: 'differentPass123'
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Passwords do not match');
    });

    it('should reject duplicate email registration', async () => {
      const uniqueEmail = `duplicate${Date.now()}@example.com`;
      
      // First registration
      const res1 = await request(app)
        .post('/signup')
        .send({
          name: 'Test User',
          email: uniqueEmail,
          password: 'securePass123',
          confirmPassword: 'securePass123'
        });
      
      expect(res1.status).to.equal(201);
      createdUserIds.push(res1.body.userId);

      // Second registration with same email
      const res2 = await request(app)
        .post('/signup')
        .send({
          name: 'Test User 2',
          email: uniqueEmail,
          password: 'anotherPass123',
          confirmPassword: 'anotherPass123'
        });
      
      expect(res2.status).to.equal(409);
      expect(res2.body).to.have.property('error', 'Email already registered');
    });

    it('should normalize email to lowercase', async () => {
      const uniqueEmail = `TestUser${Date.now()}@Example.COM`;
      const res = await request(app)
        .post('/signup')
        .send({
          name: 'Test User',
          email: uniqueEmail,
          password: 'securePass123',
          confirmPassword: 'securePass123'
        });
      
      expect(res.status).to.equal(201);
      createdUserIds.push(res.body.userId);

      // Verify email was stored in lowercase
      const db = await connectToMongo();
      const user = await db.collection('Users').findOne({ _id: new ObjectId(res.body.userId) });
      expect(user.email).to.equal(uniqueEmail.toLowerCase());
    });
  });

  /* ---------------- SIGNIN POST TESTS ---------------- */

  describe('POST /signin', () => {
    let testEmail, testPassword;

    before(async function () {
      testEmail = `signintest${Date.now()}@example.com`;
      testPassword = 'testPassword123';
      
      const res = await request(app)
        .post('/signup')
        .send({
          name: 'Signin Test User',
          email: testEmail,
          password: testPassword,
          confirmPassword: testPassword
        });
      
      createdUserIds.push(res.body.userId);
    });

    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/signin')
        .send({
          email: testEmail,
          password: testPassword
        });
      
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('message', 'Login successful');
      expect(res.body).to.have.property('user');
      expect(res.body.user).to.have.property('email', testEmail.toLowerCase());
      expect(res.body.user).to.have.property('id');
      expect(res.body.user).to.not.have.property('password');
    });

    it('should reject signin without email', async () => {
      const res = await request(app)
        .post('/signin')
        .send({
          password: testPassword
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Email and password are required');
    });

    it('should reject signin without password', async () => {
      const res = await request(app)
        .post('/signin')
        .send({
          email: testEmail
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Email and password are required');
    });

    it('should reject signin with incorrect password', async () => {
      const res = await request(app)
        .post('/signin')
        .send({
          email: testEmail,
          password: 'wrongPassword'
        });
      
      expect(res.status).to.equal(401);
      expect(res.body).to.have.property('error', 'Invalid email or password');
    });

    it('should reject signin with non-existent email', async () => {
      const res = await request(app)
        .post('/signin')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword
        });
      
      expect(res.status).to.equal(401);
      expect(res.body).to.have.property('error', 'Invalid email or password');
    });

    it('should handle case-insensitive email login', async () => {
      const res = await request(app)
        .post('/signin')
        .send({
          email: testEmail.toUpperCase(),
          password: testPassword
        });
      
      expect(res.status).to.equal(200);
      expect(res.body.user.email).to.equal(testEmail.toLowerCase());
    });
  });

  /* ---------------- PRODUCTS POST TESTS ---------------- */

  describe('POST /products', () => {
    it('should create a new product successfully', async () => {
      const res = await request(app)
        .post('/products')
        .send({
          name: 'New Test Product',
          description: 'A great product',
          price: 199.99,
          category: 'Electronics',
          imageUrl: 'http://example.com/product.jpg',
          stock: 25
        });
      
      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('message', 'Product created');
      expect(res.body).to.have.property('id');
      createdProductIds.push(res.body.id);
    });

    it('should create product with minimal required fields', async () => {
      const res = await request(app)
        .post('/products')
        .send({
          name: 'Minimal Product',
          price: 49.99,
          category: 'Test'
        });
      
      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('id');
      createdProductIds.push(res.body.id);

      // Verify defaults were applied
      const db = await connectToMongo();
      const product = await db.collection('Products').findOne({ _id: new ObjectId(res.body.id) });
      expect(product.description).to.equal('');
      expect(product.imageUrl).to.equal('');
      expect(product.stock).to.equal(0);
    });

    it('should reject product creation without name', async () => {
      const res = await request(app)
        .post('/products')
        .send({
          description: 'Test',
          price: 99.99,
          category: 'Test'
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Name, price, and category are required');
    });

    it('should reject product creation without price', async () => {
      const res = await request(app)
        .post('/products')
        .send({
          name: 'Test Product',
          category: 'Test'
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Name, price, and category are required');
    });

    it('should reject product creation without category', async () => {
      const res = await request(app)
        .post('/products')
        .send({
          name: 'Test Product',
          price: 99.99
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Name, price, and category are required');
    });

    it('should parse price as float', async () => {
      const res = await request(app)
        .post('/products')
        .send({
          name: 'Price Test Product',
          price: '149.99',
          category: 'Test'
        });
      
      expect(res.status).to.equal(201);
      createdProductIds.push(res.body.id);

      const db = await connectToMongo();
      const product = await db.collection('Products').findOne({ _id: new ObjectId(res.body.id) });
      expect(product.price).to.be.a('number');
      expect(product.price).to.equal(149.99);
    });

    it('should parse stock as integer', async () => {
      const res = await request(app)
        .post('/products')
        .send({
          name: 'Stock Test Product',
          price: 49.99,
          category: 'Test',
          stock: '15'
        });
      
      expect(res.status).to.equal(201);
      createdProductIds.push(res.body.id);

      const db = await connectToMongo();
      const product = await db.collection('Products').findOne({ _id: new ObjectId(res.body.id) });
      expect(product.stock).to.be.a('number');
      expect(product.stock).to.equal(15);
    });
  });

  /* ---------------- CART POST TESTS ---------------- */

  describe('POST /cart', () => {
    afterEach(async function () {
      const db = await connectToMongo();
      await db.collection('Cart').deleteMany({ productId: testProductId });
    });

    it('should add item to cart successfully', async () => {
      const res = await request(app)
        .post('/cart')
        .send({
          productId: testProductId,
          quantity: 3
        });
      
      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('message', 'Item added');
      expect(res.body).to.have.property('id');
    });

    it('should reject cart item without productId', async () => {
      const res = await request(app)
        .post('/cart')
        .send({
          quantity: 2
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Missing productId or quantity');
    });

    it('should reject cart item without quantity', async () => {
      const res = await request(app)
        .post('/cart')
        .send({
          productId: testProductId
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Missing productId or quantity');
    });

    it('should accept additional cart item fields', async () => {
      const res = await request(app)
        .post('/cart')
        .send({
          productId: testProductId,
          quantity: 2,
          userId: testUserId,
          addedAt: new Date()
        });
      
      expect(res.status).to.equal(201);
      
      const db = await connectToMongo();
      const cartItem = await db.collection('Cart').findOne({ _id: new ObjectId(res.body.id) });
      expect(cartItem.userId).to.equal(testUserId);
    });
  });

  /* ---------------- ORDERS POST TESTS ---------------- */

  describe('POST /orders', () => {
    afterEach(async function () {
      const db = await connectToMongo();
      await db.collection('Orders').deleteMany({ userId: testUserId });
    });

    it('should create an order successfully', async () => {
      const res = await request(app)
        .post('/orders')
        .send({
          userId: testUserId,
          items: [
            { productId: testProductId, quantity: 2 }
          ],
          totalAmount: 199.98,
          paymentMethod: 'card',
          deliveryData: {
            address: '123 Test Street',
            city: 'Test City',
            zipCode: '12345'
          }
        });
      
      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('message', 'Order created');
      expect(res.body).to.have.property('id');

      // Verify order in database
      const db = await connectToMongo();
      const order = await db.collection('Orders').findOne({ _id: new ObjectId(res.body.id) });
      expect(order).to.exist;
      expect(order.userId).to.equal(testUserId);
      expect(order.totalAmount).to.equal(199.98);
      expect(order.status).to.equal('pending');
    });

    it('should create order with default status', async () => {
      const res = await request(app)
        .post('/orders')
        .send({
          userId: testUserId,
          items: [{ productId: testProductId, quantity: 1 }],
          totalAmount: 99.99
        });
      
      expect(res.status).to.equal(201);

      const db = await connectToMongo();
      const order = await db.collection('Orders').findOne({ _id: new ObjectId(res.body.id) });
      expect(order.status).to.equal('pending');
    });

    it('should reject order without userId', async () => {
      const res = await request(app)
        .post('/orders')
        .send({
          items: [{ productId: testProductId, quantity: 1 }],
          totalAmount: 99.99
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Invalid order data');
    });

    it('should reject order without items', async () => {
      const res = await request(app)
        .post('/orders')
        .send({
          userId: testUserId,
          totalAmount: 99.99
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Invalid order data');
    });

    it('should reject order with empty items array', async () => {
      const res = await request(app)
        .post('/orders')
        .send({
          userId: testUserId,
          items: [],
          totalAmount: 99.99
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Invalid order data');
    });

    it('should reject order with non-array items', async () => {
      const res = await request(app)
        .post('/orders')
        .send({
          userId: testUserId,
          items: 'not-an-array',
          totalAmount: 99.99
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Invalid order data');
    });

    it('should parse totalAmount as float', async () => {
      const res = await request(app)
        .post('/orders')
        .send({
          userId: testUserId,
          items: [{ productId: testProductId, quantity: 1 }],
          totalAmount: '149.99'
        });
      
      expect(res.status).to.equal(201);

      const db = await connectToMongo();
      const order = await db.collection('Orders').findOne({ _id: new ObjectId(res.body.id) });
      expect(order.totalAmount).to.be.a('number');
      expect(order.totalAmount).to.equal(149.99);
    });

    it('should create order with custom status', async () => {
      const res = await request(app)
        .post('/orders')
        .send({
          userId: testUserId,
          items: [{ productId: testProductId, quantity: 1 }],
          totalAmount: 99.99,
          status: 'processing'
        });
      
      expect(res.status).to.equal(201);

      const db = await connectToMongo();
      const order = await db.collection('Orders').findOne({ _id: new ObjectId(res.body.id) });
      expect(order.status).to.equal('processing');
    });

    it('should store deliveryData object', async () => {
      const deliveryData = {
        address: '456 Main St',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        phone: '555-1234'
      };

      const res = await request(app)
        .post('/orders')
        .send({
          userId: testUserId,
          items: [{ productId: testProductId, quantity: 1 }],
          totalAmount: 99.99,
          deliveryData
        });
      
      expect(res.status).to.equal(201);

      const db = await connectToMongo();
      const order = await db.collection('Orders').findOne({ _id: new ObjectId(res.body.id) });
      expect(order.deliveryData).to.deep.equal(deliveryData);
    });

    it('should handle multiple items in order', async () => {
      const items = [
        { productId: testProductId, quantity: 2 },
        { productId: new ObjectId().toString(), quantity: 1 },
        { productId: new ObjectId().toString(), quantity: 3 }
      ];

      const res = await request(app)
        .post('/orders')
        .send({
          userId: testUserId,
          items,
          totalAmount: 399.97
        });
      
      expect(res.status).to.equal(201);

      const db = await connectToMongo();
      const order = await db.collection('Orders').findOne({ _id: new ObjectId(res.body.id) });
      expect(order.items).to.have.length(3);
      expect(order.items).to.deep.equal(items);
    });

    it('should set createdAt and updatedAt timestamps', async () => {
      const beforeTime = new Date();
      
      const res = await request(app)
        .post('/orders')
        .send({
          userId: testUserId,
          items: [{ productId: testProductId, quantity: 1 }],
          totalAmount: 99.99
        });
      
      const afterTime = new Date();
      expect(res.status).to.equal(201);

      const db = await connectToMongo();
      const order = await db.collection('Orders').findOne({ _id: new ObjectId(res.body.id) });
      
      expect(order.createdAt).to.be.instanceOf(Date);
      expect(order.updatedAt).to.be.instanceOf(Date);
      expect(order.createdAt.getTime()).to.be.at.least(beforeTime.getTime());
      expect(order.createdAt.getTime()).to.be.at.most(afterTime.getTime());
    });

    it('should default deliveryData to empty object if not provided', async () => {
      const res = await request(app)
        .post('/orders')
        .send({
          userId: testUserId,
          items: [{ productId: testProductId, quantity: 1 }],
          totalAmount: 99.99
        });
      
      expect(res.status).to.equal(201);

      const db = await connectToMongo();
      const order = await db.collection('Orders').findOne({ _id: new ObjectId(res.body.id) });
      expect(order.deliveryData).to.deep.equal({});
    });

    it('should default paymentMethod to "pending" if not provided', async () => {
      const res = await request(app)
        .post('/orders')
        .send({
          userId: testUserId,
          items: [{ productId: testProductId, quantity: 1 }],
          totalAmount: 99.99
        });
      
      expect(res.status).to.equal(201);

      const db = await connectToMongo();
      const order = await db.collection('Orders').findOne({ _id: new ObjectId(res.body.id) });
      expect(order.paymentMethod).to.equal('pending');
    });
  });
});