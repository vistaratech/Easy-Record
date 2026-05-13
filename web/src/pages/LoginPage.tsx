import { useState } from 'react';

import { ArrowRight, UserPlus, LogIn } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export default function LoginPage() {
  // We don't need the login function from useAuth anymore since onAuthStateChanged handles it
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
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: name });
      }
      // The onAuthStateChanged listener in AuthProvider will detect this and redirect
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email is already registered.');
      } else {
        setError(err.message || 'An error occurred during authentication');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true); setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google Sign-In failed');
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
          <span className="login-logo-badge">Excel Register Book</span>
        </div>

        <h1 className="login-title">Easy <span>Record</span></h1>
        <p className="login-sub">
          {isLogin ? 'Sign in to your account' : 'Create a new account'}
        </p>

        {error && <div className="login-error">{error}</div>}

        <button 
          type="button" 
          onClick={handleGoogleLogin} 
          disabled={loading}
          style={{
            width: '100%', padding: '0.75rem', marginBottom: '1rem', 
            background: 'white', color: '#333', border: '1px solid #ddd', 
            borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
          }}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style={{ width: 18, height: 18 }} />
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0', color: '#666' }}>
          <div style={{ flex: 1, height: '1px', background: '#ddd' }} />
          <span style={{ padding: '0 0.5rem', fontSize: '0.85rem' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: '#ddd' }} />
        </div>

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
