import { useState, useEffect } from 'react';
import { History, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { apiGet, apiPost } from '../utils/api';

const AdminHistory = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
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
