const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const { authMiddleware } = require('../middleware/auth');

// Add Review
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { bookId, rating, comment } = req.body;
        const review = new Review({
            book: bookId,
            user: req.user._id,
            rating,
            comment
        });
        await review.save();
        res.status(201).json(review);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Reviews for a Book
router.get('/book/:bookId', async (req, res) => {
    try {
        const reviews = await Review.find({ book: req.params.bookId }).populate('user', 'name');
        res.json(reviews);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
