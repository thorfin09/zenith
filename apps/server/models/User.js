const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: false
    },
    googleId: {
        type: String,
        required: false
    },
    email: {
        type: String,
        required: false
    },
    phoneNumber: {
        type: String,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    streak: {
        type: Number,
        default: 0
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    platform: {
        type: String,
        required: false
    },
    appVersion: {
        type: String,
        required: false
    },
    lastActiveAt: {
        type: Date,
        default: Date.now
    }
});

UserSchema.pre('save', function () {
    if (this.username === 'admin') {
        this.isAdmin = true;
    }
});

module.exports = mongoose.model('User', UserSchema);
