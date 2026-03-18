import { useState, useEffect } from 'react';
import { Shield, ShieldOff, Search, PlusCircle, X } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../utils/api';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFineModal, setShowFineModal] = useState(false);
    const [fineForm, setFineForm] = useState({ userId: '', userName: '', amount: '', reason: '' });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await apiGet('/api/admin/users');
            setUsers(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        try {
            await apiPatch(`/api/admin/users/${id}/status`, { status: newStatus });
            fetchUsers();
        } catch (err) {
            alert('Error updating user status');
        }
    };

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const openFineModal = (user) => {
        setFineForm({ userId: user._id, userName: user.name, amount: '', reason: '' });
        setShowFineModal(true);
    };

    const addFineToUser = async (e) => {
        e.preventDefault();
        try {
            await apiPost('/api/transactions/fines/add', {
                userId: fineForm.userId,
                amount: Number(fineForm.amount),
                reason: fineForm.reason
            });

            setShowFineModal(false);
            setFineForm({ userId: '', userName: '', amount: '', reason: '' });
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.message || 'Error adding fine');
        }
    };

    return (
        <div>
            <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>User Management</h1>

            <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)' }}
                    />
                </div>
            </div>

            <div className="glass" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <th style={{ padding: '1.25rem' }}>Name</th>
                            <th style={{ padding: '1.25rem' }}>Email</th>
                            <th style={{ padding: '1.25rem' }}>Status</th>
                            <th style={{ padding: '1.25rem' }}>Books Issued</th>
                            <th style={{ padding: '1.25rem' }}>Fine Balance</th>
                            <th style={{ padding: '1.25rem' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(user => (
                            <tr key={user._id} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>
                                            {user.name.charAt(0)}
                                        </div>
                                        {user.name}
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem' }}>{user.email}</td>
                                <td style={{ padding: '1.25rem' }}>
                                    <span style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', background: user.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)', color: user.status === 'active' ? '#10b981' : 'var(--accent)', fontSize: '0.8rem' }}>
                                        {user.status}
                                    </span>
                                </td>
                                <td style={{ padding: '1.25rem' }}>{user.issuedBooks?.length || 0}</td>
                                <td style={{ padding: '1.25rem' }}>${Number(user.fineBalance || 0).toFixed(2)}</td>
                                <td style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => openFineModal(user)}
                                            className="btn btn-outline"
                                            style={{ padding: '0.5rem 1rem' }}
                                        >
                                            <PlusCircle size={16} /> Add Fine
                                        </button>
                                        <button
                                            onClick={() => toggleStatus(user._id, user.status)}
                                            className="btn btn-outline"
                                            style={{ padding: '0.5rem 1rem', color: user.status === 'active' ? 'var(--accent)' : '#10b981' }}
                                        >
                                            {user.status === 'active' ? <><ShieldOff size={16} /> Deactivate</> : <><Shield size={16} /> Activate</>}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showFineModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className="glass" style={{ padding: '2rem', width: '100%', maxWidth: '520px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2>Add Fine</h2>
                            <X onClick={() => setShowFineModal(false)} style={{ cursor: 'pointer' }} />
                        </div>
                        <form onSubmit={addFineToUser}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>User</label>
                                <input type="text" value={fineForm.userName} readOnly style={{ width: '100%', padding: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)' }} />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Fine Amount</label>
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={fineForm.amount}
                                    onChange={(e) => setFineForm({ ...fineForm, amount: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)' }}
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Reason</label>
                                <textarea
                                    value={fineForm.reason}
                                    onChange={(e) => setFineForm({ ...fineForm, reason: e.target.value })}
                                    placeholder="Optional reason"
                                    style={{ width: '100%', padding: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text)', minHeight: '90px' }}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                                Add Fine
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
