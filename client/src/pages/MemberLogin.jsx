import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import { normalizePhone } from '../lib/club';
import { useAuth } from '../context/AuthContext';
import OTPInput from '../components/OTPInput';
import { FaUserLock, FaSms, FaArrowLeft, FaIdCardAlt } from 'react-icons/fa';

export default function MemberLogin() {
  const navigate = useNavigate();
  const { user, setAuth } = useAuth();
  const [step, setStep] = useState(0);
  const [identifier, setIdentifier] = useState('');
  const [isMemberId, setIsMemberId] = useState(false);
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [logging, setLogging] = useState(false);

  // Already logged in? Reflect the active session immediately instead of
  // showing the login screen again.
  if (user) {
    return (
      <Navigate
        to={
          user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
            ? '/admin/dashboard'
            : user.status === 'APPROVED'
              ? '/member/dashboard'
              : '/pending'
        }
        replace
      />
    );
  }

  const sendOtp = async () => {
    const id = isMemberId ? identifier.trim().toUpperCase() : normalizePhone(identifier);
    if ((!isMemberId && id.length < 10) || (isMemberId && id.length < 8)) {
      return toast.error(isMemberId ? 'Enter a valid membership ID' : 'Enter a valid mobile number');
    }
    setSending(true);
    try {
      const res = await api.post('/auth/send-otp', { identifier: id });
      if (res.data.devOtp) {
        toast(`DEV MODE OTP: ${res.data.devOtp}`, { icon: '🔑', duration: 12000 });
      } else {
        toast.success('OTP sent');
      }
      setStep(1);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send OTP');
    } finally {
      setSending(false);
    }
  };

  const login = async () => {
    if (otp.length !== 6) return toast.error('Enter the 6-digit OTP');
    const id = isMemberId ? identifier.trim().toUpperCase() : normalizePhone(identifier);
    setLogging(true);
    try {
      const res = await api.post('/auth/member-login', { identifier: id, code: otp });
      setAuth(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.fullName}!`);
      navigate(
        res.data.user.role === 'ADMIN' || res.data.user.role === 'SUPER_ADMIN'
          ? '/admin/dashboard'
          : '/member/dashboard'
      );
    } catch (e) {
      const msg = e.response?.data?.message;
      if (msg?.includes('not approved')) {
        sessionStorage.setItem('al_pending_phone', normalizePhone(identifier));
        navigate('/pending');
      } else {
        toast.error(msg || 'Login failed');
      }
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-900 text-2xl text-gold-300 shadow-lg">
            <FaUserLock />
          </div>
          <h1 className="text-2xl font-extrabold text-emerald-900">Member Login</h1>
          <p className="mt-1 text-sm text-slate-500">
            Use your phone number or Membership ID
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {step === 0 && (
              <>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                  <button
                    onClick={() => setIsMemberId(false)}
                    className={`rounded-lg py-2 text-xs font-bold transition ${
                      !isMemberId ? 'bg-emerald-900 text-white shadow' : 'text-slate-500'
                    }`}
                  >
                    📱 Phone Number
                  </button>
                  <button
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
                    placeholder={isMemberId ? 'e.g. AISC-001' : '98765 43210'}
                    inputMode={isMemberId ? 'text' : 'numeric'}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>

                <button
                  onClick={sendOtp}
                  disabled={sending}
                  className="btn-primary w-full"
                >
                  <FaSms className="text-xl" />
                  {sending ? 'Sending OTP...' : 'Login with OTP'}
                </button>
              </>
            )}

            {step === 1 && (
              <>
                <p className="text-center text-sm text-slate-500">
                  OTP sent to <span className="font-bold text-emerald-900">{identifier}</span>
                </p>
                <OTPInput length={6} value={otp} onChange={setOtp} />
                <button
                  onClick={login}
                  disabled={logging}
                  className="btn-primary w-full"
                >
                  {logging ? 'Verifying...' : 'Verify & Login'}
                </button>
                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(0)}
                    className="text-xs font-semibold text-slate-500 hover:text-emerald-900"
                  >
                    <FaArrowLeft className="mr-1 inline" /> Back
                  </button>
                  <button
                    onClick={sendOtp}
                    className="text-xs font-semibold text-emerald-900 underline underline-offset-2"
                  >
                    Resend OTP
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}