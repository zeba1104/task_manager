import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { motion } from 'framer-motion';
import { CheckSquare, AlertCircle, CircleDashed, CheckCircle2, Mail, KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

function Login() {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await api.post('/auth/login', formData);
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || (err.request
                ? 'Unable to reach the server. Check that the backend is running and connected to its database.'
                : 'Login failed. Please check your credentials.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="minimal-auth-page" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100 }}>
                <ThemeToggle />
            </div>

            {/* Floating Task 1 */}
            <motion.div
                className="floating-task"
                style={{ top: '15%', left: '10%' }}
                animate={{ y: [0, -15, 0], rotate: [-1, 1, -1] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            >
                <CheckCircle2 className="floating-task-icon completed" size={20} />
                <div className="floating-task-content">
                    <div className="floating-task-title" style={{ width: '90%' }}></div>
                    <div className="floating-task-subtitle" style={{ width: '70%' }}></div>
                    <div className="floating-avatar" style={{ background: '#3b82f6' }}></div>
                </div>
            </motion.div>

            {/* Floating Task 2 */}
            <motion.div
                className="floating-task"
                style={{ bottom: '20%', right: '12%' }}
                animate={{ y: [0, 20, 0], rotate: [2, -1, 2] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            >
                <CircleDashed className="floating-task-icon" size={20} />
                <div className="floating-task-content">
                    <div className="floating-task-title" style={{ width: '80%' }}></div>
                    <div className="floating-task-subtitle" style={{ width: '50%' }}></div>
                    <div className="floating-avatar" style={{ background: '#10b981' }}></div>
                </div>
            </motion.div>

            <motion.div
                className="minimal-auth-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
            >
                <div className="minimal-header">
                    <div className="minimal-logo">
                        <CheckSquare size={24} />
                    </div>
                    <h1>Welcome back</h1>
                    <p>Enter your workplace credentials to access Taskflow.</p>
                </div>

                {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="minimal-error">
                        <AlertCircle size={16} />
                        {error}
                    </motion.div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="minimal-input-group">
                        <div className="minimal-input-wrapper">
                            <Mail className="minimal-input-icon" size={18} />
                            <input
                                type="email"
                                id="email"
                                name="email"
                                placeholder=" "
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                            <label htmlFor="email">Email Address</label>
                            <span className="minimal-input-line"></span>
                        </div>
                    </div>

                    <div className="minimal-input-group">
                        <div className="minimal-input-wrapper">
                            <KeyRound className="minimal-input-icon" size={18} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                name="password"
                                placeholder=" "
                                value={formData.password}
                                onChange={handleChange}
                                required
                            />
                            <label htmlFor="password">Password</label>
                            <span className="minimal-input-line"></span>
                            <button
                                type="button"
                                className="minimal-password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label="Toggle password visibility"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="minimal-btn" disabled={loading}>
                        {loading ? 'Logging in...' : 'Continue to Dashboard'}
                    </button>
                </form>

                <div className="minimal-admin-notice">
                    <ShieldCheck size={18} className="notice-icon" />
                    <span>All accounts are provisioned exclusively by your Organization Administrator. Contact your Admin or HR department for sign-in assistance.</span>
                </div>
            </motion.div>
        </div>
    );
}

export default Login;
