import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, X, RefreshCw } from 'lucide-react';
import { apiDelete, apiGet, apiPost, apiPut, buildBackendUrl } from '../utils/api';

const BookManagement = () => {
    const [books, setBooks] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentBook, setCurrentBook] = useState({ title: '', author: '', isbn: '', category: '', quantity: 1, description: '' });
    const [bookFile, setBookFile] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [syncNotice, setSyncNotice] = useState('');
    const [resyncLoading, setResyncLoading] = useState(false);

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
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append('title', currentBook.title || '');
            formData.append('author', currentBook.author || '');
            formData.append('isbn', currentBook.isbn || '');
            formData.append('category', getCategoryId(currentBook.category));
            formData.append('quantity', String(currentBook.quantity || 1));
            formData.append('description', currentBook.description || '');

            if (bookFile) {
                formData.append('bookFile', bookFile);
            }

            let res;
            if (currentBook._id) {
                res = await apiPut(`/api/books/${currentBook._id}`, formData);
            } else {
                res = await apiPost('/api/books', formData);
            }
            if (res?.data?.message) {
                setSyncNotice(res.data.message);
            } else {
                setSyncNotice('Book saved');
            }
            setShowModal(false);
            setCurrentBook({ title: '', author: '', isbn: '', category: '', quantity: 1, description: '' });
            setBookFile(null);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Error saving book');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this book?')) {
            try {
                await apiDelete(`/api/books/${id}`);
                fetchData();
            } catch (err) {
                alert('Error deleting book');
            }
        }
    };

    const handleResyncVectorDb = async () => {
        if (resyncLoading) return;
        setResyncLoading(true);
        try {
            const res = await apiPost('/api/admin/rag/resync');
            const chunksIndexed = res?.data?.chunksIndexed;
            setSyncNotice(chunksIndexed != null
                ? `Vector DB resynced successfully (${chunksIndexed} chunks indexed)`
                : (res?.data?.message || 'Vector DB resynced successfully'));
        } catch (err) {
            const serverData = err.response?.data;
            const detailedMessage =
                serverData?.message ||
                serverData?.detail ||
                (typeof serverData === 'string' ? serverData : '') ||
                err.message ||
                'Failed to resync vector DB';
            setSyncNotice(`Failed to resync vector DB: ${detailedMessage}`);
        } finally {
            setResyncLoading(false);
        }
    };

    const filteredBooks = books.filter(book =>
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="text-gradient" style={{ fontSize: '2.5rem' }}>Book Management</h1>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={handleResyncVectorDb}
                        className="btn btn-outline"
                        disabled={resyncLoading}
                    >
                        <RefreshCw size={18} />
                        {resyncLoading ? 'Resyncing...' : 'Resync Vector DB'}
                    </button>
                    <button onClick={() => { setCurrentBook({ title: '', author: '', isbn: '', category: '', quantity: 1, description: '' }); setBookFile(null); setShowModal(true); }} className="btn btn-primary">
                        <Plus size={20} /> Add New Book
                    </button>
                </div>
            </div>

            <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                    <input
                        type="text"
                        placeholder="Search by title or author..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)' }}
                    />
                </div>
            </div>

            {syncNotice && (
                <div className="glass" style={{ padding: '1rem 1.25rem', marginBottom: '1rem', borderLeft: '4px solid #10b981' }}>
                    {syncNotice}
                </div>
            )}

            <div className="glass" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <th style={{ padding: '1.25rem' }}>Title</th>
                            <th style={{ padding: '1.25rem' }}>Author</th>
                            <th style={{ padding: '1.25rem' }}>Category</th>
                            <th style={{ padding: '1.25rem' }}>File</th>
                            <th style={{ padding: '1.25rem' }}>Stock</th>
                            <th style={{ padding: '1.25rem' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBooks.map(book => (
                            <tr key={book._id} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: '1.25rem' }}>
                                    <div style={{ fontWeight: 600 }}>{book.title}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ISBN: {book.isbn}</div>
                                </td>
                                <td style={{ padding: '1.25rem' }}>{book.author}</td>
                                <td style={{ padding: '1.25rem' }}>
                                    <span style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', fontSize: '0.8rem' }}>
                                        {book.category?.name}
                                    </span>
                                </td>
                                <td style={{ padding: '1.25rem' }}>
                                    {book.bookFileName ? (
                                        <a href={buildBackendUrl(`/books-files/${encodeURIComponent(book.bookFileName)}`)} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                                            {book.bookFileName}
                                        </a>
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>No file</span>
                                    )}
                                </td>
                                <td style={{ padding: '1.25rem' }}>{book.quantity} / {book.totalQuantity}</td>
                                <td style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={() => { setCurrentBook(book); setBookFile(null); setShowModal(true); }} className="btn btn-outline" style={{ padding: '0.5rem' }}><Edit size={16} /></button>
                                        <button onClick={() => handleDelete(book._id)} className="btn btn-outline" style={{ padding: '0.5rem', color: 'var(--accent)' }}><Trash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className="glass" style={{ padding: '2rem', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2>{currentBook._id ? 'Edit Book' : 'Add New Book'}</h2>
                            <X onClick={() => { setShowModal(false); setBookFile(null); }} style={{ cursor: 'pointer' }} />
                        </div>
                        <form onSubmit={handleSave}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Title</label>
                                    <input type="text" value={currentBook.title} onChange={e => setCurrentBook({ ...currentBook, title: e.target.value })} style={{ width: '100%', padding: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)' }} required />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Author</label>
                                    <input type="text" value={currentBook.author} onChange={e => setCurrentBook({ ...currentBook, author: e.target.value })} style={{ width: '100%', padding: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)' }} required />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>ISBN</label>
                                    <input type="text" value={currentBook.isbn} onChange={e => setCurrentBook({ ...currentBook, isbn: e.target.value })} style={{ width: '100%', padding: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Category</label>
                                    <select value={getCategoryId(currentBook.category)} onChange={e => setCurrentBook({ ...currentBook, category: e.target.value })} style={{ width: '100%', padding: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)' }} required>
                                        <option value="">Select Category</option>
                                        {categories.map(cat => (
                                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Quantity</label>
                                <input type="number" value={currentBook.quantity} onChange={e => setCurrentBook({ ...currentBook, quantity: parseInt(e.target.value) })} style={{ width: '100%', padding: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)' }} required min="1" />
                            </div>
                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Description</label>
                                <textarea value={currentBook.description} onChange={e => setCurrentBook({ ...currentBook, description: e.target.value })} style={{ width: '100%', padding: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)', minHeight: '100px' }} />
                            </div>
                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Book File (TXT for RAG)</label>
                                <input
                                    type="file"
                                    accept=".txt,text/plain"
                                    onChange={(e) => setBookFile(e.target.files?.[0] || null)}
                                    style={{ width: '100%', padding: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)' }}
                                />
                                {currentBook.bookFileName && !bookFile && (
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Current: {currentBook.bookFileName}
                                    </div>
                                )}
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Save Book</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookManagement;
