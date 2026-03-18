const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    returnDate: { type: Date },
    status: { type: String, enum: ['issued', 'returned'], default: 'issued' },
    fine: { type: mongoose.Schema.Types.ObjectId, ref: 'Fine' }
}, { timestamps: true });

module.exports = mongoose.model('Issue', issueSchema);
