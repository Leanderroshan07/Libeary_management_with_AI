const mongoose = require('mongoose');

const fineSchema = new mongoose.Schema({
    issue: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, default: 0 },
    status: { type: String, enum: ['paid', 'unpaid'], default: 'unpaid' }
}, { timestamps: true });

module.exports = mongoose.model('Fine', fineSchema);
