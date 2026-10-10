import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Polls from '../components/Polls';

export default function PollsPage() {
  const { idOrSlug } = useParams();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gold">Your Voice Matters</p>
        <h1 className="mt-1 text-3xl font-extrabold text-emerald-900 dark:text-white">Polls</h1>
      </motion.div>
      <Polls focusSlug={idOrSlug || null} />
    </div>
  );
}
