import { Router } from 'express';

const router = Router();

// GET /profile - Get user profile
router.get('/profile', (req, res) => {
    // Logic to get user profile
    res.json({ message: 'User profile data' });
});

// GET /data - Get user data
router.get('/data', (req, res) => {
    // Logic to get user data
    res.json({ message: 'User data' });
});

export default router;