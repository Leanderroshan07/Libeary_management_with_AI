const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Book = require('../models/Book');
const Issue = require('../models/Issue');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { syncBooksToVectorDb } = require('../services/ragService');

// --- User Management ---
router.get('/users', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const users = await User.find({ role: 'student' }).select('-password');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.patch('/users/:id/status', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const { status } = req.body;
        const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true }).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Dashboard Stats ---
router.get('/dashboard-stats', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const totalBooks = await Book.countDocuments();
        const totalUsers = await User.countDocuments({ role: 'student' });
        const issuedBooks = await Issue.countDocuments({ status: 'issued' });
        const pendingReturns = await Issue.countDocuments({
            status: 'issued',
            dueDate: { $lt: new Date() }
        });

        res.json({
            totalBooks,
            totalUsers,
            issuedBooks,
            pendingReturns
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// --- RAG Vector DB Management ---
router.post('/rag/resync', [authMiddleware, adminMiddleware], async (_req, res) => {
    try {
        const sync = await syncBooksToVectorDb();
        res.json({
            message: 'Vector DB resynced successfully',
            chunksIndexed: sync.chunksIndexed,
        });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to resync vector DB' });
    }
});

module.exports = router;
