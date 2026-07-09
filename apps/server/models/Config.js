const mongoose = require('mongoose');

const ConfigSchema = new mongoose.Schema({
    androidDownloadUrl: {
        type: String,
        default: 'https://github.com/thorfin09/zenith/releases/latest'
    },
    androidVersion: {
        type: String,
        default: '2.3.0'
    },
    iosDownloadUrl: {
        type: String,
        default: 'https://github.com/thorfin09/zenith/releases/latest'
    },
    iosVersion: {
        type: String,
        default: '2.3.0'
    },
    windowsDownloadUrl: {
        type: String,
        default: 'https://github.com/thorfin09/zenith/releases/latest'
    },
    windowsVersion: {
        type: String,
        default: '2.3.0'
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Config', ConfigSchema);
