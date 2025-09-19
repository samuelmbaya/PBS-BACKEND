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

app.get('/orders', async (req, res) => {
  try {
    const orders = await db.collection("Orders").find().toArray();
    res.status(200).json({ message: "Orders fetched successfully", data: orders });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid order ID" });

    const order = await db.collection("Orders").findOne({ _id: new ObjectId(id) });
    if (!order) return res.status(404).json({ error: "Order not found" });

    res.status(200).json({ data: order });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

app.post('/orders', async (req, res) => {
  try {
    const { userId, items, totalAmount, status } = req.body;

    // ✅ allow totalAmount = 0 (placeholder)
    if (!userId || !items || !Array.isArray(items) || items.length === 0 || totalAmount === undefined) {
      return res.status(400).json({ error: "userId, items[], and totalAmount are required" });
    }

    const newOrder = {
      userId,
      items,
      totalAmount: parseFloat(totalAmount), // 0 is fine
      status: status || "pending",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection("Orders").insertOne(newOrder);

    res.status(201).json({ 
      message: "Order created successfully", 
      data: { _id: result.insertedId, ...newOrder } 
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.put('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid order ID" });

    const updates = { ...req.body, updatedAt: new Date() };
    delete updates._id;

    const result = await db.collection("Orders").updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) return res.status(404).json({ error: "Order not found" });

    res.status(200).json({ message: "Order updated successfully", modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ error: "Failed to update order" });
  }
});

app.delete('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid order ID" });

    const result = await db.collection("Orders").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) return res.status(404).json({ error: "Order not found" });

    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete order" });
  }
});


// ======================= REVIEWS =======================

// (keeping your reviews CRUD as is...)x

connectToMongo().then(() => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${port}`);
  });
}).catch((error) => {
  console.error("Failed to connect to MongoDB:", error);
});
