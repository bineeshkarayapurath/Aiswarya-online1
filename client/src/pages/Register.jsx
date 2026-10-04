import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { normalizePhone, CLUB } from '../lib/club';
import { validatePassword, scorePassword, STRENGTH_LABELS, STRENGTH_TONES } from '../lib/password';
import PasswordInput from '../components/PasswordInput';
import {
  FaUserPlus,
  FaUpload,
  FaRegAddressCard,
  FaCalendarAlt,
  FaMobileAlt,
  FaLock,
} from 'react-icons/fa';
import { uploadImages } from '../lib/uploadImages';

export default function Register() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
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
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const steps = [
    {
      key: 'form',
      icon: FaRegAddressCard,
      title: 'Membership Application',
      desc: 'Fill in your details and choose a login password. You can upload your photo now.',
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
    if (normalizePhone(form.phone).length !== 10)
      return toast.error('Enter a valid 10-digit mobile number');
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
      return toast.error('Enter a valid email address');
    const problem = validatePassword(form.password);
    if (problem) return toast.error(problem);
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    return true;
  };

  const submitApplication = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const cleanPhone = normalizePhone(form.phone);
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
      fd.append('password', form.password);
      fd.append('confirmPassword', form.confirmPassword);
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

  const handlePhoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const score = scorePassword(form.password);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition ${
                i === 0 ? 'bg-emerald-900 text-white shadow-md' : 'bg-slate-200 text-slate-400'
              }`}
            >
              {i + 1}
            </div>
          </div>
        ))}
      </div>

      <div className="card p-8">
        <form onSubmit={submitApplication} className="space-y-5">
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
                  <input className="input" value={form.recommenderMemberId} onChange={set('recommenderMemberId')} placeholder="ALC-XXXX" />
                </div>
              </div>
            </div>

            {/* Credentials: the phone number is the username and the password is
                hashed server-side, so this pair is all that stands between a
                stranger and the member's documents. */}
            <div className="sm:col-span-2">
              <label className="label">
                <FaMobileAlt className="mr-1 text-emerald-900" />
                Mobile Number *
              </label>
              <div className="flex gap-2">
                <span className="input !w-16 text-center text-emerald-900">+91</span>
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="98765 43210"
                  autoComplete="username"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                This number is your login ID. Use the same number to sign in after approval.
              </p>
            </div>

            <div className="sm:col-span-2">
              <PasswordInput
                label="Password"
                icon={<FaLock className="text-xs" />}
                value={form.password}
                onChange={set('password')}
                autoComplete="new-password"
                hint="At least 8 characters. Use something you have not used elsewhere."
              />
              {form.password && (
                <div className="mt-2">
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
            </div>

            <div className="sm:col-span-2">
              <PasswordInput
                label="Confirm Password"
                icon={<FaLock className="text-xs" />}
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                autoComplete="new-password"
              />
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="mt-1 text-xs font-semibold text-red-600">Passwords do not match</p>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">
            📌 Your application is saved with <strong>PENDING APPROVAL</strong> status.
            Once an executive officer approves it you can sign in with the mobile number
            and password you just chose.
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            <span className="flex items-center gap-2">
              <FaUserPlus className="text-xl" />
              {submitting ? 'Submitting...' : 'Submit Application'}
            </span>
          </button>
        </form>
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
