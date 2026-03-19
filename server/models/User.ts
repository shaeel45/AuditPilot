import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    githubId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    displayName: { type: String },
    avatarUrl: { type: String },
    email: { type: String },
    accessToken: { type: String },
    plan: { type: String, enum: ['starter', 'pro', 'agency'], default: 'starter' },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    auditsUsed: { type: Number, default: 0 },
    pullRequestsUsed: { type: Number, default: 0 },
    lastLogin: { type: Date, default: Date.now },
}, { timestamps: true });

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
