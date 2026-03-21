import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Book as BookIcon, Calendar, AlertCircle, CheckCircle, Bot, Send } from 'lucide-react';
import { apiGet, apiPost } from '../utils/api';

const StudentDashboard = () => {
    const { user } = useAuth();
    const [issuedBooks, setIssuedBooks] = useState([]);
    const [fines, setFines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [chatMessages, setChatMessages] = useState([
        { role: 'assistant', content: 'Hi, I am Library RAG. Ask me about books and study content.' }
    ]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [historyRes, finesRes] = await Promise.all([
                    apiGet(`/api/transactions/history/user/${user.id}`),
                    apiGet(`/api/transactions/fines/user/${user.id}`)
                ]);
                setIssuedBooks(historyRes.data.filter(i => i.status === 'issued'));
                setFines(finesRes.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user.id]);

    if (loading) return <div>Loading Profile...</div>;

    const totalFine = fines.reduce((acc, fine) => fine.status === 'unpaid' ? acc + fine.amount : acc, 0);

    const askRag = async () => {
        const query = chatInput.trim();
        if (!query || chatLoading) return;

        setChatMessages(prev => [...prev, { role: 'user', content: query }]);
        setChatInput('');
        setChatLoading(true);

        try {
            const res = await apiPost('/api/rag/chat', {
                query,
                sessionId: `student-${user.id}`
            });
            const answer = res.data?.answer || 'llm is not available';
            setChatMessages(prev => [...prev, { role: 'assistant', content: answer }]);
        } catch (err) {
            setChatMessages(prev => [...prev, { role: 'assistant', content: err.response?.data?.message || 'llm is not available' }]);
        } finally {
            setChatLoading(false);
        }
    };

    return (
        <div>
            <div style={{ marginBottom: '3rem' }}>
                <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Hello, {user.name}</h1>
                <p style={{ color: 'var(--text-muted)' }}>Manage your issued books and view your library status.</p>
            </div>

            <div className="grid-cols-3" style={{ marginBottom: '3rem' }}>
                <div className="premium-card">
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Active Issues</p>
                    <h3 style={{ fontSize: '2rem', fontWeight: 800 }}>{issuedBooks.length} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {user.maxBooks || 3}</span></h3>
                </div>
                <div className="premium-card">
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Fines Paid</p>
                    <h3 style={{ fontSize: '2rem', fontWeight: 800 }}>₹{fines.filter(f => f.status === 'paid').reduce((a, b) => a + b.amount, 0)}</h3>
                </div>
                <div className="premium-card" style={{ borderLeft: totalFine > 0 ? '4px solid var(--accent)' : '1px solid var(--border)' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Outstanding Dues</p>
                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: totalFine > 0 ? 'var(--accent)' : 'inherit' }}>₹{totalFine}</h3>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                <div className="glass" style={{ padding: '2rem' }}>
                    <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BookIcon /> Currently Issued</h2>
                    {issuedBooks.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>You don't have any books currently issued.</p>
                    ) : (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {issuedBooks.map(issue => (
                                <div key={issue._id} className="premium-card" style={{ background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h4 style={{ fontSize: '1.1rem' }}>{issue.book?.title}</h4>
                                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>By {issue.book?.author}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Due Date</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: new Date(issue.dueDate) < new Date() ? 'var(--accent)' : '#10b981', fontWeight: 600 }}>
                                            <Calendar size={16} />
                                            {new Date(issue.dueDate).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="glass" style={{ padding: '2rem' }}>
                    <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertCircle /> Fine History</h2>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {fines.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>No fine history.</p>
                        ) : (
                            fines.map(fine => (
                                <div key={fine._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                                    <div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>₹{fine.amount}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fine.issue?.book?.title}</div>
                                    </div>
                                    {fine.status === 'paid' ? (
                                        <CheckCircle size={18} color="#10b981" />
                                    ) : (
                                        <AlertCircle size={18} color="var(--accent)" />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="glass" style={{ padding: '2rem', marginTop: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Bot /> Library RAG Chatbot
                </h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Answers are shown only when the LLM is available. Otherwise you will see: llm is not available.
                </p>

                <div style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', background: 'var(--surface)', padding: '1rem', minHeight: '220px', maxHeight: '320px', overflowY: 'auto', marginBottom: '1rem' }}>
                    {chatMessages.map((msg, idx) => (
                        <div
                            key={idx}
                            style={{
                                marginBottom: '0.75rem',
                                display: 'flex',
                                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                            }}
                        >
                            <div
                                style={{
                                    maxWidth: '85%',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '0.75rem',
                                    background: msg.role === 'user' ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                                    color: msg.role === 'user' ? '#fff' : 'var(--text)',
                                    whiteSpace: 'pre-wrap'
                                }}
                            >
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {chatLoading && <div style={{ color: 'var(--text-muted)' }}>Thinking...</div>}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                askRag();
                            }
                        }}
                        placeholder="Ask Library RAG..."
                        style={{
                            flex: 1,
                            padding: '0.75rem 1rem',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '0.5rem',
                            color: 'var(--text)'
                        }}
                    />
                    <button className="btn btn-primary" onClick={askRag} disabled={chatLoading || !chatInput.trim()}>
                        <Send size={16} /> Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;
