import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const API_BASE_URLS = [
    import.meta.env.VITE_API_BASE_URL,
    'http://localhost:5001',
    'http://localhost:5002',
    'http://localhost:5000'
].filter(Boolean);

const isNetworkError = (err) => !err.response;

const postWithFallback = async (path, payload) => {
    let lastNetworkError = null;

    for (const baseUrl of API_BASE_URLS) {
        try {
            return await axios.post(`${baseUrl}${path}`, payload);
        } catch (err) {
            if (!isNetworkError(err)) {
                throw err;
            }
            lastNetworkError = err;
        }
    }

    throw lastNetworkError || new Error('Unable to connect to backend API');
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            const storedUser = JSON.parse(localStorage.getItem('user'));
            setUser(storedUser);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const res = await postWithFallback('/api/auth/login', { email, password });
        const { token, user: userData } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(userData);
        return userData;
    };

    const register = async (name, email, password, role) => {
        const res = await postWithFallback('/api/auth/register', { name, email, password, role });
        const { token, user: userData } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(userData);
        return userData;
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
