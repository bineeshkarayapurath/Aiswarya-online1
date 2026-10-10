import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FaUserLock, FaIdCardAlt, FaMobileAlt, FaLock, FaCalendarAlt, FaArrowLeft } from 'react-icons/fa';
import api from '../api/client';
import { normalizePhone } from '../lib/club';
import { validatePassword, scorePassword, STRENGTH_LABELS, STRENGTH_TONES } from '../lib/password';
import { useAuth } from '../context/AuthContext';
import { isAuthorityUser } from '../lib/permissions';
import PasswordInput from '../components/PasswordInput';

// Member login: phone number (or Membership ID) + password.
//
// Two-step only in the sense that a member who predates the password system is
// offered a first-login password setup after the server reports needsPassword.
// There is no OTP, no SMS and no second channel of any kind.
export default function MemberLogin() {
  const navigate = useNavigate();
  const { user, setAuth } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [isMemberId, setIsMemberId] = useState(false);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // First-login password setup, revealed only once the server says this account
  // has no password yet.
  const [needsPassword, setNeedsPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dob, setDob] = useState('');
  const [saving, setSaving] = useState(false);

  // Already logged in? Reflect the active session immediately instead of
  // showing the login screen again.
  if (user) {
    return (
      <Navigate
        to={
          isAuthorityUser(user)
            ? '/admin/dashboard'
            : user.status === 'APPROVED'
              ? '/member/dashboard'
              : '/pending'
        }
        replace
      />
    );
  }

  const cleanIdentifier = () =>
    isMemberId ? identifier.trim().toUpperCase() : normalizePhone(identifier);

  const login = async (e) => {
    e.preventDefault();
    const id = cleanIdentifier();
    if (!isMemberId && normalizePhone(identifier).length !== 10) {
      return toast.error('Enter a valid 10-digit mobile number');
    }
    if (isMemberId && id.length < 8) return toast.error('Enter a valid membership ID');

    // No password required here on purpose. A member who predates the password
    // system has nothing to type, so blocking on an empty field meant they could
    // never reach the set-password step and would invent a throwaway password.
    // The server decides: a passwordless account is offered setup, and an account
    // that does have one simply rejects the attempt.
    setSubmitting(true);
    try {
      const res = await api.post('/auth/login', { identifier: id, password });

      // The account exists but has never had a password. Send the member into the
      // set-password step rather than reporting a wrong password.
      if (res.data.needsPassword) {
        // The server hands back the canonical phone number, so from here on this
        // is a phone-number flow even if the member signed in by Membership ID.
        setIdentifier(res.data.identifier || id);
        setIsMemberId(false);
        setNeedsPassword(true);
        return;
      }

      setAuth(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.fullName}!`);
      navigate(isAuthorityUser(res.data.user) ? '/admin/dashboard' : '/member/dashboard');
    } catch (e) {
      const msg = e.response?.data?.message;
      if (e.response?.data?.pending) {
        // Correct credentials, application just not through the committee yet.
        sessionStorage.setItem('al_pending_phone', normalizePhone(identifier));
        navigate('/pending');
      } else if (e.response?.status === 403 && msg) {
        // Rejected application, or an approved-but-blocked account. Say what the
        // server said instead of a bare "login failed".
        toast.error(msg);
      } else {
        toast.error(msg || 'Login failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const setNewPasswordAndSave = async (e) => {
    e.preventDefault();
    const problem = validatePassword(newPassword);
    if (problem) return toast.error(problem);
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match');
    if (!dob) return toast.error('Enter your date of birth to confirm your identity');

    setSaving(true);
    try {
      await api.post('/auth/set-password', {
        identifier: cleanIdentifier(),
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
      <div className="card p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-900 text-2xl text-gold-300 shadow-lg">
            <FaUserLock />
          </div>
          <h1 className="text-2xl font-extrabold text-emerald-900">
            {needsPassword ? 'Create Your Password' : 'Member Login'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {needsPassword
              ? 'One-time setup for accounts created before password login'
              : 'Use your phone number or Membership ID'}
          </p>
        </div>

        <motion.div
          key={needsPassword ? 'setpw' : 'login'}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {needsPassword ? (
            <form onSubmit={setNewPasswordAndSave} className="space-y-4">
              <div className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                This account was registered before password login existed. Choose a
                password to finish setting it up, then sign in normally.
              </div>

              <PasswordInput
                label="New Password"
                icon={<FaLock className="text-xs" />}
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
                  <p className="text-[11px] text-slate-400">
                    Strength: {STRENGTH_LABELS[score]}
                  </p>
                </div>
              )}

              <PasswordInput
                label="Confirm Password"
                icon={<FaLock className="text-xs" />}
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

              <button type="submit" disabled={saving} className="btn-primary w-full">
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
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setIsMemberId(false)}
                  className={`rounded-lg py-2 text-xs font-bold transition ${
                    !isMemberId ? 'bg-emerald-900 text-white shadow' : 'text-slate-500'
                  }`}
                >
                  <FaMobileAlt className="mr-1 inline" /> Phone Number
                </button>
                <button
                  type="button"
                  onClick={() => setIsMemberId(true)}
                  className={`rounded-lg py-2 text-xs font-bold transition ${
                    isMemberId ? 'bg-emerald-900 text-white shadow' : 'text-slate-500'
                  }`}
                >
                  <FaIdCardAlt className="mr-1 inline" /> Membership ID
                </button>
              </div>

              <div className="flex gap-2">
                {!isMemberId && (
                  <span className="input !w-16 text-center text-emerald-900">+91</span>
                )}
                <input
                  className="input"
                  placeholder={isMemberId ? 'e.g. ALC-001' : '98765 43210'}
                  inputMode={isMemberId ? 'text' : 'numeric'}
                  autoCapitalize="none"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) =>
                    setIdentifier(
                      isMemberId ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 10)
                    )
                  }
                />
              </div>

              <PasswordInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                hint="Joining before password login? Leave this blank and we'll set one up for you."
              />

              <button type="submit" disabled={submitting} className="btn-primary w-full">
                <FaUserLock />
                {submitting ? 'Signing in...' : 'Login'}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
