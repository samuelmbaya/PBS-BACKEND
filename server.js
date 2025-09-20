require('dotenv').config()
const express = require("express")
const cors = require('cors')
const { MongoClient, ObjectId } = require("mongodb")
const base64 = require('base-64')

const app = express()
const port = process.env.PORT || 3000

console.log('Starting server setup...');

// CORS configuration
app.use(cors({
  origin: [
    'https://poweredbysamuel.co.za',
    'http://poweredbysamuel.co.za',
    'https://www.poweredbysamuel.co.za',
    'http://www.poweredbysamuel.co.za',
    'http://localhost:3000',
    'https://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

app.use(express.json())

console.log('Middleware configured...');

let client, db

async function connectToMongo() {
  try {
    client = new MongoClient(process.env.MONGODB_URI, { tls: true });
    await client.connect();
    db = client.db("PWS");
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}

// Basic request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

console.log('Setting up routes...');

// ======================= HEALTH CHECK =======================
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected'
  });
});

// ======================= TEST ROUTE =======================
app.get('/test-orders', (req, res) => {
  console.log('Test route hit');
  res.json({ 
    success: true,
    message: "Orders endpoint is working", 
    timestamp: new Date().toISOString(),
    database: db ? "connected" : "disconnected",
    server: "running"
  });
});

// ======================= AUTH ROUTES =======================
console.log('Setting up auth routes...');

app.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const encodedPassword = Buffer.from(password).toString('base64');
    const user = await db.collection('Users').findOne({ email });

    if (!user || user.password !== encodedPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/signup', async (req, res) => {
  try {
    const user = req.body;

    if (user.password.length < 8) throw new Error('Password must be at least 8 characters long');
    if (!user.email.includes("@")) throw new Error('Invalid email format');
    if (user.password !== user.confirmPassword) throw new Error('Passwords do not match');

    const collection = db.collection("Users");
    const normalizedEmail = user.email.toLowerCase();

    const existingUser = await collection.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const userData = { ...user };
    delete userData.confirmPassword;
    userData.email = normalizedEmail;
    userData.password = base64.encode(user.password);
    userData.createdAt = new Date();

    const result = await collection.insertOne(userData);

    res.status(201).json({
      message: "User successfully created",
      user_id: result.insertedId,
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ======================= ORDER ROUTES =======================
console.log('Setting up order routes...');

// GET all orders
app.get('/orders', async (req, res) => {
  console.log('GET /orders route hit');
  try {
    if (!db) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const orders = await db.collection("Orders").find().toArray();
    console.log(`Fetched ${orders.length} orders`);
    
    res.status(200).json({ 
      success: true,
      message: "Orders fetched successfully", 
      data: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Error in GET /orders:', error);
    res.status(500).json({ 
      error: "Failed to fetch orders",
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// GET specific order by ID
app.get('/orders/:id', async (req, res) => {
  console.log('GET /orders/:id route hit with id:', req.params.id);
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid order ID format" });
    }

    if (!db) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const order = await db.collection("Orders").findOne({ _id: new ObjectId(id) });
    
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json({ 
      success: true,
      data: order 
    });
  } catch (error) {
    console.error('Error in GET /orders/:id:', error);
    res.status(500).json({ 
      error: "Failed to fetch order",
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// CREATE new order
app.post('/orders', async (req, res) => {
  console.log('POST /orders route hit');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { userId, items, totalAmount, status, deliveryData } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items array is required and cannot be empty" });
    }
    
    if (totalAmount === undefined || totalAmount === null) {
      return res.status(400).json({ error: "totalAmount is required" });
    }

    if (!db) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const newOrder = {
      userId: userId.toString(),
      items: items,
      totalAmount: parseFloat(totalAmount) || 0,
      status: status || "pending",
      deliveryData: deliveryData || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('Creating order with data:', JSON.stringify(newOrder, null, 2));

    const collection = db.collection("Orders");
    const result = await collection.insertOne(newOrder);

    console.log('Order created successfully with ID:', result.insertedId);

    res.status(201).json({ 
      success: true,
      message: "Order created successfully", 
      data: { 
        _id: result.insertedId, 
        ...newOrder 
      } 
    });

  } catch (error) {
    console.error('Error in POST /orders:', error);
    res.status(500).json({ 
      error: "Failed to create order",
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// UPDATE order
app.put('/orders/:id', async (req, res) => {
  console.log('PUT /orders/:id route hit with id:', req.params.id);
  
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid order ID format" });
    }

    if (!db) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const updates = { ...req.body, updatedAt: new Date() };
    delete updates._id;

    const result = await db.collection("Orders").updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json({ 
      success: true,
      message: "Order updated successfully", 
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error in PUT /orders/:id:', error);
    res.status(500).json({ 
      error: "Failed to update order",
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// DELETE order
app.delete('/orders/:id', async (req, res) => {
  console.log('DELETE /orders/:id route hit with id:', req.params.id);
  
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid order ID format" });
    }

    if (!db) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const result = await db.collection("Orders").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json({ 
      success: true,
      message: "Order deleted successfully"
    });
  } catch (error) {
    console.error('Error in DELETE /orders/:id:', error);
    res.status(500).json({ 
      error: "Failed to delete order",
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// ======================= CART ROUTES =======================
console.log('Setting up cart routes...');

app.get('/cart', async (req, res) => {
  try {
    const cart = await db.collection("Cart").find().toArray();
    res.status(200).json({ message: "Cart fetched successfully", data: cart });
  } catch (error) {
    console.error('Cart fetch error:', error);
    res.status(500).json({ error: "Failed to fetch cart items" });
  }
});

app.post('/cart', async (req, res) => {
  try {
    const newItem = req.body;

    if (!newItem.productId || !newItem.quantity) {
      return res.status(400).json({ error: "Missing productId or quantity" });
    }

    const result = await db.collection("Cart").insertOne(newItem);
    res.status(201).json({ message: "Item added to cart successfully", data: { _id: result.insertedId, ...newItem } });
  } catch (error) {
    console.error('Cart add error:', error);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});

app.put('/cart/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const updateData = req.body;

    if (!updateData.quantity) {
      return res.status(400).json({ error: "Missing quantity in request body" });
    }

    const result = await db.collection("Cart").updateOne(
      { productId: productId },
      { $set: { quantity: updateData.quantity } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    res.status(200).json({ message: "Cart item updated successfully", updated: result.modifiedCount });
  } catch (error) {
    console.error('Cart update error:', error);
    res.status(500).json({ error: "Failed to update cart item" });
  }
});

app.delete('/cart/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await db.collection("Cart").deleteOne({ productId: productId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    res.status(200).json({ message: "Cart item deleted successfully" });
  } catch (error) {
    console.error('Cart delete error:', error);
    res.status(500).json({ error: "Failed to delete cart item" });
  }
});

// ======================= USER ROUTES =======================
console.log('Setting up user routes...');

app.get('/users', async (req, res) => {
  try {
    const users = await db.collection("Users").find({}, { projection: { password: 0 } }).toArray();
    res.status(200).json({ message: "Users fetched successfully", data: users });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ======================= ERROR HANDLERS =======================
console.log('Setting up error handlers...');

// 404 handler
app.use('*', (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    details: process.env.NODE_ENV !== 'production' ? err.message : undefined
  });
});

console.log('All routes configured. Starting server...');

// Server startup
connectToMongo().then(() => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server is running successfully on http://0.0.0.0:${port}`);
    console.log('📋 Available endpoints:');
    console.log('   - GET /health');
    console.log('   - GET /test-orders');
    console.log('   - POST /signin');
    console.log('   - POST /signup');
    console.log('   - GET /orders');
    console.log('   - POST /orders');
    console.log('   - GET /orders/:id');
    console.log('   - PUT /orders/:id');
    console.log('   - DELETE /orders/:id');
    console.log('   - GET /cart');
    console.log('   - POST /cart');
    console.log('   - PUT /cart/:productId');
    console.log('   - DELETE /cart/:productId');
    console.log('   - GET /users');
  });
}).catch((error) => {
  console.error("❌ Failed to connect to MongoDB:", error);
  process.exit(1);
});