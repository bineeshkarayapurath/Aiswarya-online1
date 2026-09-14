import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import { normalizePhone, CLUB } from '../lib/club';
import OTPInput from '../components/OTPInput';
import {
  FaWhatsapp,
  FaUserPlus,
  FaUpload,
  FaArrowLeft,
  FaRegAddressCard,
  FaCalendarAlt,
  FaSms,
} from 'react-icons/fa';
import {
  isFirebaseConfigured,
  startFirebasePhoneVerification,
  confirmFirebaseOtp,
  firebaseErrorMessage,
} from '../lib/phoneAuth';
import { uploadImages } from '../lib/uploadImages';

export default function Register() {
  const navigate = useNavigate();
  const firebaseReady = isFirebaseConfigured();
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifyVia, setVerifyVia] = useState('');
  const [fbError, setFbError] = useState('');
  const confirmationRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    dob: '',
    address: '',
    occupation: '',
    occupationCustom: '',
    education: '',
    email: '',
    recommenderName: '',
    recommenderMemberId: '',
  });

  const steps = [
    {
      key: 'form',
      icon: FaRegAddressCard,
      title: 'Membership Application',
      desc: 'Fill in your details. You can upload your photo now.',
    },
    {
      key: 'otp',
      icon: firebaseReady ? FaSms : FaWhatsapp,
      title: 'Verify Mobile Number',
      desc: `Enter the 6-digit OTP sent via ${firebaseReady ? 'SMS' : 'WhatsApp'} to complete your application.`,
    },
  ];

  const todayIso = new Date().toISOString().split('T')[0];

  const age = form.dob
    ? Math.floor((Date.now() - new Date(form.dob)) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const validateForm = () => {
    if (!form.fullName.trim()) return toast.error('Please enter your full name');
    if (!form.dob) return toast.error('Please select your date of birth');
    if (!form.address.trim()) return toast.error('Please enter your full address');
    if (age != null && age < 1) return toast.error('Date of birth is invalid');
    if (form.occupation === 'Others' && !form.occupationCustom.trim())
      return toast.error('Please specify your occupation');
    if (normalizePhone(phone).length !== 10)
      return toast.error('Enter a valid 10-digit mobile number');
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
      return toast.error('Enter a valid email address');
    return true;
  };

  const sendOtp = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const cleanPhone = normalizePhone(phone);
    setSending(true);
    setFbError('');
    try {
      if (firebaseReady) {
        confirmationRef.current = await startFirebasePhoneVerification(
          `+91${cleanPhone}`,
          'al-recaptcha'
        );
        setVerifyVia('firebase');
        setStep(1);
        toast.success(`SMS OTP sent to +91 ${cleanPhone}`);
      } else {
        const res = await api.post('/auth/send-otp', { identifier: cleanPhone });
        if (res.data.devOtp) {
          toast(`DEV MODE OTP: ${res.data.devOtp}`, { icon: '🔑', duration: 12000 });
        } else {
          toast.success('OTP sent on WhatsApp');
        }
        setVerifyVia('whatsapp');
        setStep(1);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || firebaseErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const submitApplication = async ({ verified, via, uid }) => {
    const cleanPhone = normalizePhone(phone);
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('identifier', cleanPhone);
      fd.append('fullName', form.fullName);
      fd.append('dob', form.dob);
      fd.append('address', form.address);
      fd.append(
        'occupation',
        form.occupation === 'Others' ? form.occupationCustom : form.occupation
      );
      fd.append('education', form.education);
      fd.append('email', form.email);
      fd.append('recommenderName', form.recommenderName);
      fd.append('recommenderMemberId', form.recommenderMemberId);
      fd.append('phoneVerified', String(verified));
      fd.append('phoneVerifiedVia', via);
      if (uid) fd.append('firebaseUid', uid);
      if (photo) {
        try {
          // Upload the photo to the backend /api/upload endpoint; it is stored
          // locally (or on ImgBB when configured) and the public HTTPS URL is
          // saved with the application.
          const [photoUrl] = await uploadImages([photo]);
          if (photoUrl) fd.append('photoUrl', photoUrl);
        } catch (err) {
          // Graceful fallback: send the file so the server keeps it locally.
          fd.append('photo', photo);
        }
      }

      await api.post('/auth/register', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      sessionStorage.setItem('al_pending_phone', cleanPhone);
      toast.success('Application received!');
      navigate('/pending');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyAndSubmit = async () => {
    if (otp.length !== 6) return toast.error('Enter the 6-digit OTP');
    if (verifyVia === 'firebase') {
      setFbError('');
      try {
        const confirmed = await confirmFirebaseOtp(confirmationRef.current, otp);
        await submitApplication({ verified: true, via: 'firebase', uid: confirmed.firebaseUid });
      } catch (err) {
        setFbError(firebaseErrorMessage(err));
      }
      return;
    }
    try {
      await api.post('/auth/verify-otp', {
        identifier: normalizePhone(phone),
        code: otp,
      });
      await submitApplication({ verified: true, via: 'whatsapp', uid: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification / registration failed');
    }
  };

  const submitUnverified = async () => {
    const ok = window.confirm(
      'Submit without phone verification?\n\nIf you cannot receive the OTP, your number will be verified manually at the club office before approval.'
    );
    if (!ok) return;
    setVerifyVia('skip');
    setFbError('');
    await submitApplication({ verified: false, via: '', uid: '' });
  };

  const handlePhoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {/* Steps indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition ${
                i === step
                  ? 'bg-emerald-900 text-white shadow-md'
                  : i < step
                  ? 'bg-gold text-white'
                  : 'bg-slate-200 text-slate-400'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </div>
            {i < steps.length - 1 && <div className="h-0.5 w-8 bg-slate-200" />}
          </div>
        ))}
      </div>

      <div className="card p-8">
        <div id="al-recaptcha" className="hidden" />
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
          >
            {step === 0 && (
              <form onSubmit={sendOtp} className="space-y-5">
                <Header {...steps[0]} />

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="label">Full Name *</label>
                    <input className="input" value={form.fullName} onChange={set('fullName')} placeholder="As per your records" />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="label">Profile Photo (for Digital ID Card)</label>
                    {photoPreview ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                          <img
                            src={photoPreview}
                            alt="preview"
                            className="h-28 w-28 rounded-2xl border-2 border-emerald-900 object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => { setPhoto(null); setPhotoPreview(''); }}
                            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow"
                            title="Remove photo"
                          >
                            ✕
                          </button>
                        </div>
                        <label className="text-xs font-semibold text-emerald-900 underline underline-offset-2 cursor-pointer">
                          Change photo
                          <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                        </label>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-4 text-sm text-slate-500 transition hover:border-emerald-700 hover:text-emerald-900">
                        <FaUpload /> Upload a passport-style photo
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                      </label>
                    )}
                  </div>

                  <div>
                    <label className="label">
                      <FaCalendarAlt className="mr-1 inline text-emerald-900" />
                      Date of Birth *
                    </label>
                    <input type="date" max={todayIso} className="input" value={form.dob} onChange={set('dob')} />
                  </div>

                  <div>
                    <label className="label">Age</label>
                    <input
                      type="text"
                      readOnly
                      className="input cursor-not-allowed bg-slate-50 text-slate-500"
                      value={form.dob ? `${age} years` : ''}
                      placeholder="Auto-calculated"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="label">Full Address *</label>
                    <textarea className="input min-h-[76px]" value={form.address} onChange={set('address')} placeholder={`House name, Street, Post office, ${CLUB.place}`} />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="label">Educational Qualification (വിദ്യാഭ്യാസ യോഗ്യത)</label>
                    <select className="input" value={form.education} onChange={set('education')}>
                      <option value="">Select qualification</option>
                      <option value="SSLC">SSLC</option>
                      <option value="Higher Secondary">Higher Secondary</option>
                      <option value="Diploma">Diploma</option>
                      <option value="Graduate">Graduate (Bachelor's)</option>
                      <option value="Post Graduate">Post Graduate</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="label">Occupation / Status</label>
                    <select className="input" value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })}>
                      <option value="">Select status</option>
                      <option value="Student">Student (വിദ്യാർത്ഥി)</option>
                      <option value="Employed">Employed (ഉദ്യോഗസ്ഥൻ / തൊഴിൽ)</option>
                      <option value="Self-Employed / Business">Self-Employed / Business (സ്വയം തൊഴിൽ / ബിസിനസ്സ്)</option>
                      <option value="Homemaker">Homemaker (ഗൃഹിണി)</option>
                      <option value="Retired">Retired (വിരമിച്ചയാൾ)</option>
                      <option value="Others">Others (മറ്റുള്ളവ)</option>
                    </select>
                    {form.occupation === 'Others' && (
                      <input
                        className="input mt-2"
                        value={form.occupationCustom}
                        onChange={set('occupationCustom')}
                        placeholder="Specify your occupation"
                      />
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="label">Email Address</label>
                    <input type="email" className="input" value={form.email} onChange={set('email')} placeholder="you@example.com" />
                  </div>

                  <div className="sm:col-span-2 rounded-xl bg-slate-50 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Recommender (an existing library member)
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="label">Recommender Name</label>
                        <input className="input" value={form.recommenderName} onChange={set('recommenderName')} />
                      </div>
                      <div>
                        <label className="label">Recommender Member ID</label>
                        <input className="input" value={form.recommenderMemberId} onChange={set('recommenderMemberId')} placeholder="ALC-XXXX-XXXX" />
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="label">Mobile Number (WhatsApp) *</label>
                    <div className="flex gap-2">
                      <span className="input !w-16 text-center text-emerald-900">+91</span>
                      <input
                        className="input"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Your WhatsApp number will be used for OTP login after approval.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">
                  📌 On submit, we will send a WhatsApp OTP to your mobile number to verify it.
                  Your application is saved with <strong>PENDING APPROVAL</strong> status.
                </div>

                <button type="submit" disabled={sending} className="btn-primary w-full">
                  {sending ? (
                    <span className="flex items-center gap-2">
                      <FaWhatsapp className="animate-pulse" /> Sending OTP...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <FaWhatsapp className="text-xl" /> Submit &amp; Verify OTP
                    </span>
                  )}
                </button>
              </form>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <Header {...steps[1]} />

                <div className="flex items-center justify-center gap-4 rounded-xl bg-gold/5 p-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-900/10 text-xl text-emerald-900">
                    <FaUserPlus />
                  </div>
                  <div className="text-sm text-slate-600">
                    <p className="font-bold text-emerald-900">{form.fullName || 'Applicant'}</p>
                    <p>+91 {phone}</p>
                  </div>
                  {photoPreview && (
                    <img src={photoPreview} alt="preview" className="h-12 w-12 rounded-lg border border-emerald-900 object-cover" />
                  )}
                </div>

                <OTPInput length={6} value={otp} onChange={setOtp} onComplete={() => {}} />

                {fbError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
                    {fbError}
                  </div>
                )}

                <button
                  onClick={verifyAndSubmit}
                  disabled={submitting}
                  className="btn-primary w-full"
                >
                  {submitting ? 'Verifying & Saving...' : 'Verify & Complete Registration'}
                </button>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between">
                    <button
                      onClick={() => setStep(0)}
                      className="text-xs font-semibold text-slate-500 hover:text-emerald-900"
                    >
                      <FaArrowLeft className="mr-1 inline" /> Edit details
                    </button>
                    <button
                      onClick={sendOtp}
                      disabled={sending}
                      className="text-xs font-semibold text-emerald-900 underline underline-offset-2"
                    >
                      {sending ? 'Resending...' : `Didn't receive? Resend ${firebaseReady ? 'SMS' : 'OTP'}`}
                    </button>
                  </div>
                  <button
                    onClick={submitUnverified}
                    disabled={submitting}
                    className="text-center text-xs font-semibold text-slate-400 underline underline-offset-2 transition hover:text-amber-700"
                  >
                    Trouble receiving OTP? Submit anyway — we&apos;ll verify your number at the club office
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Header({ icon: Icon, title, desc }) {
  return (
    <div className="mb-6 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-900 text-2xl text-gold-300 shadow-lg">
        <Icon />
      </div>
      <h1 className="text-2xl font-extrabold text-emerald-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </div>
  );
}