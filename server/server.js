require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const Todo = require('./models/Todo');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

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

        const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
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
            text: req.body.text
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
