import { Gavel } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to={location.state?.from || '/'} replace />;
  }

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password });
      } else {
        await register(form);
      }
      navigate(location.state?.from || '/', { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          'Unable to complete authentication',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="brand auth-brand">
          <div className="brand-mark"><Gavel size={20} /></div>
          <span>LiveAuction</span>
        </div>
        <div>
          <h1>Manage and discover live auctions.</h1>
          <p>A clean workspace for creating listings and tracking auction activity.</p>
        </div>
      </section>

      <section className="auth-form-panel">
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-tabs">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => setMode('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => setMode('register')}
            >
              Register
            </button>
          </div>

          <h2>{mode === 'login' ? 'Welcome back' : 'Create an account'}</h2>
          {error && <div className="alert alert-error">{error}</div>}

          {mode === 'register' && (
            <label>
              Full name
              <input name="name" value={form.name} onChange={updateField} required />
            </label>
          )}

          <label>
            Email address
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={updateField}
              minLength={mode === 'register' ? 8 : 1}
              required
            />
          </label>

          <button className="primary-button auth-submit" type="submit" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </section>
    </main>
  );
}
