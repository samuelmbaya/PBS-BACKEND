require('dotenv').config()
const express = require("express")
const cors = require('cors')
const { MongoClient, ObjectId } = require("mongodb")
const app = express()
const port = process.env.PORT || 3000
const base64 = require('base-64')

// Updated CORS configuration to allow your domain
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

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/"

app.use(express.json())
let client, db

async function connectToMongo() {
  client = new MongoClient(process.env.MONGODB_URI, { tls: true });
  await client.connect();
  db = client.db("PWS"); // Explicitly set to PWS
  console.log("Connected to MongoDB");
}

// Middleware for Basic Authentication
async function basicAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return res.status(401).json({ message: "Authorization header missing or invalid" });
  }

  const base64Credentials = authHeader.split(" ")[1];
  const credentials = base64.decode(base64Credentials).split(":");
  const email = credentials[0];
  const password = credentials[1];

  const collection = db.collection("users");
  const user = await collection.findOne({ email });

  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  const decodedStoredPassword = base64.decode(user.password);
  if (decodedStoredPassword !== password) {
    return res.status(401).json({ message: "Invalid password" });
  }

  req.user = user;
  next();
}

// ======================= AUTH =======================

// Sign in
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
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign up
app.post('/signup', async (req, res) => {
  try {
    const user = req.body;

    if (user.password.length < 8) throw new Error('Password must be at least 8 characters long');
    if (!user.email.includes("@")) throw new Error('Invalid email format');
    if (user.password !== user.confirmPassword) throw new Error('Passwords do not match');

    const collection = db.collection("Users");
    const normalizedEmail = user.email.toLowerCase();

    const existingUserQuery = { email: normalizedEmail };
    if (user.username) {
      existingUserQuery.$or = [
        { email: normalizedEmail },
        { username: user.username }
      ];
      delete existingUserQuery.email;
    }

    const existingUser = await collection.findOne(existingUserQuery);

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      if (user.username && existingUser.username === user.username) {
        return res.status(409).json({ error: 'Username already taken' });
      }
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
    console.error(error);

    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
      if (duplicateField === 'email') {
        return res.status(409).json({ error: 'Email already registered' });
      } else if (duplicateField === 'username') {
        return res.status(409).json({ error: 'Username already taken' });
      } else {
        return res.status(409).json({ error: `${duplicateField} already exists` });
      }
    }

    res.status(500).json({ error: error.message });
  }
});

// ======================= CART =======================

app.get('/cart', async (req, res) => {
  try {
    const cart = await db.collection("Cart").find().toArray();
    res.status(200).json({ message: "Cart fetched successfully", data: cart });
  } catch (error) {
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
    res.status(500).json({ error: "Failed to delete cart item" });
  }
});

// ======================= USERS =======================

app.get('/users', async (req, res) => {
  try {
    const users = await db.collection("Users").find({}, { projection: { password: 0 } }).toArray();
    res.status(200).json({ message: "Users fetched successfully", data: users });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// (keeping your POST, PUT, DELETE users endpoints as is...)

// ======================= PRODUCTS =======================

// (keeping your products CRUD as is...)

// ======================= ORDERS =======================

// Replaces old "order-items"
// ======================= ORDERS =======================

// ======================= ORDERS =======================

// GET all orders
app.get('/orders', async (req, res) => {
  console.log('GET /orders route hit');
  try {
    // Check database connection
    if (!db) {
      console.error('Database not connected');
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
      console.log('Invalid ObjectId provided:', id);
      return res.status(400).json({ error: "Invalid order ID format" });
    }

    // Check database connection
    if (!db) {
      console.error('Database not connected');
      return res.status(500).json({ error: "Database connection not available" });
    }

    const order = await db.collection("Orders").findOne({ _id: new ObjectId(id) });
    
    if (!order) {
      console.log('Order not found with id:', id);
      return res.status(404).json({ error: "Order not found" });
    }

    console.log('Order found:', order._id);
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
app.post('/order', async (req, res) => {
  console.log('POST /orders route hit!');
  console.log('Request body:', req.body);
  console.log('Headers:', req.headers);
  
  try {
    const { userId, items, totalAmount, status } = req.body;

    // Enhanced validation with better error messages
    if (!userId) {
      console.log('Missing userId');
      return res.status(400).json({ error: "userId is required" });
    }
    
    if (!items) {
      console.log('Missing items');
      return res.status(400).json({ error: "items array is required" });
    }
    
    if (!Array.isArray(items)) {
      console.log('Items is not an array:', typeof items);
      return res.status(400).json({ error: "items must be an array" });
    }
    
    if (items.length === 0) {
      console.log('Items array is empty');
      return res.status(400).json({ error: "items array cannot be empty" });
    }
    
    if (totalAmount === undefined || totalAmount === null) {
      console.log('Missing totalAmount');
      return res.status(400).json({ error: "totalAmount is required" });
    }

    // Check database connection
    if (!db) {
      console.error('Database not connected');
      return res.status(500).json({ error: "Database connection not available" });
    }

    const newOrder = {
      userId: userId.toString(), // Ensure string
      items: items,
      totalAmount: parseFloat(totalAmount) || 0,
      status: status || "pending",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('Creating order with data:', newOrder);

    // Test database connection first
    const collection = db.collection("Orders");
    const result = await collection.insertOne(newOrder);

    console.log('Order created successfully:', result.insertedId);

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
    console.error('Stack trace:', error.stack);
    
    // Send detailed error in development, generic in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    res.status(500).json({ 
      error: "Failed to create order",
      details: isDevelopment ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// UPDATE order by ID
app.put('/orders/:id', async (req, res) => {
  console.log('PUT /orders/:id route hit with id:', req.params.id);
  console.log('Update data:', req.body);
  
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      console.log('Invalid ObjectId provided:', id);
      return res.status(400).json({ error: "Invalid order ID format" });
    }

    // Check database connection
    if (!db) {
      console.error('Database not connected');
      return res.status(500).json({ error: "Database connection not available" });
    }

    const updates = { ...req.body, updatedAt: new Date() };
    delete updates._id; // Remove _id from updates to avoid conflicts

    console.log('Applying updates:', updates);

    const result = await db.collection("Orders").updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      console.log('Order not found for update with id:', id);
      return res.status(404).json({ error: "Order not found" });
    }

    console.log('Order updated successfully. Modified count:', result.modifiedCount);

    res.status(200).json({ 
      success: true,
      message: "Order updated successfully", 
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    });
  } catch (error) {
    console.error('Error in PUT /orders/:id:', error);
    res.status(500).json({ 
      error: "Failed to update order",
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// DELETE order by ID
app.delete('/orders/:id', async (req, res) => {
  console.log('DELETE /orders/:id route hit with id:', req.params.id);
  
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      console.log('Invalid ObjectId provided:', id);
      return res.status(400).json({ error: "Invalid order ID format" });
    }

    // Check database connection
    if (!db) {
      console.error('Database not connected');
      return res.status(500).json({ error: "Database connection not available" });
    }

    const result = await db.collection("Orders").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      console.log('Order not found for deletion with id:', id);
      return res.status(404).json({ error: "Order not found" });
    }

    console.log('Order deleted successfully with id:', id);

    res.status(200).json({ 
      success: true,
      message: "Order deleted successfully",
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error in DELETE /orders/:id:', error);
    res.status(500).json({ 
      error: "Failed to delete order",
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// ======================= TESTING & ERROR HANDLING =======================

// Test route to verify server is working
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

// Server health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected'
  });
});

// ======================= REVIEWS =======================

// (keeping your reviews CRUD as is...)

// ======================= MIDDLEWARE & ERROR HANDLING =======================

// Add route registration logging
console.log('All Orders routes registered at startup');

// Add middleware to log all requests (place this BEFORE your routes)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Request body:', req.body);
  next();
});

// Add 404 handler at the very end (AFTER all your routes)
app.use('*', (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  console.log('Available routes: GET /health, GET /test-orders, GET /orders, POST /orders, etc.');
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    availableRoutes: [
      'GET /health',
      'GET /test-orders', 
      'GET /orders',
      'GET /orders/:id',
      'POST /orders',
      'PUT /orders/:id',
      'DELETE /orders/:id'
    ]
  });
});

// Add global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    details: process.env.NODE_ENV !== 'production' ? err.message : undefined
  });
});

// Server startup
connectToMongo().then(() => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${port}`);
    console.log('Available endpoints:');
    console.log('- GET /health - Server health check');
    console.log('- GET /test-orders - Test orders functionality');
    console.log('- GET /orders - Get all orders');
    console.log('- POST /orders - Create new order');
    console.log('- GET /orders/:id - Get specific order');
    console.log('- PUT /orders/:id - Update order');
    console.log('- DELETE /orders/:id - Delete order');
  });
}).catch((error) => {
  console.error("Failed to connect to MongoDB:", error);
  process.exit(1); // Exit if can't connect to database
});