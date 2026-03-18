import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Book as BookIcon, Users, History, AlertCircle } from 'lucide-react';
import { apiGet } from '../utils/api';

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await apiGet('/api/admin/dashboard-stats');
                setStats(res.data);
            } catch (err) {
                console.error(err);
                setError(err.response?.data?.message || err.message || 'Failed to load dashboard stats');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div>Loading Stats...</div>;
    if (error) return <div>{error}</div>;
    if (!stats) return <div>No stats available right now.</div>;

    const chartData = [
        { name: 'Total Books', value: stats.totalBooks, color: '#6366f1' },
        { name: 'Issued', value: stats.issuedBooks, color: '#8b5cf6' },
        { name: 'Pending', value: stats.pendingReturns, color: '#f43f5e' },
        { name: 'Students', value: stats.totalUsers, color: '#10b981' },
    ];

    const statCards = [
        { title: 'Total Books', value: stats.totalBooks, icon: <BookIcon />, color: 'var(--primary)' },
        { title: 'Issued Books', value: stats.issuedBooks, icon: <History />, color: '#8b5cf6' },
        { title: 'Pending Returns', value: stats.pendingReturns, icon: <AlertCircle />, color: 'var(--accent)' },
        { title: 'Registered Students', value: stats.totalUsers, icon: <Users />, color: '#10b981' },
    ];

    return (
        <div style={{ padding: '1rem' }}>
            <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>Library Overview</h1>

            <div className="grid-cols-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '3rem' }}>
                {statCards.map((card, idx) => (
                    <div key={idx} className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ padding: '1rem', borderRadius: '1rem', background: `rgba(${idx === 2 ? '244, 63, 94' : '99, 102, 241'}, 0.1)`, color: card.color }}>
                            {card.icon}
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{card.title}</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{card.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <div className="glass" style={{ padding: '2rem', height: '400px' }}>
                <h2 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>Inventory Statistics</h2>
                <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" stroke="var(--text-muted)" />
                        <YAxis stroke="var(--text-muted)" />
                        <Tooltip
                            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}
                            itemStyle={{ color: 'var(--text)' }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default AdminDashboard;
