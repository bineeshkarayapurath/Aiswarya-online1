import { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import { DEFAULT_PROGRAM_CATEGORIES } from '../lib/programRegistration';
import {
  FaIdCard,
  FaUser,
  FaPhoneAlt,
  FaEnvelope,
  FaUsers,
  FaPlus,
  FaTrashAlt,
  FaSearch,
  FaCheckCircle,
  FaMusic,
} from 'react-icons/fa';

const emptyMember = { name: '', phoneNumber: '', membershipId: '' };

// Registration form for the New Year Annual Celebration. Reused by the member
// profile and the public page — the only difference is whether a member session
// already exists. A Member ID is optional: entering one fetches and autofills
// the person's details, while public participants simply fill the fields.
export default function ProgramRegistrationForm({
  categories = DEFAULT_PROGRAM_CATEGORIES,
  defaultMemberId = '',
  defaultName = '',
  defaultPhone = '',
  defaultEmail = '',
  onRegistered,
}) {
  const [membershipId, setMembershipId] = useState(defaultMemberId);
  const [looking, setLooking] = useState(false);
  const [lookedUp, setLookedUp] = useState(false);

  const [participantName, setParticipantName] = useState(defaultName);
  const [contactNumber, setContactNumber] = useState(defaultPhone);
  const [category, setCategory] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [isGroup, setIsGroup] = useState(false);

  const [lead, setLead] = useState({
    name: defaultName,
    phoneNumber: defaultPhone,
    email: defaultEmail,
    membershipId: defaultMemberId,
  });
  const [members, setMembers] = useState([{ ...emptyMember }]);
  const [saving, setSaving] = useState(false);

  const lookupMember = async () => {
    const id = membershipId.trim();
    if (!id) {
      toast.error('Enter a Member ID to fetch details');
      return;
    }
    setLooking(true);
    try {
      const res = await api.get(`/registrations/member/${encodeURIComponent(id)}`);
      if (!res.data.found) {
        setLookedUp(false);
        toast.error('No approved member found with that ID');
        return;
      }
      const m = res.data.member;
      setLookedUp(true);
      setLead({
        name: m.fullName || '',
        phoneNumber: m.phoneNumber || '',
        email: m.email || '',
        membershipId: m.membershipId || id,
      });
      if (!participantName) setParticipantName(m.fullName || '');
      if (!contactNumber) setContactNumber(m.phoneNumber || '');
      toast.success(`Details loaded for ${m.fullName}`);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not fetch member details');
    } finally {
      setLooking(false);
    }
  };

  const updateMember = (i, key, val) =>
    setMembers((prev) => prev.map((m, j) => (j === i ? { ...m, [key]: val } : m)));

  const addMember = () => setMembers((prev) => [...prev, { ...emptyMember }]);
  const removeMember = (i) => setMembers((prev) => prev.filter((_, j) => j !== i));

  const submit = async () => {
    const name = participantName.trim();
    const phone = contactNumber.replace(/\D/g, '');
    if (!name) return toast.error('Participant / team name is required');
    if (phone.length < 10) return toast.error('A valid 10-digit contact number is required');
    if (!category) return toast.error('Select a program category');
    if (!itemTitle.trim()) return toast.error('Item / performance title is required');

    const cleanMembers = isGroup
      ? members
          .map((m) => ({
            name: m.name.trim(),
            phoneNumber: m.phoneNumber.replace(/\D/g, ''),
            membershipId: m.membershipId.trim().toUpperCase(),
          }))
          .filter((m) => m.name)
      : [];

    if (isGroup && !lead.name.trim()) return toast.error("Enter the lead person's name");
    if (isGroup && cleanMembers.length === 0) {
      return toast.error('Add at least one other team member');
    }

    setSaving(true);
    try {
      const res = await api.post('/registrations', {
        participantName: name,
        contactNumber: phone,
        category,
        itemTitle: itemTitle.trim(),
        isGroup,
        membershipId: (lead.membershipId || membershipId).trim().toUpperCase(),
        lead: {
          name: lead.name.trim() || name,
          phoneNumber: lead.phoneNumber.replace(/\D/g, ''),
          email: lead.email.trim(),
          membershipId: (lead.membershipId || membershipId).trim().toUpperCase(),
        },
        members: cleanMembers,
      });
      toast.success(res.data.message || 'Registration successful');
      // Reset for another entry, keeping the member's identity handy.
      setItemTitle('');
      setCategory('');
      setIsGroup(false);
      setMembers([{ ...emptyMember }]);
      onRegistered?.(res.data.registration);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Registration failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <h3 className="flex items-center gap-2 text-base font-extrabold text-emerald-900">
        <FaMusic className="text-gold" /> New Year Celebration Program Registration
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        Register for a cultural program. A unique chest number is generated automatically once you
        submit. Members may enter their Member ID to autofill their details.
      </p>

      {/* Member autofill */}
      <div className="mt-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="label flex items-center gap-1.5">
            <FaIdCard className="text-slate-400" /> Member ID (optional)
          </label>
          <input
            className="input"
            placeholder="e.g. ALC-001"
            value={membershipId}
            onChange={(e) => {
              setMembershipId(e.target.value);
              setLookedUp(false);
            }}
          />
        </div>
        <button
          type="button"
          onClick={lookupMember}
          disabled={looking}
          className="btn-outline flex items-center justify-center gap-2 !py-2.5 text-sm disabled:opacity-60"
        >
          <FaSearch /> {looking ? 'Fetching...' : 'Fetch Details'}
        </button>
      </div>
      {lookedUp && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <FaCheckCircle /> Member details loaded
        </p>
      )}

      {/* Entry details */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label flex items-center gap-1.5">
            <FaUser className="text-slate-400" /> {isGroup ? 'Team Name' : 'Participant Name'} *
          </label>
          <input
            className="input"
            placeholder={isGroup ? 'e.g. Kuppakolly Yuva Team' : 'Full name'}
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
          />
        </div>
        <div>
          <label className="label flex items-center gap-1.5">
            <FaPhoneAlt className="text-slate-400" /> Contact Number *
          </label>
          <input
            className="input"
            inputMode="numeric"
            placeholder="10-digit mobile number"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
          />
        </div>
        <div>
          <label className="label flex items-center gap-1.5">
            <FaMusic className="text-slate-400" /> Program Category *
          </label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Item / Performance Title *</label>
          <input
            className="input"
            placeholder="e.g. Mohiniyattam — Kuchipudi medley"
            value={itemTitle}
            onChange={(e) => setItemTitle(e.target.value)}
          />
        </div>
      </div>

      {/* Group toggle */}
      <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <input
          type="checkbox"
          className="h-4 w-4 accent-emerald-700"
          checked={isGroup}
          onChange={(e) => setIsGroup(e.target.checked)}
        />
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <FaUsers className="text-gold" /> This is a group event (Drama, Group Dance, ...)
        </span>
      </label>

      {isGroup && (
        <div className="mt-4 space-y-4 rounded-2xl border border-emerald-900/10 bg-emerald-900/[0.03] p-4">
          <div>
            <h4 className="text-sm font-extrabold text-emerald-900">Lead Person Details</h4>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Full Name *</label>
                <input
                  className="input"
                  value={lead.name}
                  onChange={(e) => setLead({ ...lead, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label flex items-center gap-1.5">
                  <FaPhoneAlt className="text-slate-400" /> Phone
                </label>
                <input
                  className="input"
                  inputMode="numeric"
                  value={lead.phoneNumber}
                  onChange={(e) => setLead({ ...lead, phoneNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="label flex items-center gap-1.5">
                  <FaEnvelope className="text-slate-400" /> Email
                </label>
                <input
                  className="input"
                  value={lead.email}
                  onChange={(e) => setLead({ ...lead, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label flex items-center gap-1.5">
                  <FaIdCard className="text-slate-400" /> Member ID
                </label>
                <input
                  className="input uppercase"
                  value={lead.membershipId}
                  onChange={(e) => setLead({ ...lead, membershipId: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-emerald-900">Other Team Members</h4>
              <button
                type="button"
                onClick={addMember}
                className="flex items-center gap-1 text-xs font-bold text-emerald-900 hover:underline"
              >
                <FaPlus className="h-3 w-3" /> Add member
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {members.map((m, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                  <input
                    className="input flex-1"
                    placeholder={`Member ${i + 1} name`}
                    value={m.name}
                    onChange={(e) => updateMember(i, 'name', e.target.value)}
                  />
                  <input
                    className="input w-40"
                    placeholder="Phone (optional)"
                    inputMode="numeric"
                    value={m.phoneNumber}
                    onChange={(e) => updateMember(i, 'phoneNumber', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeMember(i)}
                    disabled={members.length === 1}
                    className="rounded-lg p-2 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    title="Remove member"
                  >
                    <FaTrashAlt />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          onClick={submit}
          disabled={saving}
          className="btn-primary !py-2.5 text-sm disabled:opacity-60"
        >
          {saving ? 'Submitting...' : 'Submit Registration'}
        </button>
      </div>
    </motion.div>
  );
}
