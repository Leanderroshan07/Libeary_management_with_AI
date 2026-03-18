const DEFAULT_CATEGORIES = [
    { name: 'Biography', description: 'Biography books' },
    { name: 'Business', description: 'Business books' },
    { name: 'Computer Science', description: 'Computer Science books' },
    { name: 'History', description: 'History books' },
    { name: 'Literature', description: 'Literature books' },
    { name: 'Mathematics', description: 'Mathematics books' },
    { name: 'Philosophy', description: 'Philosophy books' },
    { name: 'Physics', description: 'Physics books' },
    { name: 'Science Fiction', description: 'Science Fiction books' },
    { name: 'Self Help', description: 'Self Help books' },
];

async function ensureDefaultCategories(CategoryModel) {
    const existing = await CategoryModel.find({}, { name: 1 }).lean();
    const existingNames = new Set(existing.map((item) => (item.name || '').trim().toLowerCase()));
    const missing = DEFAULT_CATEGORIES.filter((item) => !existingNames.has(item.name.toLowerCase()));

    if (missing.length === 0) {
        return;
    }

    try {
        await CategoryModel.insertMany(missing, { ordered: false });
    } catch (err) {
        const onlyDuplicateErrors = Array.isArray(err?.writeErrors)
            && err.writeErrors.every((entry) => entry.code === 11000);

        if (!onlyDuplicateErrors && err?.code !== 11000) {
            throw err;
        }
    }
}

module.exports = {
    DEFAULT_CATEGORIES,
    ensureDefaultCategories,
};
