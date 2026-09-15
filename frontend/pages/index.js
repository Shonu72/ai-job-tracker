import { useState } from 'react';
import { useRouter } from 'next/router';
import { api, setToken } from '../lib/api';
import { Sparkles, ArrowRight, Lock, Mail, User, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const data = await api(path, { method: 'POST', body: form });
      setToken(data.token);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '24px 20px' }}>
      
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          color: '#818cf8',
          padding: '6px 16px',
          borderRadius: 30,
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 16
        }}>
          <Sparkles size={16} /> Vertex AI Gemini 2.5 Flash Grounded
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 800, marginBottom: 12, background: 'linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          AI Job Application Tracker
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 16, maxWidth: 520, margin: '0 auto' }}>
          Track job search pipelines, generate tailored cover letters & follow-up emails, and stay on top of recruiter responses.
        </p>
      </div>

      {/* Main Glass Card */}
      <div className="glass-card" style={{ width: '100%', maxWidth: 440, padding: 32 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
            {mode === 'login' ? 'Log in to access your applications dashboard' : 'Sign up to start tracking & generating AI drafts'}
          </p>
        </div>

        {error && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-dim)' }} />
                <input
                  className="input-field"
                  style={{ paddingLeft: 42 }}
                  placeholder="Jane Doe"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-dim)' }} />
              <input
                className="input-field"
                style={{ paddingLeft: 42 }}
                placeholder="you@example.com"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-dim)' }} />
              <input
                className="input-field"
                style={{ paddingLeft: 42 }}
                placeholder="••••••••"
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
            {loading ? 'Processing...' : (
              <>
                {mode === 'login' ? 'Log In' : 'Sign Up'} <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: 13.5, color: 'var(--text-muted)' }}>
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
            style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 600, cursor: 'pointer', padding: 0, marginLeft: 4 }}
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </div>

      {/* Feature Highlights */}
      <div style={{ display: 'flex', gap: 24, marginTop: 40, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 680 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
          <CheckCircle2 size={16} color="#10b981" /> Grounded AI Generation
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
          <CheckCircle2 size={16} color="#10b981" /> Kanban Application Tracking
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
          <CheckCircle2 size={16} color="#10b981" /> Autonomous Follow-Up Nudges
        </div>
      </div>

    </div>
  );
}
