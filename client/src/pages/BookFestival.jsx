import { motion } from 'framer-motion';
import BookFestivalRequests from '../components/BookFestivalRequests';

export default function BookFestival() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-gold">Book Festival</p>
        <h1 className="mt-1 text-3xl font-extrabold text-emerald-900 dark:text-white">
          Book Request Wishlist
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
          Help us stock the shelves. Browse what members have already asked for, then sign in to add
          your own suggestion for the library collection.
        </p>
      </motion.div>

      <BookFestivalRequests />
    </div>
  );
}
