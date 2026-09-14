import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaBug, FaTimes, FaHome, FaUserPlus, FaShieldAlt, FaUser, FaHourglass, FaIdCardAlt, FaFilePdf, FaTrashAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { sampleApprovedMember, samplePendingUser, sampleSuperAdmin } from '../lib/sampleData';

export default function DevTools() {
  if (!import.meta.env.DEV) return null;

  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { setAuth, logout } = useAuth();

  const go = (path) => { setOpen(false); navigate(path); };

  const actAsMember = () => {
    setAuth('dev-token', { ...sampleApprovedMember });
    go('/dashboard');
  };

  const actAsAdmin = () => {
    setAuth('dev-token-admin', { ...sampleSuperAdmin });
    go('/authority-zone');
  };

  const actAsPending = () => {
    setAuth('dev-token-pending', { ...samplePendingUser });
    go('/pending-status');
  };

  const clearDemoUsers = async () => {
    if (!window.confirm('Clear ALL demo members? This deletes every member record,' +
      ' resets the membership ID counter, and removes stored photos/PDFs/QRs.')) return;
    try {
      // Log in as the dev test admin to get a real super-admin token.
      await api.post('/auth/admin/send-otp', { phone: '9999999999' });
      const verify = await api.post('/auth/admin/verify', {
        phone: '9999999999',
        code: '123456',
        masterPin: '123456',
      });
      setAuth(verify.data.token, verify.data.user);
      const res = await api.post('/admin/dev/clear-members');
      toast.success(`Cleared ${res.data.deleted} demo member(s)`);
      go('/authority-zone');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Clear failed');
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] font-sans">
      {open && (
        <div className="mb-3 max-h-[80vh] w-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-300/60">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-emerald-900">
              <FaBug className="text-amber-500" /> DevTools
            </h3>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            >
              <FaTimes />
            </button>
          </div>

          <div className="space-y-1.5">
            <DevButton icon={FaHome} label="Landing Page" onClick={() => go('/')} />
            <DevButton icon={FaUserPlus} label="Signup / Register" onClick={() => go('/signup')} />
            <DevButton icon={FaShieldAlt} label="Super Admin Zone" accent onClick={actAsAdmin} />
            <DevButton icon={FaUser} label="Member Dashboard (Approved)" accent onClick={actAsMember} />
            <DevButton icon={FaHourglass} label="Pending Approval Screen" onClick={actAsPending} />
            <DevButton icon={FaIdCardAlt} label="ID Card Preview" onClick={() => go('/id-card-preview')} />
            <DevButton icon={FaFilePdf} label="Application PDF Preview" onClick={() => go('/application-pdf-preview')} />

            <DevButton icon={FaTrashAlt} label="Clear Demo Users" accent onClick={clearDemoUsers} />

            <div className="my-2 border-t border-slate-100" />

            <DevButton
              icon={FaTimes}
              label="Logout / Clear Auth"
              onClick={() => { logout(); go('/'); }}
            />
          </div>

          <p className="mt-3 rounded-lg bg-amber-50 p-2 text-center text-[10px] font-medium text-amber-700">
            Only visible in Vite dev mode
          </p>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-900 text-gold shadow-lg shadow-emerald-900/30 transition hover:scale-110"
        title="DevTools"
      >
        {open ? <FaTimes /> : <FaBug className="text-xl" />}
      </button>
    </div>
  );
}

function DevButton({ icon: Icon, label, accent, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
        accent
          ? 'bg-emerald-900 text-white hover:bg-emerald-700'
          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-emerald-900'
      }`}
    >
      <Icon className="text-sm" />
      {label}
    </button>
  );
}