import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Pages (to be created)
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import BookManagement from './pages/BookManagement';
import UserManagement from './pages/UserManagement';
import StudentDashboard from './pages/StudentDashboard';
import BookList from './pages/BookList';
import AdminHistory from './pages/AdminHistory';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <main className="container">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Student Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
            <Route path="/books" element={<ProtectedRoute><BookList /></ProtectedRoute>} />

            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/books" element={<ProtectedRoute adminOnly><BookManagement /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute adminOnly><UserManagement /></ProtectedRoute>} />
            <Route path="/admin/history" element={<ProtectedRoute adminOnly><AdminHistory /></ProtectedRoute>} />

            <Route path="/" element={<Navigate to="/login" />} />
          </Routes>
        </main>
      </Router>
    </AuthProvider>
  );
}

export default App;
