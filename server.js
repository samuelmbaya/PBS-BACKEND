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

    // Get the user/password from http headers
    if (!authHeader || !authHeader.startsWith("Basic ")) {
        return res
            .status(401)
            .json({ message: "Authorization header missing or invalid" });
    }

    // Split the credentials into a user/password
    const base64Credentials = authHeader.split(" ")[1];
    const credentials = base64.decode(base64Credentials).split(":");
    const email = credentials[0];
    const password = credentials[1];

    // Read MongoDB
    const collection = db.collection("users");
    const user = await collection.findOne({ email });

    // If user not found
    if (!user) {
        return res.status(401).json({ message: "User not found" });
    }

    // Decode and check the password
    const decodedStoredPassword = base64.decode(user.password);
    if (decodedStoredPassword !== password) {
        return res.status(401).json({ message: "Invalid password" });
    }

    req.user = user;
    next();
}

//sign in
app.post('/signin', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for missing fields
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Encode the submitted password to match the stored one
        const encodedPassword = Buffer.from(password).toString('base64');

        // Find the user by email
        const user = await db.collection('Users').findOne({ email });

        // If user not found or password doesn't match
        if (!user || user.password !== encodedPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // If authentication is successful
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

app.post('/signup', async (req, res) => {
    try {
        const user = req.body;
        console.log(user);

        // Basic validation
        if (user.password.length < 8) throw new Error('Password must be at least 8 characters long');
        if (!user.email.includes("@")) throw new Error('Invalid email format');
        if (user.password !== user.confirmPassword) throw new Error('Passwords do not match');

        const collection = db.collection("Users");
        
        // Normalize email to lowercase for consistent checking
        const normalizedEmail = user.email.toLowerCase();
        
        // Check for existing users with same email (and username if provided)
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

        // Prepare user data for insertion
        const userData = { ...user };
        delete userData.confirmPassword;
        userData.email = normalizedEmail; // Store normalized email
        userData.password = base64.encode(user.password);
        userData.createdAt = new Date();

        // Try to insert the user
        const result = await collection.insertOne(userData);

        res.status(201).json({
            message: "User successfully created",
            user_id: result.insertedId,
        });

    } catch (error) {
        console.error(error);
        
        // Handle MongoDB duplicate key errors (when unique index exists)
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

// app.use(basicAuth);

//CART
app.get('/cart', async (req, res) => {
    try {
        const cart = await db.collection("Cart").find().toArray();
        res.status(200).json({
            message: "Cart fetched successfully",
            data: cart
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch cart items" });
    }
});

app.post('/cart', async (req, res) => {
    try {
        const newItem = req.body;

        // Optional: Validate required fields
        if (!newItem.productId || !newItem.quantity) {
            return res.status(400).json({ error: "Missing productId or quantity" });
        }

        const result = await db.collection("Cart").insertOne(newItem);

        res.status(201).json({
            message: "Item added to cart successfully",
            data: {
                _id: result.insertedId,
                ...newItem
            }
        });
    } catch (error) {
        console.error("Insert failed:", error);
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

        res.status(200).json({
            message: "Cart item updated successfully",
            updated: result.modifiedCount
        });
    } catch (error) {
        console.error("Update failed:", error);
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

        res.status(200).json({
            message: "Cart item deleted successfully",
            deleted: result.deletedCount
        });
    } catch (error) {
        console.error("Delete failed:", error);
        res.status(500).json({ error: "Failed to delete cart item" });
    }
});

//sign up

// Check Password Endpoint
app.get('/checkpassword', (req, res) => {
    const { password, confirmPassword } = req.query;
    
    if (!password || !confirmPassword) {
        return res.status(400).send('400 - Bad Request: Missing password or confirmPassword');
    }
    
    if (password !== confirmPassword) {
        return res.status(400).send('400 - Passwords do not match');
    }
    
    res.status(200).send('200 - Passwords match');
});

//users
app.get('/users', async (req, res) => {
    try {
        const users = await db.collection("Users").find({}, {
            projection: { password: 0 }  // hide password field
        }).toArray();

        res.status(200).json({
            message: "Users fetched successfully",
            data: users
        });
    } catch (error) {
        console.error("GET /users error:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

app.post('/users', async (req, res) => {
    try {
        const { name, email, password, role = "customer", test } = req.body;

        // Insert test users if test flag is true
        if (test === true) {
            const testUsers = [
                {
                    name: "Kai Samuel",
                    email: "samuecfgvhbnl@example.com",
                    password: Buffer.from("pass123").toString('base64'),
                    role: "customer",
                    createdAt: new Date()
                },
                {
                    name: "ftyguh kjhg",
                    email: "dtfg@example.com",
                    password: Buffer.from("secret456").toString('base64'),
                    role: "admin",
                    createdAt: new Date()
                },
                {
                    name: "dtfchgj nmn",
                    email: "rduhbgft@example.com",
                    password: Buffer.from("mypassword").toString('base64'),
                    role: "customer",
                    createdAt: new Date()
                }
            ];

            const result = await db.collection("Users").insertMany(testUsers);

            return res.status(201).json({
                message: "Test users created successfully",
                insertedCount: result.insertedCount,
                insertedIds: result.insertedIds
            });
        }

        // Regular single user insertion
        if (!name || !email || !password) {
            return res.status(400).json({ error: "Name, email, and password are required" });
        }

        const existingUser = await db.collection("Users").findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: "User already exists" });
        }

        const encodedPassword = Buffer.from(password).toString('base64');

        const newUser = {
            name,
            email,
            password: encodedPassword,
            role,
            createdAt: new Date()
        };

        const result = await db.collection("Users").insertOne(newUser);

        res.status(201).json({
            message: "User created successfully",
            data: { _id: result.insertedId, name, email, role }
        });
    } catch (error) {
        console.error("POST /users error:", error);
        res.status(500).json({ error: "Failed to create user" });
    }
});

app.put('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, password, ...otherFields } = req.body;

        // Validate ObjectId format
        if (!id || id.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(id)) {
            return res.status(400).json({ error: "Invalid user ID format" });
        }

        // Check if user exists
        const existingUser = await db.collection('Users').findOne({ _id: new ObjectId(id) });
        if (!existingUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prepare update data
        const updateData = { ...otherFields };

        // Handle name update
        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({ error: 'Name cannot be empty' });
            }
            updateData.name = name.trim();
        }

        // Handle email update
        if (email !== undefined) {
            if (!email || !/\S+@\S+\.\S+/.test(email)) {
                return res.status(400).json({ error: 'Valid email is required' });
            }
            
            // Check if email is already taken by another user
            const emailExists = await db.collection('Users').findOne({ 
                email, 
                _id: { $ne: new ObjectId(id) } 
            });
            
            if (emailExists) {
                return res.status(409).json({ error: 'Email already exists' });
            }
            
            updateData.email = email.toLowerCase();
        }

        // Handle password update
        if (password !== undefined) {
            if (!password || password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long' });
            }
            // Encode password to match your signin logic
            updateData.password = Buffer.from(password).toString('base64');
        }

        // Add updated timestamp
        updateData.updatedAt = new Date();

        // Remove _id from update data if present
        delete updateData._id;

        // Update the user
        const result = await db.collection('Users').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.modifiedCount === 0) {
            return res.status(400).json({ error: 'No changes were made' });
        }

        const updatedUser = await db.collection('Users').findOne(
            { _id: new ObjectId(id) },
            { projection: { password: 0 } }
        );

        res.status(200).json({
            message: 'User updated successfully',
            user: updatedUser
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        const result = await db.collection("Users").deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("DELETE /users error:", error);
        res.status(500).json({ error: "Failed to delete user" });
    }
});

// Get all products
app.get('/products', async (req, res) => {
  try {
    const products = await db.collection("Products").find().toArray();
    res.status(200).json({
      message: "Products fetched successfully",
      data: products
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Get a single product by ID
app.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const product = await db.collection("Products").findOne({ _id: new ObjectId(id) });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json({ data: product });
  } catch (error) {
    console.error("GET /products/:id error:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Create a new product
app.post('/products', async (req, res) => {
  try {
    const { name, description, price, category, imageUrl, stock } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({ error: "Name, price, and category are required" });
    }

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

    res.status(201).json({
      message: "Product created successfully",
      data: {
        _id: result.insertedId,
        name,
        price,
        category
      }
    });
  } catch (error) {
    console.error("POST /products error:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// Update a product
app.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const updates = { ...req.body };

    if (updates.price) updates.price = parseFloat(updates.price);
    if (updates.stock) updates.stock = parseInt(updates.stock);

    Object.keys(updates).forEach(key => {
      if (updates[key] === undefined || updates[key] === null || updates[key] === "") {
        delete updates[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const result = await db.collection("Products").updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json({
      message: "Product updated successfully",
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("PUT /products error:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// Delete a product
app.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const result = await db.collection("Products").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("DELETE /products error:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

app.get('/orders', async (req, res) => {
    try {
        const userId = req.query.userId;
        let filter = {};
        
        if (userId) {
            filter.userId = userId;
        }

        const orders = await db.collection("Orders").find(filter).toArray();
        res.status(200).json({
            message: "Orders fetched successfully",
            data: orders
        });
    } catch (error) {
        console.error("GET /orders error:", error);
        res.status(500).json({ error: "Failed to fetch orders" });
    }
});

// Get single order by ID
app.get('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid order ID" });
        }

        const order = await db.collection("Orders").findOne({ _id: new ObjectId(id) });

        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        res.status(200).json({ data: order });
    } catch (error) {
        console.error("GET /orders/:id error:", error);
        res.status(500).json({ error: "Failed to fetch order" });
    }
});

// Create new order - THIS IS THE MISSING ROUTE CAUSING YOUR ERROR
app.post('/orders', async (req, res) => {
    try {
        const { userId, items, totalAmount, status = "pending", deliveryData, paymentMethod } = req.body;

        // Basic validation
        if (!userId || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ 
                error: "userId and items array are required" 
            });
        }

        if (totalAmount === undefined || totalAmount === null) {
            return res.status(400).json({ 
                error: "totalAmount is required" 
            });
        }

        const newOrder = {
            userId,
            items,
            totalAmount: parseFloat(totalAmount),
            status,
            deliveryData: deliveryData || {},
            paymentMethod: paymentMethod || "pending",
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection("Orders").insertOne(newOrder);

        res.status(201).json({
            message: "Order created successfully",
            data: {
                _id: result.insertedId,
                ...newOrder
            }
        });

    } catch (error) {
        console.error("POST /orders error:", error);
        res.status(500).json({ error: "Failed to create order" });
    }
});

// Update order
app.put('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid order ID" });
        }

        const updates = { ...req.body };
        delete updates._id; // Remove _id from updates
        updates.updatedAt = new Date();

        if (updates.totalAmount) {
            updates.totalAmount = parseFloat(updates.totalAmount);
        }

        const result = await db.collection("Orders").updateOne(
            { _id: new ObjectId(id) },
            { $set: updates }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        res.status(200).json({
            message: "Order updated successfully",
            modifiedCount: result.modifiedCount
        });

    } catch (error) {
        console.error("PUT /orders error:", error);
        res.status(500).json({ error: "Failed to update order" });
    }
});

// Delete order
app.delete('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid order ID" });
        }

        const result = await db.collection("Orders").deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        res.status(200).json({ message: "Order deleted successfully" });
    } catch (error) {
        console.error("DELETE /orders error:", error);
        res.status(500).json({ error: "Failed to delete order" });
    }
});

// Fix existing collection name inconsistencies
// Update your existing order-items routes to use consistent collection names:

// Replace the existing order-items routes with these fixed versions:
app.get('/order-items', async (req, res) => {
    try {
        const items = await db.collection("OrderItems").find().toArray(); // Fixed collection name
        res.json({ message: "Order items fetched", data: items });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch order items" });
    }
});

app.post('/order-items', async (req, res) => {
    try {
        const { orderId, productId, quantity, price } = req.body;

        if (!orderId || !productId || !quantity || !price) {
            return res.status(400).json({ error: "orderId, productId, quantity, and price are required" });
        }

        const newOrderItem = {
            orderId,
            productId,
            quantity: parseInt(quantity),
            price: parseFloat(price),
            createdAt: new Date()
        };

        const result = await db.collection("OrderItems").insertOne(newOrderItem); // Fixed collection name

        res.status(201).json({
            message: "Order item created successfully",
            data: { _id: result.insertedId, ...newOrderItem }
        });
    } catch (error) {
        console.error("POST /order-items error:", error);
        res.status(500).json({ error: "Failed to create order item" });
    }
});

app.put('/order-items/:id', async (req, res) => {
    try {
        const result = await db.collection("OrderItems").updateOne( // Fixed collection name
            { _id: new ObjectId(req.params.id) },
            { $set: { ...req.body, updatedAt: new Date() } }
        );
        res.json({ message: "Order item updated", updatedCount: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ error: "Failed to update order item" });
    }
});

app.delete('/order-items/:id', async (req, res) => {
    try {
        const result = await db.collection("OrderItems").deleteOne({ _id: new ObjectId(req.params.id) }); // Fixed collection name
        if (result.deletedCount === 0) return res.status(404).json({ message: "Item not found" });
        res.json({ message: "Order item deleted", deletedCount: result.deletedCount });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete order item" });
    }
});

// Fix reviews collection name consistency
app.get('/reviews', async (req, res) => {
    try {
        const filter = {};
        if (req.query.productId) {
            filter.productId = req.query.productId;
        }

        const reviews = await db.collection("Reviews").find(filter).toArray(); // Use consistent name

        res.status(200).json({
            message: "Reviews fetched successfully",
            data: reviews
        });
    } catch (error) {
        console.error("GET /reviews error:", error);
        res.status(500).json({ error: "Failed to fetch reviews" });
    }
});

app.post('/reviews', async (req, res) => {
    try {
        const { productId, userId, rating, comment } = req.body;

        if (!productId || !userId || !rating) {
            return res.status(400).json({ error: "productId, userId, and rating are required" });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: "rating must be between 1 and 5" });
        }

        const newReview = {
            productId,
            userId,
            rating,
            comment: comment || "",
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection("Reviews").insertOne(newReview); // Use consistent name

        res.status(201).json({
            message: "Review added successfully",
            data: { _id: result.insertedId, ...newReview }
        });
    } catch (error) {
        console.error("POST /reviews error:", error);
        res.status(500).json({ error: "Failed to add review" });
    }
});

app.put('/reviews/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid review ID" });
        }

        const updates = {};
        if (req.body.rating) {
            if (req.body.rating < 1 || req.body.rating > 5) {
                return res.status(400).json({ error: "rating must be between 1 and 5" });
            }
            updates.rating = req.body.rating;
        }
        if (req.body.comment !== undefined) {
            updates.comment = req.body.comment;
        }
        updates.updatedAt = new Date();

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: "No valid fields to update" });
        }

        const result = await db.collection("Reviews").updateOne( // Use consistent name
            { _id: new ObjectId(id) },
            { $set: updates }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Review not found" });
        }

        res.status(200).json({
            message: "Review updated successfully",
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error("PUT /reviews error:", error);
        res.status(500).json({ error: "Failed to update review" });
    }
});

app.delete('/reviews/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid review ID" });
        }

        const result = await db.collection("Reviews").deleteOne({ _id: new ObjectId(id) }); // Use consistent name

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Review not found" });
        }

        res.status(200).json({ message: "Review deleted successfully" });
    } catch (error) {
        console.error("DELETE /reviews error:", error);
        res.status(500).json({ error: "Failed to delete review" });
    }
});

connectToMongo().then(() => {
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${port}`);
});
}).catch((error) => {
    console.error("Failed to connect to MongoDB:", error);
});

