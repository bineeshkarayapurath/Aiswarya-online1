import { useState } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { CLUB } from '../lib/club';
import clubConfig from '../config/clubConfig';
import { FaIdCard } from 'react-icons/fa';
import { resolveMedia } from '../api/client';

const RULES = [
  '1. Present this card upon entry to the library.',
  '2. Keep premises clean & maintain silence inside.',
  '3. Issued books must be returned on due date.',
  '4. Card is non-transferable & club property.',
  '5. Duplicate card issued on nominal fee.',
  '6. Members shall abide by club committee rules.',
];

export default function IDCard({ user, showActions = false, onDownload }) {
  const [side, setSide] = useState('front');

  const qrValue = JSON.stringify({
    t: clubConfig.organization.qrType,
    id: user.membershipId,
    name: user.fullName,
    phone: user.phoneNumber,
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative" style={{ perspective: 1200 }}>
        <motion.div
          key={side}
          initial={{ rotateY: side === 'back' ? -90 : 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden rounded-xl border border-emerald-900/20 shadow-2xl shadow-slate-300"
          style={{
            width: 344,
            height: 217,
            transformStyle: 'preserve-3d',
          }}
        >
          {side === 'front' ? (
            <FrontFace user={user} qrValue={qrValue} />
          ) : (
            <BackFace user={user} />
          )}
        </motion.div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setSide(side === 'front' ? 'back' : 'front')}
          className="btn-outline !py-2 text-sm"
        >
          <FaIdCard /> Flip Card
        </button>
        {showActions && (
          <button type="button" onClick={onDownload} className="btn-gold !py-2 text-sm">
            Download Printable Card
          </button>
        )}
      </div>
    </div>
  );
}

function FrontFace({ user, qrValue }) {
  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-br from-[var(--pdf-cardCream1)] to-[var(--pdf-cardCream2)]">
      {/* Header: emblem + large title + centered location/reg no */}
      <header className="flex items-center gap-3 border-b-[3px] border-gold bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-700 px-3 py-2">
        <img
          src={CLUB.logo}
          alt="Club Logo"
          className="h-11 w-11 shrink-0 rounded-lg border-2 border-gold bg-white object-contain shadow"
        />
        <div className="min-w-0">
          <p className="text-[13px] font-black leading-tight text-white">
            {CLUB.longName}
          </p>
          <div className="mt-1 space-y-[1px] text-center leading-snug">
            <p className="text-[9.5px] font-bold tracking-widest text-gold-300">
              {CLUB.place.toUpperCase()}
            </p>
            <p className="text-[9.5px] font-bold text-white/90">Reg No: {CLUB.regNo}</p>
          </div>
        </div>
      </header>

      {/* Body: photo + middle details + QR (fills card) */}
      <div className="relative flex flex-1 items-center gap-2.5 px-2.5 py-2.5">
        {/* Member photo (no background watermark) */}
        <div className="shrink-0 self-center rounded-lg border-[2.5px] border-gold bg-white p-0.5 shadow-md">
          <img
            src={user.photoUrl ? resolveMedia(user.photoUrl) : CLUB.logo}
            alt="Member"
            className="h-[112px] w-[84px] rounded-md object-cover"
          />
        </div>

        {/* Member details — expanded middle block */}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-y-[5px]">
          <p className="line-clamp-2 text-[12.5px] font-black leading-tight text-slate-800">
            {user.fullName}
          </p>
          <p className="line-clamp-2 text-[9px] font-medium leading-snug text-slate-600">
            {user.address || '—'}
          </p>
          <span className="inline-flex w-fit items-center rounded-full bg-gold px-2.5 py-[3px] text-[11px] font-extrabold tracking-wide text-emerald-950 shadow-sm">
            {user.membershipId || '—'}
          </span>
          <DetailRow label="Phone" value={user.phoneNumber} />
          <DetailRow label="Email" value={user.email} />
          <DetailRow label="DOB" value={user.dob?.slice(0, 10)} />
        </div>

        {/* QR code — far right */}
        <div className="shrink-0 self-center rounded-md bg-white p-1 shadow">
          <QRCodeSVG value={qrValue} size={80} fgColor={clubConfig.themeColors.qr} />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <p className="truncate text-[9.5px] font-semibold text-slate-700">
      <span className="mr-1 text-[7.5px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {value || '—'}
    </p>
  );
}

function BackFace({ user }) {
  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-br from-[var(--pdf-cardCream1)] to-[var(--pdf-cardCream2)]">
      <div className="flex h-[30px] items-center justify-center border-b-[3px] border-gold bg-emerald-900">
        <p className="text-[10.5px] font-bold tracking-widest text-white">
          CLUB RULES &amp; MEMBER INFORMATION
        </p>
      </div>

      {/* Body with club logo watermark at 30% opacity */}
      <div className="relative flex-1 px-4 py-2">
        <img
          src={CLUB.logo}
          alt="Club Watermark"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-30"
        />
        <div className="relative space-y-[3.5px] text-[8.5px] leading-[1.35] text-slate-700">
          {RULES.map((r) => (
            <p key={r}>{r}</p>
          ))}
        </div>
      </div>

      {/* Issued + signatures */}
      <div className="border-t border-gold px-4 py-1.5 text-[8.5px] text-slate-700">
        <p className="mb-1 text-[9px]">Issued: {user.approvedAt?.slice(0, 10) || '—'}</p>
        <div className="flex items-end justify-between">
          <div>
            <div className="mb-0.5 h-2 border-b border-gold" />
            <p className="text-center text-[9px] font-bold text-slate-600">Authorised Signature</p>
          </div>
          <div>
            <div className="mb-0.5 h-2 border-b border-gold" />
            <p className="text-center text-[9px] font-bold text-slate-600">Secretary</p>
          </div>
        </div>
      </div>
    </div>
  );
}