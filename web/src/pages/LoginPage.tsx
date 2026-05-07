import { useState, useRef } from 'react';
import { useAuth } from '../lib/auth';
import { sendOtp, verifyOtp } from '../lib/api';
import { ArrowRight, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleSendOtp = async () => {
    if (phone.length < 10) { setError('Enter a valid phone number'); return; }
    setLoading(true); setError('');
    try {
      await sendOtp(phone);
      setStep('otp');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) { setError('Enter the full 6-digit OTP'); return; }
    setLoading(true); setError('');
    try {
      const result = await verifyOtp(phone, code);
      login(result.token, result.user);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        {/* School Logo + Badge */}
        <div className="login-logo-wrap">
          <img
            src="/logo-transparent.png"
            alt="AG Trust Logo"
            className="login-logo-img"
          />
          <span className="login-logo-badge">Trusted Partner</span>
        </div>

        <h1 className="login-title">AG <span>Trust</span></h1>
        <p className="login-sub">
          {step === 'phone'
            ? 'Enter your phone number to get started'
            : `Enter the OTP sent to +91 ${phone}`}
        </p>

        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <>
            <label className="login-label">Phone Number</label>
            <div className="login-input-group">
              <span className="login-prefix">+91</span>
              <input
                className="login-input"
                type="tel"
                placeholder="Enter 10-digit number"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                autoFocus
              />
            </div>
            <button className="login-btn" onClick={handleSendOtp} disabled={loading}>
              {loading ? <div className="spinner" /> : <><span>Get OTP</span><ArrowRight size={16} /></>}
            </button>
          </>
        ) : (
          <>
            <label className="login-label">Verification Code</label>
            <div className="otp-input-row">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  className="otp-box"
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  title={`OTP digit ${i + 1}`}
                  aria-label={`OTP digit ${i + 1} of 6`}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  autoFocus={i === 0}
                />
              ))}
            </div>
            <p className="login-resend">
              Didn't receive? <button onClick={() => sendOtp(phone)}>Resend OTP</button>
            </p>
            <button className="login-btn" onClick={handleVerifyOtp} disabled={loading}>
              {loading ? <div className="spinner" /> : <><KeyRound size={16} /><span>Verify &amp; Login</span></>}
            </button>
          </>
        )}

        <p className="login-devnote">
          Dev mode: any OTP works
        </p>
      </div>
    </div>
  );
}
