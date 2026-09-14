import { useEffect, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Package,
  IndianRupee,
  Search,
  Plus,
  Pencil,
  Trash2,
  Boxes,
  Calendar,
} from 'lucide-react';
import { FaSave, FaTimes } from 'react-icons/fa';
import api from '../api/client';
import Spinner from './Spinner';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const CATEGORIES = ['Furniture', 'Electronics', 'Library Shelves', 'Appliances', 'Other'];
const CONDITIONS = ['Good', 'Needs Repair', 'Disposed'];

const CONDITION_STYLES = {
  Good: 'bg-emerald-100 text-emerald-800',
  'Needs Repair': 'bg-amber-100 text-amber-800',
  Disposed: 'bg-red-100 text-red-700',
};

export default function AssetsPanel() {
  const [assets, setAssets] = useState([]);
  const [summary, setSummary] = useState({ totalItems: 0, totalValue: 0 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All');
  const [condition, setCondition] = useState('All');
  const [modal, setModal] = useState(null); // null | { mode: 'add', asset: null } | { mode: 'edit', asset }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/assets', {
        params: {
          q: q || undefined,
          category: category === 'All' ? undefined : category,
          condition: condition === 'All' ? undefined : condition,
        },
      });
      setAssets(res.data.assets || []);
      setSummary(res.data.summary || { totalItems: 0, totalValue: 0 });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [q, category, condition]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (asset) => {
    const ok = window.confirm(`Delete "${asset.itemName}" (${asset.quantity}) from inventory?`);
    if (!ok) return;
    try {
      await api.delete(`/assets/${asset._id}`);
      toast.success('Asset removed');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 inline-flex rounded-xl bg-emerald-100 p-2.5 text-emerald-800">
            <Boxes className="h-5 w-5" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Total Items Count</p>
          <p className="mt-1 text-3xl font-extrabold text-emerald-900">{summary.totalItems}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 inline-flex rounded-xl bg-gold/15 p-2.5 text-gold">
            <IndianRupee className="h-5 w-5" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Total Asset Valuation</p>
          <p className="mt-1 text-3xl font-extrabold text-emerald-900">{inr(summary.totalValue)}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input !pl-9"
            placeholder="Search assets (e.g. Table, Chair, TV)..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="All">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="input w-auto" value={condition} onChange={(e) => setCondition(e.target.value)}>
          <option value="All">All Conditions</option>
          {CONDITIONS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button onClick={() => setModal({ mode: 'add', asset: null })} className="btn-primary !py-2.5 text-sm">
          <Plus className="h-4 w-4" /> Add New Asset
        </button>
      </div>

      {/* Asset table */}
      {loading ? (
        <Spinner label="Loading assets..." />
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <Package className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-500">No assets found</p>
          <p className="text-xs text-slate-400">
            Add your first asset (e.g. Table, Chair, Shelf, TV, Computer) to build the club inventory register.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
            <span className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Inventory Register</span>
            <span className="text-xs font-semibold text-slate-500">{assets.length} item{assets.length === 1 ? '' : 's'}</span>
          </div>
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Item</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Total Value</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">Purchased</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a._id} className="border-b border-slate-50 transition last:border-0 hover:bg-slate-50/60">
                  <td className="max-w-[240px] px-5 py-3">
                    <p className="truncate font-bold text-slate-800">{a.itemName}</p>
                    {a.notes && <p className="truncate text-xs text-slate-400">{a.notes}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-emerald-900/5 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900">
                      {a.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">{a.quantity}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{inr(a.unitPrice)}</td>
                  <td className="px-4 py-3 text-right font-extrabold text-emerald-900">{inr(a.totalValue)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${CONDITION_STYLES[a.condition] || CONDITION_STYLES.Good}`}>
                      {a.condition}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar className="h-3.5 w-3.5" /> {fmtDate(a.purchaseDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setModal({ mode: 'edit', asset: a })}
                        title="Edit"
                        className="rounded-lg bg-emerald-900/10 p-2 text-emerald-900 transition hover:bg-emerald-900 hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(a)}
                        title="Delete"
                        className="rounded-lg bg-red-50 p-2 text-red-600 transition hover:bg-red-600 hover:text-white"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <AssetModal
          mode={modal.mode}
          asset={modal.asset}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function AssetModal({ mode, asset, onClose, onSaved }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    itemName: asset?.itemName || '',
    category: asset?.category || 'Furniture',
    quantity: asset?.quantity ?? 1,
    unitPrice: asset?.unitPrice ?? 0,
    condition: asset?.condition || 'Good',
    purchaseDate: asset?.purchaseDate ? new Date(asset.purchaseDate).toISOString().slice(0, 10) : '',
    notes: asset?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.itemName.trim()) return toast.error('Item name is required');
    if (Number(form.quantity) < 0) return toast.error('Quantity cannot be negative');
    if (Number(form.unitPrice) < 0) return toast.error('Price cannot be negative');
    setSaving(true);
    try {
      const payload = {
        itemName: form.itemName.trim(),
        category: form.category,
        quantity: Number(form.quantity) || 0,
        unitPrice: Number(form.unitPrice) || 0,
        condition: form.condition,
        purchaseDate: form.purchaseDate || null,
        notes: form.notes.trim(),
      };
      const res = isEdit
        ? await api.put(`/assets/${asset._id}`, payload)
        : await api.post('/assets', payload);
      toast.success(res.data.message);
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save asset');
    } finally {
      setSaving(false);
    }
  };

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
            <h4 className="text-base font-extrabold text-emerald-900">
              {isEdit ? `Edit ${asset.itemName}` : 'Add New Asset'}
            </h4>
            <p className="text-xs text-slate-500">
              {isEdit ? 'Update quantity, price or condition over time.' : 'Add an item to the club inventory register.'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
            <FaTimes className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4">
          <div>
            <label className="label">Item Name</label>
            <input
              className="input"
              placeholder="e.g. Table, Chair, Shelf, TV, Computer"
              value={form.itemName}
              onChange={set('itemName')}
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantity</label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.quantity}
                onChange={set('quantity')}
              />
            </div>
            <div>
              <label className="label">Price per Unit (₹)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.unitPrice}
                onChange={set('unitPrice')}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Condition</label>
              <select className="input" value={form.condition} onChange={set('condition')}>
                {CONDITIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Purchase Date</label>
              <input className="input" type="date" value={form.purchaseDate} onChange={set('purchaseDate')} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-[70px]"
              placeholder="Optional details, location, condition remarks..."
              value={form.notes}
              onChange={set('notes')}
            />
          </div>

          <div className="rounded-xl bg-emerald-900/5 px-4 py-3 text-xs font-semibold text-emerald-900">
            Total Value: {inr((Number(form.quantity) || 0) * (Number(form.unitPrice) || 0))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="btn-outline !py-2.5 text-sm">
            <FaTimes className="h-3.5 w-3.5" /> Cancel
          </button>
          <button onClick={submit} disabled={saving} className="btn-primary !py-2.5 text-sm disabled:opacity-60">
            <FaSave className="h-3.5 w-3.5" /> {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Asset'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}