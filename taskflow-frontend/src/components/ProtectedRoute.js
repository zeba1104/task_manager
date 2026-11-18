import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children }) {
    const { user } = useAuth();
    const token = localStorage.getItem('token');

    if (!user && !token) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

export default ProtectedRoute;