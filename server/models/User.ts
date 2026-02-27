import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    githubId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    displayName: { type: String },
    avatarUrl: { type: String },
    email: { type: String },
    accessToken: { type: String }, // Store for API calls, though session is preferred for security
    lastLogin: { type: Date, default: Date.now },
}, { timestamps: true });

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
