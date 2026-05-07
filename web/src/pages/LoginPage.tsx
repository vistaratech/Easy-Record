import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { login as loginApi, signup as signupApi } from '../lib/api';
import { ArrowRight, UserPlus, LogIn } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required'); return; }
    if (!isLogin && !name) { setError('Name is required'); return; }
    
    setLoading(true); setError('');
    try {
      const result = isLogin 
        ? await loginApi(email, password)
        : await signupApi(name, email, password);
      login(result.token, result.user);
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo Section */}
        <div className="login-logo-wrap">
          <img
            src="/logo.jpg"
            alt="Easy Record Logo"
            className="login-logo-img"
          />
          <span className="login-logo-badge">Trusted Partner</span>
        </div>

        <h1 className="login-title">Easy <span>Record</span></h1>
        <p className="login-sub">
          {isLogin ? 'Sign in to your account' : 'Create a new account'}
        </p>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="login-field">
              <label className="login-label">Full Name</label>
              <div className="login-input-group no-prefix">
                <input
                  className="login-input"
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus={!isLogin}
                  required
                />
              </div>
            </div>
          )}

          <div className="login-field">
            <label className="login-label">Email Address</label>
            <div className="login-input-group no-prefix">
              <input
                className="login-input"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus={isLogin}
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-label">Password</label>
            <div className="login-input-group no-prefix">
              <input
                className="login-input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? (
              <div className="spinner" />
            ) : (
              <>
                {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                <span>{isLogin ? 'Login' : 'Create Account'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="login-toggle">
          {isLogin ? (
            <p>Don't have an account? <button type="button" onClick={() => { setIsLogin(false); setError(''); }}>Create Account</button></p>
          ) : (
            <p>Already have an account? <button type="button" onClick={() => { setIsLogin(true); setError(''); }}>Login</button></p>
          )}
        </div>
      </div>
    </div>
  );
}
