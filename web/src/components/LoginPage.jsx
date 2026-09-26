import { useState } from 'react';
import { Activity, Lock, User as UserIcon, LogIn, AlertCircle } from 'lucide-react';
import apiClient from '../services/appClient';
import { setSession } from '../services/auth';
import { C, button, input } from '../theme';

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('officer');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.post('/auth/login', { username, password });
      if (res.data?.success) {
        const session = { token: res.data.data.token, user: res.data.data.user };
        setSession(session);
        onLogin(session);
      } else {
        setError(res.data?.error || 'Login failed.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Unable to reach the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(circle at 20% 20%, rgba(102,126,234,0.18), transparent 45%), radial-gradient(circle at 80% 80%, rgba(118,75,162,0.18), transparent 45%), ${C.bg}`,
        padding: '24px',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: '400px',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: '20px',
          padding: '36px 32px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})`,
              marginBottom: '16px',
            }}
          >
            <Activity size={28} color="#fff" />
          </div>
          <h1 style={{ margin: 0, color: C.textStrong, fontSize: '22px', fontWeight: 700 }}>SRMS Portal</h1>
          <p style={{ margin: '6px 0 0', color: C.textDim, fontSize: '13px' }}>
            Municipal officers &amp; field workers sign in here
          </p>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: `${C.red}18`,
              border: `1px solid ${C.red}55`,
              borderRadius: '10px',
              padding: '10px 12px',
              color: C.red,
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <label style={{ display: 'block', color: C.textDim, fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
          USERNAME
        </label>
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <UserIcon size={15} color={C.textFaint} style={{ position: 'absolute', left: '12px', top: '12px' }} />
          <input
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="officer"
            style={{ ...input, paddingLeft: '34px' }}
          />
        </div>

        <label style={{ display: 'block', color: C.textDim, fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
          PASSWORD
        </label>
        <div style={{ position: 'relative', marginBottom: '24px' }}>
          <Lock size={15} color={C.textFaint} style={{ position: 'absolute', left: '12px', top: '12px' }} />
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            style={{ ...input, paddingLeft: '34px' }}
          />
        </div>

        <button
          id="login-submit"
          type="submit"
          disabled={loading}
          style={{
            ...button(C.purple, loading),
            width: '100%',
            padding: '11px 14px',
            background: loading ? `${C.purple}22` : `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})`,
            border: 'none',
            color: '#fff',
          }}
        >
          <LogIn size={16} />
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <div style={{ margin: '20px 0 0', textAlign: 'center', color: C.textFaint, fontSize: '12px', lineHeight: 1.8 }}>
          <div>
            Officer — <strong style={{ color: C.textDim }}>officer</strong> / <strong style={{ color: C.textDim }}>officer123</strong>
          </div>
          <div>
            Worker — <strong style={{ color: C.textDim }}>nimal</strong> / <strong style={{ color: C.textDim }}>worker123</strong>
          </div>
        </div>
      </form>
    </div>
  );
};

export default LoginPage;
