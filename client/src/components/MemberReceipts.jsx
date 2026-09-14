import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FaReceipt, FaDownload, FaPrint } from 'react-icons/fa';
import { Receipt } from 'lucide-react';
import api from '../api/client';
import Spinner from './Spinner';
import { downloadReceiptPdf, printReceiptPdf } from '../lib/receiptPdf';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function MemberReceipts() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/vouchers/my-receipts');
      setVouchers(r.data.vouchers || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load your receipts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doPrint = async (v) => { setBusyId(v._id); try { await printReceiptPdf(v); } finally { setBusyId(null); } };

  return (
    <div className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-900">
          <FaReceipt className="text-gold" /> My Receipts &amp; Payments
        </h2>
        <span className="text-xs font-semibold text-slate-400">
          {vouchers.length} document{vouchers.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <Spinner label="Loading receipts…" />
      ) : vouchers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 px-6 py-12 text-center">
          <Receipt className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-500">No receipts found</p>
          <p className="max-w-sm text-xs text-slate-400">
            Any receipt issued against your Member ID (fees, donations, payments) will appear here, downloadable and printable anytime.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2 font-extrabold">Date</th>
                <th className="px-3 py-2 font-extrabold">Receipt / Voucher No</th>
                <th className="px-3 py-2 font-extrabold">Purpose</th>
                <th className="px-3 py-2 font-extrabold">Mode</th>
                <th className="px-3 py-2 text-right font-extrabold">Amount</th>
                <th className="px-3 py-2 text-center font-extrabold">Status</th>
                <th className="px-3 py-2 text-center font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vouchers.map((v) => (
                <tr key={v._id} className="hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{fmtDate(v.date)}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span className={`chip ${v.type === 'RECEIPT' ? 'bg-emerald-900 text-amber-300' : 'bg-red-600/10 text-red-700'}`}>
                      {v.type === 'RECEIPT' ? 'RCP' : 'VCH'}
                    </span>
                    <span className="ml-2 font-extrabold text-slate-700">{v.voucherNo}</span>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-700">{v.category || 'General'}</p>
                    {v.remarks && <p className="text-[11px] text-slate-400">{v.remarks}</p>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{v.paymentMode.replace(/_/g, ' ')}</td>
                  <td className={`whitespace-nowrap px-3 py-3 text-right font-extrabold ${v.type === 'RECEIPT' ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {v.type === 'RECEIPT' ? '+' : '−'}{inr(v.amount)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="chip bg-emerald-50 text-emerald-700">Posted</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => downloadReceiptPdf(v)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-900/10 px-2.5 py-1.5 text-xs font-bold text-emerald-900 transition hover:bg-emerald-900 hover:text-white"
                      >
                        <FaDownload /> PDF
                      </button>
                      <button
                        onClick={() => doPrint(v)}
                        disabled={busyId === v._id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gold/10 px-2.5 py-1.5 text-xs font-bold text-gold transition hover:bg-gold hover:text-white disabled:opacity-60"
                      >
                        <FaPrint /> {busyId === v._id ? '…' : 'Print'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}