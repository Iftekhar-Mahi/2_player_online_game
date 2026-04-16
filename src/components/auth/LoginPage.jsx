import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const { user, signIn, signUp, loading, normalizeUsername } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isRegister = mode === 'register';
  const submitLabel = useMemo(
    () => (isRegister ? 'Create Account' : 'Login'),
    [isRegister]
  );

  if (user) {
    return <Navigate to="/" replace />;
  }

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (isRegister) {
        await signUp({
          username: form.username,
          password: form.password
        });

        setSuccess('Account created. You can now start playing.');
      } else {
        await signIn({
          username: form.username,
          password: form.password
        });
      }
    } catch (authError) {
      setError(authError.message);
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-gray-700 bg-gray-800 p-5 shadow-xl sm:p-8">
      <h2 className="mb-3 text-center text-2xl font-bold sm:text-3xl">
        {isRegister ? 'Create Your Account' : 'Welcome Back'}
      </h2>
      <p className="mx-auto mb-6 max-w-sm text-center text-sm text-gray-400 sm:text-base">
        {isRegister
          ? 'Pick a unique username and password so players can log in from any device.'
          : 'Log in with your username and password to rejoin your games.'}
      </p>

      <div className="mb-6 grid grid-cols-2 rounded-2xl bg-gray-900 p-1">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError('');
            setSuccess('');
          }}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${!isRegister ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setError('');
            setSuccess('');
          }}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${isRegister ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="text-left">
          <span className="mb-2 block text-sm font-medium text-gray-300">Username</span>
          <input
            type="text"
            value={form.username}
            onChange={(event) => updateField('username', normalizeUsername(event.target.value))}
            className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
            required
            minLength={3}
            maxLength={24}
            pattern="[a-z0-9_]{3,24}"
            placeholder="yourname"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
          />
        </label>

        <label className="text-left">
          <span className="mb-2 block text-sm font-medium text-gray-300">Password</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => updateField('password', event.target.value)}
            className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
            required
            minLength={6}
            placeholder="At least 6 characters"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
        </label>

        {isRegister && (
          <p className="text-left text-xs text-gray-400">
            Usernames must be unique and can use lowercase letters, numbers, and underscores only.
          </p>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-200">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? 'Please wait...' : submitLabel}
        </button>
      </form>
    </div>
  );
}
