const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const User = require('../models/User');
const Issue = require('../models/Issue');
const Fine = require('../models/Fine');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

function canAccessUserData(requestedUserId, reqUser) {
    if (!reqUser) return false;
    if (reqUser.role === 'admin') return true;
    return String(reqUser._id) === String(requestedUserId);
}

async function upsertFineForIssue(issueDoc, now = new Date()) {
    const issue = issueDoc;
    if (!issue || now <= issue.dueDate) return null;

    const diffTime = Math.abs(now - issue.dueDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const fineAmount = diffDays * (parseInt(process.env.FINE_RATE_PER_DAY, 10) || 10);

    let fine = await Fine.findOne({ issue: issue._id });
    if (!fine) {
        fine = new Fine({
            issue: issue._id,
            user: issue.user,
            amount: fineAmount,
            status: 'unpaid',
        });
    } else if (fine.status === 'unpaid') {
        fine.amount = fineAmount;
    }

    await fine.save();

    if (!issue.fine || String(issue.fine) !== String(fine._id)) {
        issue.fine = fine._id;
        await issue.save();
    }

    return fine;
}

async function syncOverdueFinesForUser(userId) {
    const overdueIssues = await Issue.find({
        user: userId,
        dueDate: { $lt: new Date() },
    });

    for (const issue of overdueIssues) {
        await upsertFineForIssue(issue);
    }
}

// --- Student Self-Borrow ---
router.post('/borrow/:bookId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user._id;
        const bookId = req.params.bookId;

        const user = await User.findById(userId);
        if (user.status === 'inactive') return res.status(403).json({ message: 'User is deactivated' });
        if (user.issuedBooks.length >= user.maxBooks) {
            return res.status(400).json({ message: `You have reached your limit of ${user.maxBooks} books` });
        }

        const book = await Book.findById(bookId);
        if (!book) return res.status(404).json({ message: 'Book not found' });
        if (book.quantity <= 0) return res.status(400).json({ message: 'Book currently out of stock' });

        // Set due date to 14 days from now
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        const issue = new Issue({
            user: userId,
            book: bookId,
            dueDate
        });

        await issue.save();

        book.quantity -= 1;
        await book.save();

        user.issuedBooks.push(issue._id);
        await user.save();

        res.status(201).json(issue);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// --- Issue Book (Admin) ---
router.post('/issue', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const { userId, bookId, dueDate } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.status === 'inactive') return res.status(403).json({ message: 'User is deactivated' });
        if (user.issuedBooks.length >= user.maxBooks) {
            return res.status(400).json({ message: `User exceeded limit of ${user.maxBooks} books` });
        }

        const book = await Book.findById(bookId);
        if (!book) return res.status(404).json({ message: 'Book not found' });
        if (book.quantity <= 0) return res.status(400).json({ message: 'Book not available' });

        const issue = new Issue({
            user: userId,
            book: bookId,
            dueDate: new Date(dueDate)
        });

        await issue.save();

        // Update Book and User
        book.quantity -= 1;
        await book.save();

        user.issuedBooks.push(issue._id);
        await user.save();

        res.status(201).json(issue);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// --- Return Book ---
router.post('/return/:issueId', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const issue = await Issue.findById(req.params.issueId);
        if (!issue || issue.status === 'returned') {
            return res.status(400).json({ message: 'Invalid issue record' });
        }

        const now = new Date();
        issue.returnDate = now;
        issue.status = 'returned';

        // Fine Calculation
        if (now > issue.dueDate) {
            await upsertFineForIssue(issue, now);
        }

        await issue.save();

        // Update Book and User
        const book = await Book.findById(issue.book);
        book.quantity += 1;
        await book.save();

        const user = await User.findById(issue.user);
        user.issuedBooks = user.issuedBooks.filter(id => id.toString() !== issue._id.toString());
        await user.save();

        res.json({ message: 'Book returned successfully', fine: issue.fine });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// --- History ---
router.get('/history/user/:userId', authMiddleware, async (req, res) => {
    try {
        if (!canAccessUserData(req.params.userId, req.user)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        await syncOverdueFinesForUser(req.params.userId);
        const history = await Issue.find({ user: req.params.userId }).populate('book');
        res.json(history);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/history/all', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const history = await Issue.find().populate('book').populate('user');
        res.json(history);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Fine Management ---
router.get('/fines/all', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const overdueIssues = await Issue.find({ dueDate: { $lt: new Date() } });
        for (const issue of overdueIssues) {
            await upsertFineForIssue(issue);
        }

        const fines = await Fine.find().populate('user').populate({
            path: 'issue',
            populate: { path: 'book' }
        });
        res.json(fines);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/fines/user/:userId', authMiddleware, async (req, res) => {
    try {
        if (!canAccessUserData(req.params.userId, req.user)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        await syncOverdueFinesForUser(req.params.userId);
        const fines = await Fine.find({ user: req.params.userId }).populate({
            path: 'issue',
            populate: { path: 'book' }
        });
        res.json(fines);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.patch('/fines/:fineId/pay', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const fine = await Fine.findByIdAndUpdate(req.params.fineId, { status: 'paid' }, { new: true });
        res.json(fine);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
