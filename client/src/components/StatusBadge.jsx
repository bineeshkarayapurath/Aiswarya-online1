import { useAuth } from '../context/AuthContext';

const STATUS_STYLES = {
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const STATUS_LABELS = {
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export function StatusBadge({ status }) {
  return (
    <span className={`chip ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-700'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function useRequireStatus(expected) {
  const { user } = useAuth();
  return user?.status === expected;
}