const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    isbn: { type: String, unique: true },
    quantity: { type: Number, default: 1 },
    totalQuantity: { type: Number, default: 1 },
    description: { type: String },
    coverImage: { type: String },
    bookFileName: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Book', bookSchema);
