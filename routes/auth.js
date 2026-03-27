const express = require('express');
const router = express.Router();

// Health check route
router.get('/status', (req, res) => {
    res.status(200).json({ message: 'API is running' });
});

// User login route
router.post('/login', (req, res) => {
    // Add login logic here
});

// User logout route
router.post('/logout', (req, res) => {
    // Add logout logic here
});

// User registration route
router.post('/register', (req, res) => {
    // Add registration logic here
});

module.exports = router;