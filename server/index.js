const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

const parseCsvEnv = (value) => String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const allowedOrigins = parseCsvEnv(process.env.CORS_ORIGIN);
const allowAllOrigins = allowedOrigins.includes('*');
const localOriginRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const corsOptions = {
    origin(origin, callback) {
        // Requests with no Origin header (curl, health checks, server-to-server)
        // should still be allowed.
        if (!origin) {
            callback(null, true);
            return;
        }

        if (localOriginRegex.test(origin)) {
            callback(null, true);
            return;
        }

        if (allowAllOrigins || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error('Not allowed by CORS'));
    },
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use('/books-files', express.static(path.join(__dirname, '..', 'Books')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/books', require('./routes/books'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/rag', require('./routes/rag'));

app.get('/', (req, res) => {
    res.send('Library Management API is running');
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'library-management-api',
    });
});

// Start Server
const BASE_PORT = Number(process.env.PORT) || 5000;

function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            const nextPort = port + 1;
            console.warn(`Port ${port} is in use. Retrying on port ${nextPort}...`);
            startServer(nextPort);
            return;
        }

        console.error('Server startup error:', err);
        process.exit(1);
    });
}

startServer(BASE_PORT);
