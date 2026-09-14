import { motion } from 'framer-motion';

export default function Spinner({ label = 'Processing...' }) {
  const dots = [0, 1, 2];
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="flex items-center gap-1.5">
        {dots.map((i) => (
          <motion.span
            key={i}
            className="h-3 w-3 rounded-full bg-gold"
            animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
    </div>
  );
}