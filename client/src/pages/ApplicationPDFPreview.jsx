import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTimes } from 'react-icons/fa';
import ApplicationPDF from '../components/ApplicationPDF';
import { sampleApprovedMember } from '../lib/sampleData';

export default function ApplicationPDFPreview() {
  const navigate = useNavigate();
  const onClose = () => navigate('/');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-200 pt-4">
      <div className="mx-auto max-w-lg px-4 text-center">
        <span className="chip mb-4 bg-amber-100 text-amber-800">
          DEV MODE — Application PDF Letterhead Preview
        </span>
        <p className="mb-4 text-xs text-slate-500">
          Printable A4 letterhead with approval stamp — preview generated on-screen.
        </p>
      </div>
      <ApplicationPDF user={{ ...sampleApprovedMember }} onClose={onClose} />
    </div>
  );
}