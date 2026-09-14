import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Plus,
  ListOrdered,
  Receipt,
  FileText,
  Search,
  Download,
  Printer,
  Eye,
  X,
  User,
  UserX,
  Banknote,
  Landmark,
  Smartphone,
  Wallet,
} from 'lucide-react';
import api from '../api/client';
import Spinner from './Spinner';
import ReceiptVoucherDocument from './ReceiptVoucherDocument';
import { downloadReceiptPdf, printReceiptPdf } from '../lib/receiptPdf';

const CATEGORIES = [
  'Membership Fee',
  'Donation',
  'Maintenance',
  'Event Expense',
  'Subscription',
  'Library Fine',
  'Sports Fund',
  'Other',
];

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const MODE_ICON = { CASH: Banknote, UPI: Smartphone, BANK_TRANSFER: Landmark };
const MODE_STYLE = {
  CASH: 'bg-lime-100 text-lime-700',
  UPI: 'bg-violet-100 text-violet-700',
  BANK_TRANSFER: 'bg-sky-100 text-sky-700',
};

export default function ReceiptsAndVouchers() {
  const [tab, setTab] = useState('generate');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const refreshList = useRef(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <TabBtn active={tab === 'generate'} onClick={() => setTab('generate')} icon={<Plus className="h-4 w-4" />}>Generate Receipt / Voucher</TabBtn>
        <TabBtn active={tab === 'list'} onClick={() => setTab('list')} icon={<ListOrdered className="h-4 w-4" />}>All Transactions</TabBtn>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'generate' ? (
          <motion.div key="gen" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <GenerateForm
              busy={busy}
              setBusy={setBusy}
              onCreated={(v) => {
                setPreview(v);
                if (refreshList.current) refreshList.current();
              }}
            />
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <MasterList
              refBody={(fn) => { refreshList.current = fn; }}
              onPreview={(v) => setPreview(v)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {preview && <PreviewModal voucher={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition ${active ? 'bg-emerald-900 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
    >
      {icon} {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 *  Generation form
 * ------------------------------------------------------------------ */
function GenerateForm({ busy, setBusy, onCreated }) {
  const [type, setType] = useState('RECEIPT');
  const [partyType, setPartyType] = useState('NON_MEMBER');
  const [memberQuery, setMemberQuery] = useState('');
  const [members, setMembers] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [partyName, setPartyName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Membership Fee');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (partyType !== 'MEMBER') {
      setShowSuggest(false);
      setMembers([]);
      return;
    }
    const q = memberQuery.trim();
    if (q.length < 1) { setMembers([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.get('/admin/vouchers/members', { params: { q } });
        setMembers(r.data.members || []);
        setShowSuggest(true);
      } catch (e) { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [memberQuery, partyType]);

  const pickMember = (m) => {
    setSelectedMember(m);
    setMemberQuery(m.membershipId);
    setPartyName(m.fullName);
    setPhone(m.phoneNumber);
    setShowSuggest(false);
  };

  const clearMember = () => {
    setSelectedMember(null);
    setMemberQuery('');
    setPartyName('');
    setPhone('');
  };

  const save = async () => {
    if (partyType === 'MEMBER' && !selectedMember) return toast.error('Select a member (search by membership ID or name)');
    if (partyType === 'NON_MEMBER' && !partyName.trim()) return toast.error('Party name is required');
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error('Amount must be greater than zero');
    setBusy(true);
    try {
      const r = await api.post('/admin/vouchers', {
        type,
        partyType,
        memberId: selectedMember?.membershipId || '',
        partyName: partyName.trim(),
        phone: phone.trim(),
        amount: amt,
        category: category.trim(),
        paymentMode,
        date,
        remarks: remarks.trim(),
      });
      toast.success(type === 'RECEIPT' ? 'Receipt generated & posted to Income ledger' : 'Voucher generated & posted to Expense ledger');
      onCreated(r.data.voucher);
      // reset for the next entry
      setAmount('');
      setRemarks('');
      if (partyType === 'NON_MEMBER') { setPartyName(''); setPhone(''); }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Generation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-4">
          <div>
            <label className="label">Document Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setType('RECEIPT')}
                className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold transition ${type === 'RECEIPT' ? 'bg-emerald-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <Receipt className="h-4 w-4" /> Generate Receipt (Income)
              </button>
              <button
                onClick={() => setType('VOUCHER')}
                className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold transition ${type === 'VOUCHER' ? 'bg-red-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <Wallet className="h-4 w-4" /> Generate Voucher (Expense)
              </button>
            </div>
          </div>

          <div>
            <label className="label">Party Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setPartyType('MEMBER'); }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition ${partyType === 'MEMBER' ? 'bg-emerald-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <User className="h-4 w-4" /> Club Member
              </button>
              <button
                onClick={() => { setPartyType('NON_MEMBER'); clearMember(); }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition ${partyType === 'NON_MEMBER' ? 'bg-emerald-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <UserX className="h-4 w-4" /> Non-Member / Walk-in
              </button>
            </div>
          </div>

          {partyType === 'MEMBER' ? (
            <div className="relative">
              <label className="label">Search &amp; Select Member</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input !pl-9"
                  placeholder="Membership ID, name or phone…"
                  value={memberQuery}
                  onChange={(e) => { setMemberQuery(e.target.value); setSelectedMember(null); }}
                  onFocus={() => members.length && setShowSuggest(true)}
                  onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
                />
              </div>
              {selectedMember && (
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  {selectedMember.fullName} · {selectedMember.membershipId}
                </p>
              )}
              {showSuggest && members.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                  {members.map((m) => (
                    <li key={m.membershipId}>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); pickMember(m); }}
                        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-emerald-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-slate-700">{m.fullName}</span>
                          <span className="text-xs text-slate-400">{m.membershipId} · {m.phoneNumber}</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700">MEMBER</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="label">Party Name (for non-member) *</label>
                <input className="input" placeholder="e.g. Fair walk-in donor, XYZ Traders" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
              </div>
              <div>
                <label className="label">Phone (optional)</label>
                <input className="input" placeholder="e.g. 94xxxxxx00" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <label className="label">Category</label>
            <input className="input" list="voucher-categories" placeholder="Membership Fee, Donation…" value={category} onChange={(e) => setCategory(e.target.value)} />
            <datalist id="voucher-categories">
              {CATEGORIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount (₹) *</label>
              <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Payment Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {['CASH', 'UPI', 'BANK_TRANSFER'].map((m) => {
                const Icon = MODE_ICON[m];
                return (
                  <button
                    key={m}
                    onClick={() => setPaymentMode(m)}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-xs font-extrabold transition ${paymentMode === m ? 'border-emerald-900 bg-emerald-900/5 text-emerald-900' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    <Icon className="h-5 w-5" /> {m.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label">Remarks (optional)</label>
            <textarea className="input min-h-[76px]" placeholder="Brief purpose / reference…" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>

          <button onClick={save} disabled={busy} className="btn-primary w-full !py-3.5 disabled:opacity-60">
            {busy ? 'Generating…' : type === 'RECEIPT' ? <><Receipt className="h-5 w-5" /> Generate Receipt &amp; Post to Income Ledger</> : <><Wallet className="h-5 w-5" /> Generate Voucher &amp; Post to Expense Ledger</>}
          </button>
          <p className="text-center text-[11px] text-slate-400">
            Automatically posted to Accounts &amp; Finance · cash → Cash ledger, UPI / bank → Bank ledger
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Master list with Print / Download actions
 * ------------------------------------------------------------------ */
function MasterList({ refBody, onPreview }) {
  const [data, setData] = useState({ vouchers: [], summary: { receipt: 0, voucher: 0 } });
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [year, setYear] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/vouchers', { params: { type: type || undefined, q: q || undefined, year: year || undefined } });
      setData(r.data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  }, [type, q, year]);

  useEffect(() => { load(); refBody(load); }, [load, refBody]);

  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= 2020; y--) years.push(y);

  const { vouchers, summary } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard icon={<Receipt className="h-5 w-5" />} tint="bg-emerald-50 text-emerald-700" label="Total Receipts (Income)" value={inr(summary.receipt)} />
        <SummaryCard icon={<Wallet className="h-5 w-5" />} tint="bg-rose-50 text-rose-600" label="Total Vouchers (Expense)" value={inr(summary.voucher)} />
        <SummaryCard icon={<FileText className="h-5 w-5" />} tint="bg-gold/10 text-emerald-900" label="Documents Generated" value={String(vouchers.length)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input !pl-9" placeholder="Search no., party, member ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All Types</option>
          <option value="RECEIPT">Receipts</option>
          <option value="VOUCHER">Vouchers</option>
        </select>
        <select className="input w-auto" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All Years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <Spinner label="Loading vouchers…" />
      ) : vouchers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <Receipt className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-500">No receipts or vouchers found</p>
          <p className="text-xs text-slate-400">Generate a receipt or voucher to see it here — every document syncs with Accounts &amp; Finance.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-extrabold">Date</th>
                <th className="px-4 py-3 font-extrabold">No</th>
                <th className="px-4 py-3 font-extrabold">Party</th>
                <th className="px-4 py-3 font-extrabold">Category</th>
                <th className="px-4 py-3 font-extrabold">Mode</th>
                <th className="px-4 py-3 text-right font-extrabold">Amount</th>
                <th className="px-4 py-3 text-center font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vouchers.map((v) => {
                const ModeIcon = MODE_ICON[v.paymentMode] || Banknote;
                return (
                  <tr key={v._id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtDate(v.date)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`chip ${v.type === 'RECEIPT' ? 'bg-emerald-900 text-amber-300' : 'bg-red-600/10 text-red-700'}`}>
                        {v.type === 'RECEIPT' ? 'RCP' : 'VCH'}
                      </span>
                      <span className="ml-2 font-extrabold text-slate-700">{v.voucherNo}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-700">{v.partyName}</p>
                      <p className="text-[11px] text-slate-400">
                        {v.partyType === 'MEMBER' ? `Member · ${v.memberId}` : `Non-member${v.phone ? ` · ${v.phone}` : ''}`}
                      </p>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs text-slate-500">{v.category || 'General'}</span></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${MODE_STYLE[v.paymentMode] || MODE_STYLE.CASH}`}>
                        <ModeIcon className="h-3 w-3" /> {v.paymentMode.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right font-extrabold ${v.type === 'RECEIPT' ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {v.type === 'RECEIPT' ? '+' : '−'}{inr(v.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => onPreview(v)} title="Preview" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-emerald-900"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => downloadReceiptPdf(v)} title="Download PDF" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-emerald-900"><Download className="h-4 w-4" /></button>
                        <button onClick={() => printReceiptPdf(v)} title="Print" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-emerald-900"><Printer className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, tint, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-3 inline-flex rounded-xl p-2.5 ${tint}`}>{icon}</div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-emerald-900">{value}</p>
    </div>
  );
}

function PreviewModal({ voucher, onClose }) {
  const [printing, setPrinting] = useState(false);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-emerald-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h4 className="text-base font-extrabold text-emerald-900">{voucher.voucherNo}</h4>
            <p className="text-xs text-slate-500">{voucher.type === 'RECEIPT' ? 'Receipt' : 'Voucher'} · {fmtDate(voucher.date)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => downloadReceiptPdf(voucher)} className="btn-primary !px-4 !py-2 text-xs"><Download className="h-4 w-4" /> PDF</button>
            <button onClick={async () => { setPrinting(true); try { await printReceiptPdf(voucher); } finally { setPrinting(false); } }} disabled={printing} className="btn-gold !px-4 !py-2 text-xs"><Printer className="h-4 w-4" /> {printing ? 'Preparing…' : 'Print'}</button>
            <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="max-h-[calc(92vh-70px)] overflow-y-auto bg-slate-100 p-4">
          <div className="mx-auto w-fit overflow-hidden rounded-lg bg-white shadow-xl">
            <ReceiptVoucherDocument voucher={voucher} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}