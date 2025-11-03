require('dotenv').config();
console.log("Mongo URI:", process.env.MONGODB_URI);
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const base64 = require("base-64");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

//CORS setup
app.use(cors({
  origin: [
    'https://poweredbysamuel.co.za',
    'http://poweredbysamuel.co.za',
    'https://www.poweredbysamuel.co.za',
    'http://www.poweredbysamuel.co.za',
    'http://www.pbselectricalsolutions.co.za',
    'https://www.pbselectricalsolutions.co.za',
    "http://www.pbselectricalsolutions.co.za.s3.amazonaws.com",
    "https://www.pbselectricalsolutions.co.za.s3.amazonaws.com",
    'http://44.198.25.29:3000',
    'https://44.198.25.29:3000',
    // 'http://localhost:3000' // remove this if you don't want localhost
  ],

  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

//Database connection
let client, db;
async function connectToMongo() {
  if (db) return db; // Return existing connection

  client = new MongoClient(process.env.MONGODB_URI, { tls: true });
  await client.connect();
  db = client.db("PWS");
  console.log("Connected to MongoDB");
  return db;
}

/* -------------------- AUTH -------------------- */

//SIGNUP
app.post('/signup', async (req, res) => {
  try {
    const user = req.body;

    if (!user.email || !user.password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (user.password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (user.password !== user.confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const collection = db.collection("Users");
    const normalizedEmail = user.email.toLowerCase();

    const existingUser = await collection.findOne({ email: normalizedEmail });
    if (existingUser) return res.status(409).json({ error: 'Email already registered' });

    const newUser = {
      name: user.name || "",
      email: normalizedEmail,
      password: Buffer.from(user.password).toString('base64'),
      createdAt: new Date()
    };

    const result = await collection.insertOne(newUser);

    res.status(201).json({
      message: "User created successfully",
      userId: result.insertedId
    });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//SIGNIN
app.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const encodedPassword = Buffer.from(password).toString('base64');
    const user = await db.collection('Users').findOne({ email: email.toLowerCase() });

    if (!user || user.password !== encodedPassword)
      return res.status(401).json({ error: 'Invalid email or password' });

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* -------------------- USERS -------------------- */

app.get('/users', async (req, res) => {
  try {
    const users = await db.collection("Users").find({}, { projection: { password: 0 } }).toArray();
    res.status(200).json({ message: "Users fetched successfully", data: users });
  } catch (error) {
    console.error("GET /users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid user ID" });

    const updates = { ...req.body };
    if (updates.password)
      updates.password = Buffer.from(updates.password).toString('base64');

    const result = await db.collection("Users").updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0)
      return res.status(404).json({ error: "User not found" });

    res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    console.error("PUT /users error:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

app.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid user ID" });

    const result = await db.collection("Users").deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0)
      return res.status(404).json({ error: "User not found" });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("DELETE /users error:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

/* -------------------- PRODUCTS -------------------- */

app.get('/products', async (req, res) => {
  try {
    const products = await db.collection("Products").find().toArray();
    res.status(200).json({ data: products });
  } catch (error) {
    console.error("GET /products error:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.post('/products', async (req, res) => {
  try {
    const { name, description, price, category, imageUrl, stock } = req.body;
    if (!name || !price || !category)
      return res.status(400).json({ error: "Name, price, and category are required" });

    const newProduct = {
      name,
      description: description || "",
      price: parseFloat(price),
      category,
      imageUrl: imageUrl || "",
      stock: parseInt(stock) || 0,
      createdAt: new Date()
    };

    const result = await db.collection("Products").insertOne(newProduct);
    res.status(201).json({ message: "Product created", id: result.insertedId });
  } catch (error) {
    console.error("POST /products error:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

/* -------------------- CART -------------------- */

app.get('/cart', async (req, res) => {
  try {
    const cart = await db.collection("Cart").find().toArray();
    res.status(200).json({ data: cart });
  } catch (error) {
    console.error("GET /cart error:", error);
    res.status(500).json({ error: "Failed to fetch cart" });
  }
});

app.post('/cart', async (req, res) => {
  try {
    const item = req.body;
    if (!item.productId || !item.quantity)
      return res.status(400).json({ error: "Missing productId or quantity" });

    const result = await db.collection("Cart").insertOne(item);
    res.status(201).json({ message: "Item added", id: result.insertedId });
  } catch (error) {
    console.error("POST /cart error:", error);
    res.status(500).json({ error: "Failed to add to cart" });
  }
});

app.put('/cart/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    if (!quantity) return res.status(400).json({ error: "Missing quantity" });

    const result = await db.collection("Cart").updateOne(
      { productId },
      { $set: { quantity } }
    );

    if (result.matchedCount === 0)
      return res.status(404).json({ error: "Item not found" });

    res.status(200).json({ message: "Cart updated" });
  } catch (error) {
    console.error("PUT /cart error:", error);
    res.status(500).json({ error: "Failed to update cart" });
  }
});

app.delete('/cart/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await db.collection("Cart").deleteOne({ productId });

    if (result.deletedCount === 0)
      return res.status(404).json({ error: "Item not found" });

    res.status(200).json({ message: "Cart item deleted" });
  } catch (error) {
    console.error("DELETE /cart error:", error);
    res.status(500).json({ error: "Failed to delete cart item" });
  }
});

/* -------------------- ORDERS -------------------- */

app.get('/orders', async (req, res) => {
  try {
    const userId = req.query.userId;
    const filter = userId ? { userId } : {};
    const orders = await db.collection("Orders").find(filter).toArray();
    res.status(200).json({ data: orders });
  } catch (error) {
    console.error("GET /orders error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.post('/orders', async (req, res) => {
  try {
    const { userId, items, totalAmount, status = "pending", deliveryData, paymentMethod } = req.body;

    if (!userId || !Array.isArray(items) || !items.length)
      return res.status(400).json({ error: "Invalid order data" });

    const order = {
      userId,
      items,
      totalAmount: parseFloat(totalAmount),
      status,
      deliveryData: deliveryData || {},
      paymentMethod: paymentMethod || "pending",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection("Orders").insertOne(order);
    res.status(201).json({ message: "Order created", id: result.insertedId });
  } catch (error) {
    console.error("POST /orders error:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

/* -------------------- SERVER INIT -------------------- */

if (require.main === module) {
  connectToMongo()
    .then(() => {
      app.listen(port, "0.0.0.0", () => {
        console.log(`Server running on http://0.0.0.0:${port}`);
      });
    })
    .catch((err) => {
      console.error("Failed to connect to MongoDB:", err);
    });
}

// Export for testing
module.exports = { app, connectToMongo };