import { useEffect, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Wallet,
  Landmark,
  Banknote,
  PiggyBank,
  Search,
  Calendar,
  ArrowDownUp,
  TrendingUp,
  TrendingDown,
  Plus,
  Settings2,
  ArrowLeftRight,
  X,
} from 'lucide-react';
import api from '../api/client';
import Spinner from './Spinner';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

function ModeBadge({ mode }) {
  return mode === 'Cash' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-lime-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-lime-700"><Banknote className="h-3 w-3" /> Cash</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-sky-700"><Landmark className="h-3 w-3" /> Bank</span>
  );
}

export default function AccountsPanel() {
  const [data, setData] = useState({
    accounts: [],
    summary: { income: 0, expense: 0, netBalance: 0 },
    byCategory: [],
    balances: {
      openingBankBalance: 0,
      openingCashInHand: 0,
      bankBalance: 0,
      cashBalance: 0,
      clubBalance: 0,
    },
  });
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState('');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [mode, setMode] = useState('');
  const [sort, setSort] = useState('date');
  const [modal, setModal] = useState(null); // 'settings' | 'entry' | 'transfer'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, t] = await Promise.all([
        api.get('/admin/accounts', { params: { year: year || undefined, q: q || undefined, type: type || undefined, mode: mode || undefined } }),
        api.get('/admin/accounts/transfers'),
      ]);
      setData(a.data);
      setTransfers(t.data.transfers || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [year, q, type, mode]);

  useEffect(() => {
    load();
  }, [load]);

  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= 2020; y--) years.push(y);

  const accounts = [...data.accounts].sort((a, b) =>
    sort === 'amount' ? b.amount - a.amount : new Date(b.date || 0) - new Date(a.date || 0)
  );

  const { balances, byCategory } = data;

  return (
    <div className="space-y-5">
      {/* Balance metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BalanceCard icon={<Landmark className="h-5 w-5" />} tint="bg-sky-50 text-sky-700" label="Total Bank Balance" value={inr(balances.bankBalance)} opening={`Opening ${inr(balances.openingBankBalance)}`} />
        <BalanceCard icon={<Banknote className="h-5 w-5" />} tint="bg-lime-50 text-lime-700" label="Total Cash in Hand" value={inr(balances.cashBalance)} opening={`Opening ${inr(balances.openingCashInHand)}`} />
        <BalanceCard icon={<PiggyBank className="h-5 w-5" />} tint="bg-gold/10 text-emerald-900" label="Net Total Club Balance" value={inr(balances.clubBalance)} opening="Bank + Cash" />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setModal('entry')} className="btn-primary !py-2.5 text-sm"><Plus className="h-4 w-4" /> Add Income / Expense</button>
        <button onClick={() => setModal('transfer')} className="btn-gold !py-2.5 text-sm"><ArrowLeftRight className="h-4 w-4" /> Internal Transfer</button>
        <button onClick={() => setModal('settings')} className="btn-outline !py-2.5 text-sm"><Settings2 className="h-4 w-4" /> Opening Balance</button>
      </div>

      {/* Category breakdown */}
      {byCategory.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h5 className="mb-3 text-sm font-extrabold text-emerald-900">Spending / Income by Category</h5>
          <div className="flex flex-wrap gap-2">
            {byCategory.map((c, i) => (
              <span key={i} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${c.type === 'Income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                {c.category} · {inr(c.amount)} <ModeBadge mode={c.paymentMode} />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input !pl-9" placeholder="Search ledger entries..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All Types</option>
          <option value="Income">Income</option>
          <option value="Expense">Expense</option>
        </select>
        <select className="input w-auto" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">All Modes</option>
          <option value="Bank">Bank</option>
          <option value="Cash">Cash</option>
        </select>
        <select className="input w-auto" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All Years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={() => setSort((s) => (s === 'date' ? 'amount' : 'date'))} className="btn-outline !py-2.5 text-sm">
          <ArrowDownUp className="h-4 w-4" /> {sort === 'date' ? 'By Date' : 'By Amount'}
        </button>
      </div>

      {/* Ledger */}
      {loading ? (
        <Spinner label="Loading ledger..." />
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <Wallet className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-500">No ledger entries found</p>
          <p className="text-xs text-slate-400">Add an income/expense, or record a Program entry — approved entries sync here automatically.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
            <span className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Ledger</span>
            <span className="text-xs font-semibold text-slate-500">{accounts.length} entries</span>
          </div>
          <ul className="max-h-[480px] divide-y divide-slate-100 overflow-y-auto">
            {accounts.map((a) => (
              <li key={a._id} className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-700">{a.description}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {fmtDate(a.date)}</span>
                    <ModeBadge mode={a.paymentMode} />
                    {a.program && <span className="truncate rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-500">{a.program}</span>}
                    {a.category && <span className="truncate">{a.category}</span>}
                    {a.details && <span className="truncate">· {a.details}</span>}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-extrabold ${a.type === 'Income' ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {a.type === 'Income' ? '+' : '−'}{inr(a.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent transfers */}
      {transfers.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
            <span className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Internal Transfers</span>
            <span className="text-xs font-semibold text-slate-500">{transfers.length} recent</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {transfers.slice(0, 6).map((t) => (
              <li key={t._id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-700">
                    <ModeBadge mode={t.from} /> <ArrowDownUp className="mx-1 inline h-3.5 w-3.5 text-slate-400" /> <ModeBadge mode={t.to} />
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{t.note || 'Internal transfer'} · {fmtDate(t.date)}</p>
                </div>
                <span className="shrink-0 font-bold text-slate-600">{inr(t.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {modal === 'entry' && <EntryModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === 'transfer' && <TransferModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === 'settings' && <SettingsModal balances={balances} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function BalanceCard({ icon, tint, label, value, opening }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-3 inline-flex rounded-xl p-2.5 ${tint}`}>{icon}</div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-emerald-900">{value}</p>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">{opening}</p>
    </div>
  );
}

function ModeToggle({ value, onChange }) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-300">
      {(['Bank', 'Cash']).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-extrabold transition ${value === m ? (m === 'Bank' ? 'bg-sky-600 text-white' : 'bg-lime-600 text-white') : 'bg-white text-slate-500 hover:bg-slate-50'}`}
        >
          {m === 'Bank' ? <Landmark className="h-3 w-3" /> : <Banknote className="h-3 w-3" />} {m}
        </button>
      ))}
    </div>
  );
}

function ModalShell({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-emerald-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-extrabold text-emerald-900">{title}</h4>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-5">{children}</div>
      </motion.div>
    </div>
  );
}

function EntryModal({ onClose, onSaved }) {
  const [type, setType] = useState('Income');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Bank');
  const [category, setCategory] = useState('');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!description.trim()) return toast.error('Description is required');
    if (!amount || Number(amount) <= 0) return toast.error('Amount must be greater than zero');
    setSaving(true);
    try {
      await api.post('/admin/accounts', { type, description, amount, paymentMode, category, details });
      toast.success('Entry recorded');
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Add Income / Expense" subtitle="Every entry requires a payment mode" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {['Income', 'Expense'].map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-extrabold transition ${type === t ? (t === 'Income' ? 'bg-emerald-900 text-white' : 'bg-red-600 text-white') : 'bg-slate-100 text-slate-500'}`}
            >
              {t === 'Income' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} {t}
            </button>
          ))}
        </div>
        <div>
          <label className="label">Description</label>
          <input className="input" placeholder="e.g. Membership fee, Donation, Stage hire..." value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount (₹)</label>
            <input type="number" min="0" step="0.01" className="input" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Payment Mode *</label>
            <ModeToggle value={paymentMode} onChange={setPaymentMode} />
          </div>
        </div>
        {paymentMode === 'Bank' && (
          <div>
            <label className="label">Bank Method (UPI / Transfer / Cheque)</label>
            <input className="input" placeholder="e.g. UPI ref / Cheque no / Online transfer" value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label">Category</label>
          <input className="input" placeholder="e.g. Sponsorship, Food & Refreshment" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <button onClick={save} disabled={saving} className="btn-primary w-full !py-3 disabled:opacity-60">
          {saving ? 'Saving...' : 'Record Entry'}
        </button>
      </div>
    </ModalShell>
  );
}

function TransferModal({ onClose, onSaved }) {
  const [direction, setDirection] = useState('bankToCash');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!amount || Number(amount) <= 0) return toast.error('Amount must be greater than zero');
    setSaving(true);
    try {
      const [from, to] = direction === 'bankToCash' ? ['Bank', 'Cash'] : ['Cash', 'Bank'];
      await api.post('/admin/accounts/transfers', { amount, from, to, note });
      toast.success('Internal transfer recorded');
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Transfer failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Internal Transfer" subtitle="Move money between Bank and Cash — not counted as income/expense" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setDirection('bankToCash')} className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition ${direction === 'bankToCash' ? 'bg-emerald-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
            <Landmark className="h-4 w-4" /> Bank → Cash (Withdraw)
          </button>
          <button onClick={() => setDirection('cashToBank')} className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition ${direction === 'cashToBank' ? 'bg-emerald-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
            <Banknote className="h-4 w-4" /> Cash → Bank (Deposit)
          </button>
        </div>
        <div>
          <label className="label">Amount (₹)</label>
          <input type="number" min="0" step="0.01" className="input" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">Note (optional)</label>
          <input className="input" placeholder="e.g. ATM withdrawal for event expenses" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button onClick={save} disabled={saving} className="btn-primary w-full !py-3 disabled:opacity-60">
          {saving ? 'Saving...' : 'Record Transfer'}
        </button>
      </div>
    </ModalShell>
  );
}

function SettingsModal({ balances, onClose, onSaved }) {
  const [bank, setBank] = useState('');
  const [cash, setCash] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const b = Number(bank);
    const c = Number(cash);
    if (bank === '' || cash === '') return toast.error('Enter both opening balances');
    if (b < 0 || c < 0) return toast.error('Opening balances cannot be negative');
    setSaving(true);
    try {
      await api.put('/admin/accounts/settings', { openingBankBalance: b, openingCashInHand: c });
      toast.success('Opening balances updated');
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Opening Balance Setup" subtitle="Starting Bank & Cash balances for the club" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Current opening: Bank {inr(balances.openingBankBalance)} · Cash {inr(balances.openingCashInHand)}. Updating changes the base for all balance calculations.
        </p>
        <div>
          <label className="label">Opening Bank Balance (₹)</label>
          <input type="number" min="0" step="0.01" className="input" placeholder={String(balances.openingBankBalance)} value={bank} onChange={(e) => setBank(e.target.value)} />
        </div>
        <div>
          <label className="label">Opening Cash in Hand (₹)</label>
          <input type="number" min="0" step="0.01" className="input" placeholder={String(balances.openingCashInHand)} value={cash} onChange={(e) => setCash(e.target.value)} />
        </div>
        <button onClick={save} disabled={saving} className="btn-primary w-full !py-3 disabled:opacity-60">
          {saving ? 'Saving...' : 'Save Opening Balances'}
        </button>
      </div>
    </ModalShell>
  );
}