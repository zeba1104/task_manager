import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

function Register() {
  const navigate = useNavigate();

  return (
    <div className="minimal-auth-page" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100 }}>
        <ThemeToggle />
      </div>

      <motion.div
        className="minimal-auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ maxWidth: '440px', textAlign: 'center' }}
      >
        <div className="minimal-header">
          <div className="minimal-logo" style={{ background: '#fef3c7', color: '#d97706' }}>
            <ShieldAlert size={28} />
          </div>
          <h1 style={{ marginTop: '16px', fontSize: '22px' }}>Registration Restricted</h1>
          <p style={{ marginTop: '8px', lineHeight: '1.5' }}>
            Direct public registration is disabled for security and organizational hierarchy management.
          </p>
        </div>

        <div className="minimal-info-box">
          <p className="info-box-title">
            How do I get an account?
          </p>
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            <li><strong>Employees &amp; Managers:</strong> Accounts are provisioned directly by your Organization Administrator.</li>
            <li>Once created, you will receive your login credentials and temporary password via email.</li>
            <li>Please contact your company Admin or HR department to create your profile.</li>
          </ul>
        </div>

        <button
          type="button"
          className="minimal-btn"
          onClick={() => navigate('/login')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <ArrowLeft size={16} />
          Return to Sign In
        </button>

        <div className="minimal-footer" style={{ marginTop: '20px', fontSize: '12px', color: 'var(--muted, #94a3b8)' }}>
          Taskflow Enterprise Hierarchy &amp; Access Management
        </div>
      </motion.div>
    </div>
  );
}

export default Register;
