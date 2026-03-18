const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
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
