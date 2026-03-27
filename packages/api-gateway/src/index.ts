import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Proxy Routes
app.get('/api/auth/status', async (req, res) => {
    try {
        const response = await axios.get('http://auth-service/api/auth/status');
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching status' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const response = await axios.post('http://auth-service/api/auth/login', req.body);
        res.json(response.data);
    } catch (error) {
        res.status(400).json({ error: 'Error logging in' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const response = await axios.post('http://auth-service/api/auth/register', req.body);
        res.json(response.data);
    } catch (error) {
        res.status(400).json({ error: 'Error registering' });
    }
});

app.get('/api/audits', async (req, res) => {
    try {
        const response = await axios.get('http://audit-service/api/audits');
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching audits' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`API Gateway listening on port ${PORT}`);
});
