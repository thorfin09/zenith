require('dotenv').config();
const dns = require('dns');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const User = require('./models/User');
const Todo = require('./models/Todo');

const app = express();
const PORT = process.env.PORT || 5000;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Database Connection
let dbConnectionError = null;

// Enable buffering during initial startup so queries aren't rejected while connecting.
// Buffered queries will time out if the connection isn't established within 60 seconds.
mongoose.set('bufferCommands', true);
mongoose.set('bufferTimeoutMS', 60000);

const connectDB = () => {
    mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 60000 // Time out connection attempts after 60 seconds
    })
    .then(() => {
        console.log('Connected to MongoDB');
        dbConnectionError = null;
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        dbConnectionError = err;
        // If it looks like a DNS error and we haven't tried Google DNS yet, fall back and retry
        const isDnsError = err.message && (
            err.message.includes('ECONNREFUSED') || 
            err.message.includes('ENOTFOUND') || 
            err.message.includes('querySrv')
        );
        if (isDnsError && dns.setServers && !global.dnsFallbacked) {
            console.log('Detected DNS resolution failure. Retrying connection with Google DNS servers...');
            global.dnsFallbacked = true;
            try {
                dns.setServers(['8.8.8.8', '8.8.4.4']);
                connectDB();
            } catch (dnsErr) {
                console.error('Failed to set fallback DNS servers:', dnsErr);
            }
        }
    });
};
connectDB();

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token invalid or expired' });
        req.user = user;
        next();
    });
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, username, password, phoneNumber } = req.body;

        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ message: 'Username already taken' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            fullName,
            username,
            password: hashedPassword,
            phoneNumber
        });

        await user.save();
        res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: { id: user._id, username: user.username, fullName: user.fullName } });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/auth/google', async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ message: 'No credential provided' });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name } = payload;

        // Find or create user
        let user = await User.findOne({ $or: [{ googleId }, { username: email }] });

        if (!user) {
            // Create user
            user = new User({
                fullName: name,
                username: email, // Use email as username
                googleId,
                email
            });
            await user.save();
        } else if (!user.googleId) {
            // Link existing user if they have the same email but haven't signed in with Google yet
            user.googleId = googleId;
            if (!user.email) user.email = email;
            await user.save();
        }

        const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: { id: user._id, username: user.username, fullName: user.fullName } });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/auth/check-username/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        res.json({ available: !user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Todo Routes
app.get('/api/todos', authenticateToken, async (req, res) => {
    try {
        const todos = await Todo.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(todos);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/todos', authenticateToken, async (req, res) => {
    try {
        const todo = new Todo({
            userId: req.user.id,
            text: req.body.text,
            date: req.body.date || new Date().toISOString().split('T')[0] // default to local today YYYY-MM-DD
        });
        const newTodo = await todo.save();
        res.status(201).json(newTodo);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

app.patch('/api/todos/:id', authenticateToken, async (req, res) => {
    try {
        const todo = await Todo.findOne({ _id: req.params.id, userId: req.user.id });
        if (!todo) return res.status(404).json({ message: 'Todo not found' });

        if (req.body.completed !== undefined) todo.completed = req.body.completed;
        if (req.body.text !== undefined) todo.text = req.body.text;
        if (req.body.date !== undefined) todo.date = req.body.date;

        const updatedTodo = await todo.save();
        res.json(updatedTodo);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

app.delete('/api/todos/:id', authenticateToken, async (req, res) => {
    try {
        const result = await Todo.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!result) return res.status(404).json({ message: 'Todo not found' });
        res.json({ message: 'Todo deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
