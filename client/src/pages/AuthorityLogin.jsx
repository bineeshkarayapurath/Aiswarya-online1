import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import { normalizePhone } from '../lib/club';
import { useAuth } from '../context/AuthContext';
import OTPInput from '../components/OTPInput';
import { FaShieldAlt, FaLock, FaSms, FaArrowLeft } from 'react-icons/fa';

export default function AuthorityLogin() {
  const navigate = useNavigate();
  const { user, setAuth } = useAuth();
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [masterPin, setMasterPin] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Already authenticated as an executive officer? Go straight to the dashboard.
  if (user) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const sendOtp = async () => {
    const p = normalizePhone(phone);
    if (p.length < 10) return toast.error('Enter the authorised admin phone number');
    setSending(true);
    try {
      const res = await api.post('/auth/admin/send-otp', { phone: p });
      if (res.data.devOtp) {
        toast(`DEV MODE OTP: ${res.data.devOtp}`, { icon: '🔑', duration: 20000 });
      } else {
        toast.success('OTP sent');
      }
      setStep(1);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Unauthorised phone number');
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (otp.length !== 6) return toast.error('Enter the 6-digit OTP');
    if (masterPin.length < 4) return toast.error('Enter the master security PIN');
    setVerifying(true);
    try {
      const res = await api.post('/auth/admin/verify', {
        phone: normalizePhone(phone),
        code: otp,
        masterPin,
      });
      setAuth(res.data.token, res.data.user);
      toast.success('Authority verified');
      navigate('/admin/dashboard');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

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

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {step === 0 && (
              <>
                <label className="label">Authorised Admin Phone</label>
                <div className="flex gap-2">
                  <span className="input !w-16 text-center text-emerald-900">+91</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="Registered admin number"
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                    }
                  />
                </div>
                <button onClick={sendOtp} disabled={sending} className="btn-primary w-full">
                  <FaSms className="text-xl" />
                  {sending ? 'Sending OTP...' : 'Send OTP'}
                </button>
                <p className="text-center text-[11px] text-slate-400">
                  A one-time password will be sent to the registered admin mobile number.
                </p>
              </>
            )}

            {step === 1 && (
              <>
                <p className="text-center text-sm text-slate-500">
                  OTP sent to +{phone}
                </p>
                <OTPInput length={6} value={otp} onChange={setOtp} />
                <div>
                  <label className="label">
                    <FaLock className="mr-1 inline text-emerald-900" /> Master Security PIN
                  </label>
                  <input
                    className="input tracking-widest"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    value={masterPin}
                    onChange={(e) =>
                      setMasterPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                  />
                </div>
                <button
                  onClick={verify}
                  disabled={verifying}
                  className="btn-gold w-full"
                >
                  <FaShieldAlt />
                  {verifying ? 'Verifying...' : 'Unlock Authority Zone'}
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