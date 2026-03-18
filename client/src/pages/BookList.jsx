import { useState, useEffect } from 'react';
import { Search, Info, CheckCircle, AlertCircle, BookmarkPlus, MessageCircle, Star } from 'lucide-react';
import { apiGet, apiPost } from '../utils/api';

const BookList = () => {
    const [books, setBooks] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    const [reviews, setReviews] = useState({});
    const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });

    const getCategoryId = (category) => {
        if (!category) return '';
        if (typeof category === 'object') {
            return String(category._id || '');
        }
        return String(category);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [booksRes, catsRes] = await Promise.all([
                apiGet('/api/books'),
                apiGet('/api/books/categories')
            ]);
            setBooks(booksRes.data);
            setCategories(catsRes.data);

            // Fetch reviews for each book
            const reviewsData = {};
            await Promise.all(booksRes.data.map(async (book) => {
                try {
                    const res = await apiGet(`/api/reviews/book/${book._id}`);
                    reviewsData[book._id] = res.data;
                } catch (e) {
                    console.error(e);
                }
            }));
            setReviews(reviewsData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleBorrow = async (bookId) => {
        try {
            await apiPost(`/api/transactions/borrow/${bookId}`);
            alert('Book borrowed successfully! Check your dashboard.');
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Error borrowing book');
        }
    };

    const handleAddReview = async (e, bookId) => {
        e.preventDefault();
        try {
            await apiPost('/api/reviews', {
                bookId,
                rating: reviewForm.rating,
                comment: reviewForm.comment
            });
            alert('Review added!');
            setReviewForm({ rating: 5, comment: '' });
            fetchData();
        } catch (err) {
            alert('Error adding review');
        }
    };

    const filteredBooks = books.filter(book => {
        const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            book.author.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === '' || getCategoryId(book.category) === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div>
            <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>Browse Books</h1>

            <div className="glass" style={{ padding: '1.5rem', marginBottom: '3rem', display: 'flex', gap: '1.5rem' }}>
                <div style={{ position: 'relative', flex: 2 }}>
                    <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                    <input
                        type="text"
                        placeholder="Search books..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)' }}
                    />
                </div>
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{ flex: 1, padding: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)' }}
                >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                    ))}
                </select>
            </div>

            <div className="grid-cols-3">
                {filteredBooks.map(book => (
                    <div key={book._id} className="premium-card" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ height: '180px', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Resource</span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{book.title}</h3>
                                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '0.4rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', fontSize: '0.7rem', fontWeight: 600 }}>
                                    {book.category?.name}
                                </span>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>by {book.author}</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {book.description || 'Explore the contents of this academic resource.'}
                            </p>
                        </div>
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: book.quantity > 0 ? '#10b981' : 'var(--accent)', fontSize: '0.8rem' }}>
                                {book.quantity > 0 ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                {book.quantity > 0 ? `${book.quantity} Available` : 'Issued Out'}
                            </div>
                            <button
                                onClick={() => handleBorrow(book._id)}
                                disabled={book.quantity <= 0}
                                className="btn btn-primary"
                                style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', gap: '0.5rem', opacity: book.quantity <= 0 ? 0.5 : 1 }}
                            >
                                <BookmarkPlus size={16} />
                                Borrow
                            </button>
                        </div>

                        {/* Reviews Section */}
                        <div style={{ marginTop: '1.2rem', borderTop: '0.5px solid var(--border)', paddingTop: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.8rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                <MessageCircle size={14} />
                                <span>{reviews[book._id]?.length || 0} Review(s)</span>
                            </div>

                            <div style={{ maxHeight: '80px', overflowY: 'auto', marginBottom: '1rem' }}>
                                {reviews[book._id]?.map((review, i) => (
                                    <div key={i} style={{ marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.1rem' }}>
                                            <span style={{ fontWeight: 600 }}>{review.user?.name}</span>
                                            <div style={{ display: 'flex', color: '#fbbf24' }}>
                                                {[...Array(review.rating)].map((_, i) => <Star key={i} size={8} fill="#fbbf24" />)}
                                            </div>
                                        </div>
                                        <p style={{ color: 'var(--text-muted)' }}>{review.comment}</p>
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={(e) => handleAddReview(e, book._id)} style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    placeholder="Add feedback..."
                                    required
                                    value={reviewForm.comment}
                                    onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                                    style={{ flex: 1, padding: '0.4rem', borderRadius: '0.3rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text)' }}
                                />
                                <button type="submit" className="btn btn-outline" style={{ padding: '0.4rem' }}>
                                    <MessageCircle size={14} />
                                </button>
                            </form>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BookList;
