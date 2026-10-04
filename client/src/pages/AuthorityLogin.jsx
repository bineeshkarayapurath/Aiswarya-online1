import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FaShieldAlt, FaMobileAlt, FaCalendarAlt, FaArrowLeft } from 'react-icons/fa';
import api from '../api/client';
import { normalizePhone } from '../lib/club';
import { validatePassword, scorePassword, STRENGTH_LABELS, STRENGTH_TONES } from '../lib/password';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';

// Authority Zone login: the officer's own phone number + account password.
//
// What makes the session an authority session is the ROLE on the account (an
// Executive Committee designation, or an ADMIN/SUPER_ADMIN role), not a second
// secret. The server refuses any number that is not listed in SUPER_ADMIN_PHONES,
// and refuses an account that holds no designation.
//
// Accounts that predate password login get the same one-time set-password step
// members get — no account is ever created from this screen.
export default function AuthorityLogin() {
  const navigate = useNavigate();
  const { user, setAuth } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [needsPassword, setNeedsPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dob, setDob] = useState('');
  const [saving, setSaving] = useState(false);

  // Already authenticated as an executive officer? Go straight to the dashboard.
  if (user) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const login = async (e) => {
    e.preventDefault();
    const p = normalizePhone(phone);
    if (p.length !== 10) return toast.error('Enter the authorised officer phone number');

    // No password required on purpose. An officer appointed before password login
    // has none to type, so requiring one here made the setup step unreachable and
    // pushed them towards inventing a throwaway password. The server decides.
    setSubmitting(true);
    try {
      const res = await api.post('/auth/admin/login', { phone: p, password });
      if (res.data.needsPassword) {
        setPhone(res.data.identifier || p);
        setNeedsPassword(true);
        return;
      }
      setAuth(res.data.token, res.data.user);
      toast.success('Authority verified');
      navigate('/admin/dashboard');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    const problem = validatePassword(newPassword);
    if (problem) return toast.error(problem);
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match');
    if (!dob) return toast.error('Enter your date of birth to confirm your identity');

    setSaving(true);
    try {
      await api.post('/auth/set-password', {
        identifier: normalizePhone(phone),
        password: newPassword,
        confirmPassword,
        dob,
      });
      toast.success('Password set — please sign in');
      setNeedsPassword(false);
      setNewPassword('');
      setConfirmPassword('');
      setDob('');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not set password');
    } finally {
      setSaving(false);
    }
  };

  const score = scorePassword(newPassword);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card relative overflow-hidden p-8">
        {/* top accent */}
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-gold via-emerald-600 to-gold" />

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-900 text-3xl text-gold-300 shadow-lg">
            <FaShieldAlt />
          </div>
          <h1 className="text-2xl font-extrabold text-emerald-900">Secret Authority Zone</h1>
          <p className="mt-1 text-xs text-slate-500">
            Restricted to designated Executive Committee officers
          </p>
        </div>

        <motion.div
          key={needsPassword ? 'setpw' : 'login'}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          {needsPassword ? (
            <form onSubmit={savePassword} className="space-y-4">
              <div className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                Your officer account was created before password login existed. Choose a
                password to finish setting it up, then sign in normally.
              </div>

              <PasswordInput
                label="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              {newPassword && (
                <div>
                  <div className="mb-1 flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition ${
                          i <= score ? STRENGTH_TONES[score] : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400">Strength: {STRENGTH_LABELS[score]}</p>
                </div>
              )}

              <PasswordInput
                label="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs font-semibold text-red-600">Passwords do not match</p>
              )}

              <div>
                <label className="label">
                  <FaCalendarAlt className="mr-1 text-emerald-900" /> Date of Birth
                </label>
                <input
                  type="date"
                  className="input"
                  value={dob}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDob(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-400">
                  As given in your membership application. This confirms the account is
                  yours.
                </p>
              </div>

              <button type="submit" disabled={saving} className="btn-gold w-full">
                {saving ? 'Saving...' : 'Set Password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNeedsPassword(false);
                  setNewPassword('');
                  setConfirmPassword('');
                  setDob('');
                }}
                className="w-full text-xs font-semibold text-slate-500 hover:text-emerald-900"
              >
                <FaArrowLeft className="mr-1 inline" /> Back to login
              </button>
            </form>
          ) : (
            <form onSubmit={login} className="space-y-4">
              <div>
                <label className="label">
                  <FaMobileAlt className="mr-1 text-emerald-900" />
                  Authorised Officer Phone
                </label>
                <div className="flex gap-2">
                  <span className="input !w-16 text-center text-emerald-900">+91</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="Registered officer number"
                    autoComplete="username"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </div>
              </div>

              <PasswordInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                hint="Appointed before password login? Leave this blank and we'll set one up for you."
              />

              <button type="submit" disabled={submitting} className="btn-gold w-full">
                <FaShieldAlt />
                {submitting ? 'Verifying...' : 'Unlock Authority Zone'}
              </button>
              <p className="text-center text-[11px] text-slate-400">
                Sign in with the mobile number and password from your membership account.
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
