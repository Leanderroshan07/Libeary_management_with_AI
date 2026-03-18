const mongoose = require('mongoose');
const User = require('./models/User');
const Category = require('./models/Category');
const Book = require('./models/Book');
const { ensureDefaultCategories } = require('./utils/defaultCategories');
require('dotenv').config();

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB for seeding...');

        // Clear existing data (Optional, handle with care)
        // await User.deleteMany({});
        // await Category.deleteMany({});
        // await Book.deleteMany({});

        // Create Admin if not exists
        const adminExists = await User.findOne({ email: 'admin@test.com' });
        if (!adminExists) {
            const admin = new User({
                name: 'System Admin',
                email: 'admin@test.com',
                password: 'password123',
                role: 'admin'
            });
            await admin.save();
            console.log('Admin user created: admin@test.com / password123');
        }

        // Create default categories
        await ensureDefaultCategories(Category);
        console.log('Default categories seeded.');

        // Create Sample Book
        const csCat = await Category.findOne({ name: 'Computer Science' });
        const bookExists = await Book.findOne({ isbn: '1234567890' });
        if (!bookExists && csCat) {
            const book = new Book({
                title: 'Introduction to Algorithms',
                author: 'Cormen, Leiserson, Rivest, Stein',
                category: csCat._id,
                isbn: '1234567890',
                quantity: 5,
                totalQuantity: 5,
                description: 'The bible of algorithms.'
            });
            await book.save();
            console.log('Sample book created.');
        }

        process.exit();
    } catch (err) {
        console.error('Seeding Error:', err);
        process.exit(1);
    }
};

seedData();
