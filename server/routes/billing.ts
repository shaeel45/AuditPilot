import express from 'express';

const router = express.Router();

// Endpoint for `/plan`
router.get('/plan', (req, res) => {
    res.json({ message: 'Plan endpoint' });
});

// Endpoint for `/subscription-limit`
router.get('/subscription-limit', (req, res) => {
    res.json({ message: 'Subscription limit endpoint' });
});

export default router;