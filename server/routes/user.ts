import { Router } from 'express';

const router = Router();

// Endpoint to get profile data
router.get('/profile', (req, res) => {
    // Logic to retrieve user profile data
    res.status(200).json({ message: 'User profile data' });
});

// Endpoint to get user data
router.get('/data', (req, res) => {
    // Logic to retrieve user data
    res.status(200).json({ message: 'User data' });
});

export default router;