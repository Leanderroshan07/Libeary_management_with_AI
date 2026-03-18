import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Library, LogOut, LayoutDashboard, Book as BookIcon, Users, History, User } from 'lucide-react';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (!user) return null;

    return (
        <nav className="glass" style={{ margin: '1rem', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: '1rem', zIndex: 100 }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }}>
                <Library className="text-primary" size={28} />
                <span style={{ fontWeight: 800, fontSize: '1.25rem' }} className="text-gradient">LibPro</span>
            </Link>

            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                {user.role === 'admin' ? (
                    <>
                        <Link to="/admin" className="nav-link"><LayoutDashboard size={20} /> Dashboard</Link>
                        <Link to="/admin/books" className="nav-link"><BookIcon size={20} /> Books</Link>
                        <Link to="/admin/users" className="nav-link"><Users size={20} /> Users</Link>
                        <Link to="/admin/history" className="nav-link"><History size={20} /> History</Link>
                    </>
                ) : (
                    <>
                        <Link to="/dashboard" className="nav-link"><LayoutDashboard size={20} /> My Dashboard</Link>
                        <Link to="/books" className="nav-link"><BookIcon size={20} /> Browse</Link>
                    </>
                )}
                <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}>
                    <LogOut size={18} /> Logout
                </button>
            </div>

            <style>{`
        .nav-link {
          text-decoration: none;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 500;
          transition: color 0.2s;
        }
        .nav-link:hover {
          color: var(--text);
        }
      `}</style>
        </nav>
    );
};

export default Navbar;
