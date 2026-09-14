import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FaClock, FaCheckCircle, FaWhatsapp } from 'react-icons/fa';
import { CLUB } from '../lib/club';

export default function PendingApproval() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        <div className="card relative overflow-hidden p-10">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-gold via-emerald-600 to-gold" />

          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
            <FaClock className="text-4xl text-amber-500" />
          </div>

          <span className="chip mx-auto bg-amber-100 text-amber-800">PENDING APPROVAL</span>

          <h1 className="mt-5 text-2xl font-extrabold text-emerald-900">
            Application Received!
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Your membership application for{' '}
            <span className="font-semibold text-emerald-900">
              {CLUB.fullName}
            </span>{' '}
            has been received and is pending approval.
          </p>

          <div className="mt-6 rounded-xl bg-gold/5 p-4 text-left text-sm text-slate-600">
            <p className="mb-2 flex items-center gap-2 font-semibold text-emerald-900">
              <FaCheckCircle className="text-emerald-600" /> Next Steps
            </p>
            <ol className="list-inside list-decimal space-y-1.5 pl-1 text-slate-600">
              <li>
                Please visit the club office to <strong>pay the membership fee</strong> to
                the authorised club authorities.
              </li>
              <li>
                Once payment is confirmed, your account will be approved and your unique{' '}
                <strong>Membership ID</strong> will be assigned.
              </li>
              <li>
                Your official <strong>Application PDF</strong> and printable{' '}
                <strong>Digital PVC ID Card</strong> will be generated automatically.
              </li>
              <li>
                Login with your phone number to access your documents after approval.
              </li>
            </ol>
          </div>

          <div className="mt-4 rounded-xl bg-emerald-900/5 p-3 text-xs text-slate-500">
            <FaWhatsapp className="mr-1 inline-block text-emerald-600" />
            You will also receive WhatsApp updates on the status of your application.
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/" className="btn-outline !py-2 text-sm">
              Back to Home
            </Link>
            <Link to="/member-login" className="btn-primary !py-2 text-sm">
              Check Status / Login
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}