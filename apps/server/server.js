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
const Config = require('./models/Config');

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

// Update user active streak helper
const updateUserStreak = async (userId) => {
    try {
        const todos = await Todo.find({ userId });
        const uniqueDates = Array.from(new Set(todos.map(t => t.date))).sort().reverse();

        if (uniqueDates.length === 0) {
            await User.findByIdAndUpdate(userId, { streak: 0 });
            return 0;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
            await User.findByIdAndUpdate(userId, { streak: 0 });
            return 0;
        }

        let streak = 1;
        for (let i = 0; i < uniqueDates.length - 1; i++) {
            const d1 = new Date(uniqueDates[i]);
            const d2 = new Date(uniqueDates[i + 1]);
            const diffTime = Math.abs(d1 - d2);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                streak++;
            } else if (diffDays > 1) {
                break;
            }
        }

        await User.findByIdAndUpdate(userId, { streak });
        return streak;
    } catch (e) {
        console.error('Error updating streak:', e);
        return 0;
    }
};

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
        res.json({ token, user: { id: user._id, username: user.username, fullName: user.fullName, isAdmin: user.isAdmin, streak: user.streak } });
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
        res.json({ token, user: { id: user._id, username: user.username, fullName: user.fullName, isAdmin: user.isAdmin, streak: user.streak } });
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
        await updateUserStreak(req.user.id);
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
        await updateUserStreak(req.user.id);
        res.json(updatedTodo);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

app.delete('/api/todos/:id', authenticateToken, async (req, res) => {
    try {
        const result = await Todo.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!result) return res.status(404).json({ message: 'Todo not found' });
        await updateUserStreak(req.user.id);
        res.json({ message: 'Todo deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Sync user active status routes
app.post('/api/users/active', authenticateToken, async (req, res) => {
    try {
        const { platform, version, theme } = req.body;
        const updateFields = {
            platform,
            appVersion: version,
            lastActiveAt: new Date()
        };
        if (theme) {
            updateFields.theme = theme;
        }
        const user = await User.findByIdAndUpdate(req.user.id, updateFields, { new: true });
        
        const currentStreak = await updateUserStreak(req.user.id);
        res.json({ success: true, streak: currentStreak, isAdmin: user.isAdmin });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Leaderboard route
app.get('/api/leaderboard', async (req, res) => {
    try {
        const topUsers = await User.find({ streak: { $gt: 0 } }, 'fullName username streak')
            .sort({ streak: -1 })
            .limit(50);
        res.json(topUsers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// System config route (public)
app.get('/api/config', async (req, res) => {
    try {
        let config = await Config.findOne();
        if (!config) {
            config = new Config();
            await config.save();
        }
        res.json(config);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update system config route (admin only)
app.put('/api/config', authenticateToken, async (req, res) => {
    try {
        const requestingUser = await User.findById(req.user.id);
        if (!requestingUser || !requestingUser.isAdmin) {
            return res.status(403).json({ message: 'Admin access required' });
        }

        let config = await Config.findOne();
        if (!config) {
            config = new Config();
        }

        const {
            androidDownloadUrl,
            androidVersion,
            iosDownloadUrl,
            iosVersion,
            windowsDownloadUrl,
            windowsVersion
        } = req.body;

        if (androidDownloadUrl !== undefined) config.androidDownloadUrl = androidDownloadUrl;
        if (androidVersion !== undefined) config.androidVersion = androidVersion;
        if (iosDownloadUrl !== undefined) config.iosDownloadUrl = iosDownloadUrl;
        if (iosVersion !== undefined) config.iosVersion = iosVersion;
        if (windowsDownloadUrl !== undefined) config.windowsDownloadUrl = windowsDownloadUrl;
        if (windowsVersion !== undefined) config.windowsVersion = windowsVersion;
        config.updatedAt = new Date();

        const updatedConfig = await config.save();
        res.json(updatedConfig);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Admin list users route (admin only)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        const requestingUser = await User.findById(req.user.id);
        if (!requestingUser || !requestingUser.isAdmin) {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const users = await User.find({}, 'fullName username email phoneNumber streak isAdmin platform appVersion lastActiveAt createdAt theme')
            .sort({ lastActiveAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Admin fetch specific user's todos route (admin only)
app.get('/api/admin/users/:id/todos', authenticateToken, async (req, res) => {
    try {
        const requestingUser = await User.findById(req.user.id);
        if (!requestingUser || !requestingUser.isAdmin) {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const todos = await Todo.find({ userId: req.params.id }).sort({ date: -1, createdAt: -1 });
        res.json(todos);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Admin fetch dashboard statistics route (admin only)
app.get('/api/admin/dashboard-stats', authenticateToken, async (req, res) => {
    try {
        const requestingUser = await User.findById(req.user.id);
        if (!requestingUser || !requestingUser.isAdmin) {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const totalUsers = await User.countDocuments();
        
        // Active in last 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
        const activeUsers = await User.countDocuments({ lastActiveAt: { $gte: sevenDaysAgo } });

        // Avg streak
        const streakStats = await User.aggregate([
            { $group: { _id: null, avgStreak: { $avg: '$streak' } } }
        ]);
        const avgStreak = streakStats.length > 0 ? Math.round(streakStats[0].avgStreak * 10) / 10 : 0;

        // Platform distribution
        const platformStats = await User.aggregate([
            { $group: { _id: '$platform', count: { $sum: 1 } } }
        ]);
        const platforms = {};
        platformStats.forEach(stat => {
            const platformName = stat._id || 'unknown';
            platforms[platformName] = stat.count;
        });

        // Theme distribution
        const themeStats = await User.aggregate([
            { $group: { _id: '$theme', count: { $sum: 1 } } }
        ]);
        const themes = {};
        themeStats.forEach(stat => {
            const themeName = stat._id || 'light';
            themes[themeName] = stat.count;
        });

        // Total goals & completion rate
        const totalTodos = await Todo.countDocuments();
        const completedTodos = await Todo.countDocuments({ completed: true });
        const completionRate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

        res.json({
            totalUsers,
            activeUsers,
            avgStreak,
            platforms,
            themes,
            totalTodos,
            completionRate
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
