const mongoose = require('mongoose');

// One document = one login on one device.
const sessionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userModel: { type: String, enum: ['User', 'Worker'], required: true },

    // We store only HASHES of refresh tokens, never the token itself.
    refreshTokenHash: { type: String, required: true, index: true },
    previousRefreshTokenHash: { type: String, index: true },
    rotatedAt: { type: Date },

    userAgent: { type: String, default: '' },
    expiresAt: { type: Date, required: true }
}, { timestamps: true });

// MongoDB automatically deletes a session once expiresAt has passed.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);