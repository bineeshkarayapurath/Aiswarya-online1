import IDCard from '../components/IDCard';
import { sampleApprovedMember } from '../lib/sampleData';

export default function IDCardPreview() {
  return (
    <div className="min-h-[70vh] bg-slate-200 px-4 py-14">
      <div className="mx-auto max-w-lg text-center">
        <span className="chip mb-4 bg-amber-100 text-amber-800">
          DEV MODE — ID Card Preview (CR80 85.6mm × 53.98mm)
        </span>
        <h1 className="mb-8 text-2xl font-extrabold text-emerald-900">
          Digital PVC ID Card
        </h1>
        <IDCard user={{ ...sampleApprovedMember }} />
        <p className="mt-8 text-xs text-slate-500">
          Flip the card above to see the back. Printed card dimensions: 85.6mm × 53.98mm.
        </p>
      </div>
    </div>
  );
}