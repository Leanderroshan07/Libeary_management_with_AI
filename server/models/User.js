const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'student'], default: 'student' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  maxBooks: { type: Number, default: 3 },
  fineBalance: { type: Number, default: 0 },
  issuedBooks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Issue' }]
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  try {
    console.log('Pre-save hook started for user:', this.email);
    if (!this.isModified('password')) {
      console.log('Password not modified, skipping hash');
      return next();
    }
    console.log('Hashing password...');
    this.password = await bcrypt.hash(this.password, 10);
    console.log('Password hashed successfully');
    next();
  } catch (err) {
    console.error('Error in pre-save hook:', err);
    next(err);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
