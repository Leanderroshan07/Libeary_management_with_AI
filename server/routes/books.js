const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Book = require('../models/Book');
const Category = require('../models/Category');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { syncBooksToVectorDb } = require('../services/ragService');
const { ensureDefaultCategories } = require('../utils/defaultCategories');

const BOOKS_DIR = path.join(__dirname, '..', '..', 'Books');

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, BOOKS_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '.txt');
        const base = path.basename(file.originalname || 'book', ext)
            .replace(/[^a-zA-Z0-9-_ ]/g, '')
            .replace(/\s+/g, '_')
            .slice(0, 80) || 'book';
        cb(null, `${Date.now()}_${base}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (ext !== '.txt' && file.mimetype !== 'text/plain') {
            return cb(new Error('Only .txt files are supported for RAG ingestion'));
        }
        return cb(null, true);
    },
});

function removeLocalBookFile(fileName) {
    if (!fileName) return;
    const filePath = path.join(BOOKS_DIR, fileName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

function parseBookPayload(body) {
    const quantity = Number.parseInt(body.quantity, 10);
    const isbn = (body.isbn || '').trim();
    return {
        title: body.title,
        author: body.author,
        category: body.category,
        isbn: isbn || undefined,
        description: body.description || '',
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    };
}

function isDuplicateIsbnError(err) {
    return err && err.code === 11000 && err.keyPattern && err.keyPattern.isbn;
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Category Routes ---

router.post('/categories', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const name = (req.body?.name || '').trim();
        const description = (req.body?.description || '').trim();
        if (!name) {
            return res.status(400).json({ message: 'Category name is required' });
        }

        const existingCategory = await Category.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } });
        if (existingCategory) {
            return res.status(409).json({ message: 'Category already exists' });
        }

        const category = new Category({ name, description });
        await category.save();
        res.status(201).json(category);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/categories', async (req, res) => {
    try {
        await ensureDefaultCategories(Category);
        const categories = await Category.find().sort({ name: 1 });
        res.json(categories);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Book Routes ---

router.post('/', [authMiddleware, adminMiddleware, upload.single('bookFile')], async (req, res) => {
    try {
        const payload = parseBookPayload(req.body);
        const book = new Book(payload);
        // Set totalQuantity to same as quantity initially
        book.totalQuantity = book.quantity;
        if (req.file) {
            book.bookFileName = req.file.filename;
        }
        await book.save();

        if (req.file) {
            const sync = await syncBooksToVectorDb();
            return res.status(201).json({
                ...book.toObject(),
                message: 'book add in vector db',
                chunksIndexed: sync.chunksIndexed,
            });
        }

        return res.status(201).json(book);
    } catch (err) {
        if (isDuplicateIsbnError(err)) {
            return res.status(409).json({ message: 'ISBN already exists. Use a different ISBN or edit the existing book.' });
        }
        res.status(500).json({ message: err.message || 'Server error' });
    }
});

router.get('/', async (req, res) => {
    try {
        const { title, author, category } = req.query;
        let query = {};
        if (title) query.title = { $regex: title, $options: 'i' };
        if (author) query.author = { $regex: author, $options: 'i' };
        if (category) query.category = category;

        const books = await Book.find(query).populate('category');
        res.json(books);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/:id', [authMiddleware, adminMiddleware, upload.single('bookFile')], async (req, res) => {
    try {
        const payload = parseBookPayload(req.body);
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ message: 'Book not found' });

        Object.assign(book, payload);
        if (typeof payload.quantity === 'number') {
            book.totalQuantity = Math.max(book.totalQuantity || 0, payload.quantity);
        }
        const previousFileName = book.bookFileName;
        if (req.file) {
            book.bookFileName = req.file.filename;
        }

        await book.save();

        if (req.file) {
            if (previousFileName && previousFileName !== req.file.filename) {
                removeLocalBookFile(previousFileName);
            }
            const sync = await syncBooksToVectorDb();
            return res.json({
                ...book.toObject(),
                message: 'book add in vector db',
                chunksIndexed: sync.chunksIndexed,
            });
        }

        return res.json(book);
    } catch (err) {
        if (isDuplicateIsbnError(err)) {
            return res.status(409).json({ message: 'ISBN already exists. Use a different ISBN or edit the existing book.' });
        }
        res.status(500).json({ message: err.message || 'Server error' });
    }
});

router.delete('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const book = await Book.findByIdAndDelete(req.params.id);
        if (!book) return res.status(404).json({ message: 'Book not found' });

        if (book.bookFileName) {
            removeLocalBookFile(book.bookFileName);
            const sync = await syncBooksToVectorDb();
            return res.json({
                message: 'Book deleted and vector db synced',
                chunksIndexed: sync.chunksIndexed,
            });
        }

        res.json({ message: 'Book deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.use((err, _req, res, next) => {
    if (err instanceof multer.MulterError || /Only \.txt files/.test(err.message)) {
        return res.status(400).json({ message: err.message });
    }
    return next(err);
});

module.exports = router;
