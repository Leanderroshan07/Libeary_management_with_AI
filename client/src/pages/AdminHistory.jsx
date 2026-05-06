import { useState, useEffect } from 'react';
import { History, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { apiGet, apiPost } from '../utils/api';

const AdminHistory = () => {
    const [history, setHistory] = useState([]);
    const [users, setUsers] = useState([]);
    const [books, setBooks] = useState([]);
    const [issueForm, setIssueForm] = useState({ userId: '', bookId: '', dueDate: '' });
    const [loading, setLoading] = useState(true);

    const getDefaultDueDate = () => {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);
        const year = dueDate.getFullYear();
        const month = String(dueDate.getMonth() + 1).padStart(2, '0');
        const day = String(dueDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    useEffect(() => {
        fetchHistory();
        fetchIssueOptions();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await apiGet('/api/transactions/history/all');
            setHistory(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchIssueOptions = async () => {
        try {
            const [usersRes, booksRes] = await Promise.all([
                apiGet('/api/admin/users'),
                apiGet('/api/books')
            ]);
            setUsers(usersRes.data);
            setBooks(booksRes.data);
            setIssueForm(prev => ({
                ...prev,
                dueDate: prev.dueDate || getDefaultDueDate()
            }));
        } catch (err) {
            console.error(err);
        }
    };

    const handleIssueSubmit = async (e) => {
        e.preventDefault();
        try {
            await apiPost('/api/transactions/issue', {
                userId: issueForm.userId,
                bookId: issueForm.bookId,
                dueDate: issueForm.dueDate
            });
            setIssueForm({ userId: '', bookId: '', dueDate: getDefaultDueDate() });
            fetchHistory();
        } catch (err) {
            alert(err.response?.data?.message || 'Error issuing book');
        }
    };

    const handleReturn = async (id) => {
        try {
            await apiPost(`/api/transactions/return/${id}`);
            fetchHistory();
        } catch (err) {
            alert(err.response?.data?.message || 'Error returning book');
        }
    };

    return (
        <div>
            <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>Transaction History</h1>

            <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <h2 style={{ marginBottom: '0.25rem' }}>Issue Book</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Choose a user, select a book, and set the return due date before submitting.</p>
                </div>
                <form onSubmit={handleIssueSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>User</label>
                        <select
                            value={issueForm.userId}
                            onChange={(e) => setIssueForm({ ...issueForm, userId: e.target.value })}
                            style={{ width: '100%', padding: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)' }}
                            required
                        >
                            <option value="">Select user</option>
                            {users.map(user => (
                                <option key={user._id} value={user._id}>{user.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Book</label>
                        <select
                            value={issueForm.bookId}
                            onChange={(e) => setIssueForm({ ...issueForm, bookId: e.target.value })}
                            style={{ width: '100%', padding: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)' }}
                            required
                        >
                            <option value="">Select book</option>
                            {books.map(book => (
                                <option key={book._id} value={book._id}>{book.title}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Due Date</label>
                        <div style={{ position: 'relative' }}>
                            <Calendar size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="date"
                                value={issueForm.dueDate}
                                onChange={(e) => setIssueForm({ ...issueForm, dueDate: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)' }}
                                required
                            />
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '0.85rem 1rem' }}>
                        Issue Book
                    </button>
                </form>
            </div>

            <div className="glass" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <th style={{ padding: '1.25rem' }}>User</th>
                            <th style={{ padding: '1.25rem' }}>Book</th>
                            <th style={{ padding: '1.25rem' }}>Status</th>
                            <th style={{ padding: '1.25rem' }}>Dates</th>
                            <th style={{ padding: '1.25rem' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map(item => (
                            <tr key={item._id} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: '1.25rem' }}>
                                    <div style={{ fontWeight: 600 }}>{item.user?.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.user?.email}</div>
                                </td>
                                <td style={{ padding: '1.25rem' }}>{item.book?.title}</td>
                                <td style={{ padding: '1.25rem' }}>
                                    <span style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', background: item.status === 'issued' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: item.status === 'issued' ? 'var(--primary)' : '#10b981', fontSize: '0.8rem' }}>
                                        {item.status}
                                    </span>
                                </td>
                                <td style={{ padding: '1.25rem' }}>
                                    <div style={{ fontSize: '0.85rem' }}><span style={{ color: 'var(--text-muted)' }}>Issued:</span> {new Date(item.issueDate).toLocaleDateString()}</div>
                                    <div style={{ fontSize: '0.85rem' }}><span style={{ color: 'var(--text-muted)' }}>Due:</span> {new Date(item.dueDate).toLocaleDateString()}</div>
                                    {item.returnDate && <div style={{ fontSize: '0.85rem' }}><span style={{ color: 'var(--text-muted)' }}>Returned:</span> {new Date(item.returnDate).toLocaleDateString()}</div>}
                                </td>
                                <td style={{ padding: '1.25rem' }}>
                                    {item.status === 'issued' && (
                                        <button onClick={() => handleReturn(item._id)} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                                            Mark Returned
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminHistory;
