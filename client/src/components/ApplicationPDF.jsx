import { useState } from 'react';
import { motion } from 'framer-motion';
import { CLUB } from '../lib/club';
import { FaPrint, FaTimes } from 'react-icons/fa';
import clubConfig from '../config/clubConfig';
import { resolveMedia } from '../api/client';
import useClubSignatures from '../lib/useClubSignatures';
import useClubContact from '../lib/useClubContact';

const ROWS = (user) => [
  ['Membership ID', user.membershipId || 'Pending'],
  ['Full Name', user.fullName],
  ['Date of Birth', user.dob?.slice(0, 10) || '—'],
  ['Age', user.age != null ? `${user.age} years` : '—'],
  ['Phone', user.phoneNumber],
  ['Email', user.email || '—'],
  ['Occupation', user.occupation || '—'],
  ['Qualification', user.education || '—'],
  ['Address', user.address || '—'],
  ['Recommender', user.recommender?.name || '—'],
];

// One officer sign-off: the signature rests on the rule, the post is captioned
// underneath, followed by the number the club publishes for it — the same block
// the generated PDFKit letterhead prints above its footer.
function SignatureBlock({ officer }) {
  return (
    <div className="w-56 text-center">
      <div className="flex h-12 items-end justify-center">
        <img
          src={officer.url}
          alt={`${officer.label} signature`}
          className="max-h-11 max-w-full object-contain"
        />
      </div>
      <div className="border-t border-emerald-900 pt-1 text-xs font-bold text-emerald-900">
        {officer.label}
      </div>
      <div className="text-[11px] text-slate-500">Authorised Signatory</div>
      {officer.phone && <div className="text-[11px] text-slate-500">{officer.phone}</div>}
    </div>
  );
}

export default function ApplicationPDF({ user, onClose }) {
  const [photoBroken, setPhotoBroken] = useState(false);
  const { presidentSignatureUrl, secretarySignatureUrl } = useClubSignatures();
  const contact = useClubContact();

  const fmt = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  // Configured officer signatures only — an absent signature must not leave a
  // blank line that reads as one. President and Secretary side by side when both
  // are stored; a lone signature takes the right of the row, where an approval
  // signature belongs — the layout documentSignatureBlocks() uses on the
  // generated PDF.
  const officers = [
    { url: presidentSignatureUrl, label: 'President', phone: contact.presidentPhone },
    { url: secretarySignatureUrl, label: 'Secretary', phone: contact.secretaryPhone },
  ].filter((o) => o.url);

  // The photo and the signature images are fetched at render time, so printing
  // straight after mount captured a blank frame while they were still loading.
  // Wait for every image inside the letterhead (with a ceiling, so a dead CDN
  // link cannot hang the print dialog) before handing over to the browser.
  const handlePrint = async () => {
    const images = Array.from(document.querySelectorAll('#application-pdf img'));
    await Promise.race([
      Promise.all(
        images.map((img) => {
          if (img.complete) return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          });
        })
      ),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    window.print();
  };

  const photoSrc = user.photoUrl ? resolveMedia(user.photoUrl) : '';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-emerald-950/50 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-h-[92vh] w-full max-w-[820px] overflow-y-auto rounded-2xl bg-[#f0f2f5] shadow-2xl"
      >
        <div className="flex items-center justify-between p-4">
          <p className="text-sm font-bold text-emerald-900">Application Letterhead Preview</p>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="btn-primary !py-1.5 text-xs"
            >
              <FaPrint /> Print
            </button>
            <button
              onClick={onClose}
              className="rounded-lg bg-white px-3 py-1.5 text-slate-500 shadow hover:bg-slate-100"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* A4 letterhead */}
        <div id="application-pdf" className="mx-auto max-w-[720px] bg-white p-10 shadow-xl print:max-w-none print:shadow-none">
          {/* Header */}
          <div className="flex items-start gap-4 border-b-2 border-gold pb-4">
            <img src={CLUB.logo} alt="logo" className="h-16 w-16 object-contain" />
            <div className="flex-1 text-center">
              <h1 className="text-xl font-extrabold uppercase tracking-wide text-emerald-900">
                {CLUB.fullName}
              </h1>
              <p className="text-sm text-slate-500">{CLUB.tagline}</p>
              <p className="mt-1 text-sm font-bold text-gold">Reg No: {CLUB.regNo}</p>
            </div>
            {photoSrc && !photoBroken ? (
              <img
                src={photoSrc}
                alt="photo"
                onError={() => setPhotoBroken(true)}
                className="h-20 w-16 rounded border border-slate-300 object-cover"
              />
            ) : (
              /* Same framed placeholder the generated PDFKit letterhead prints,
                 so a missing or unreadable photo is called out rather than
                 leaving an empty gap where the picture should be. */
              <div className="flex h-20 w-16 items-center justify-center rounded border border-slate-300 bg-slate-50 text-xs text-slate-400">
                Photo
              </div>
            )}
          </div>

          <h2 className="mt-6 text-center text-lg font-extrabold text-emerald-900">
            Membership Application
          </h2>
          <p className="text-center text-xs text-slate-400">
            (Receipt of Application &amp; Record of Approval)
          </p>

          {/* Details */}
          <div className="mt-6 grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
            {ROWS(user).map(([k, v]) => (
              <>
                <div className="font-bold text-slate-600">{k}</div>
                <div className="text-slate-800">{v}</div>
              </>
            ))}
          </div>

          <p className="mt-4 text-sm text-slate-600">
            <span className="font-bold text-slate-700">Recommender Member ID: </span>
            {user.recommender?.memberId || '—'}
          </p>

          {/* Approval stamp */}
          {user.status === 'APPROVED' && (
            <div className="mt-10 flex justify-end">
              <div className="w-44 rounded-xl border-2 border-emerald-900 p-3 text-center">
                <p className="text-base font-extrabold tracking-wide text-emerald-900">APPROVED</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Authorised by: {user.approvedBy || 'Club Authority'}
                </p>
                <p className="text-[10px] text-slate-500">Date: {fmt(user.approvedAt)}</p>
              </div>
            </div>
          )}

          {/* Officer sign-offs — the club's stored Secretary / President
              signature images, captioned with the post and its published
              number. Mirrors documentSignatureBlocks() in the PDFKit service so
              the printed letterhead and the downloaded PDF agree. */}
          {officers.length > 0 && (
            <div className={`mt-10 flex gap-8 ${officers.length === 1 ? 'justify-end' : 'justify-between'}`}>
              {officers.map((officer) => (
                <SignatureBlock key={officer.label} officer={officer} />
              ))}
            </div>
          )}

          <p className="mt-10 text-center text-[11px] italic text-slate-400">
            This is a computer generated document. Any signature shown is the club&rsquo;s stored
            official signature.
          </p>
          <p className="mt-8 text-center text-xs text-slate-500">
            Certificate of Membership • Digital Record
          </p>
        </div>

        {/* print styles */}
        <style>{`
          @media print {
            /* Isolate the letterhead: only this document paints. */
            body * { visibility: hidden; }
            #application-pdf, #application-pdf * { visibility: visible; }
            #application-pdf { position: absolute; left: 0; top: 0; width: 100%; }

            /* The site chrome is already unpainted by the rule above, but it was
               still laid out, which put the app's own <footer> — the "About the
               club" block, whose Malayalam copy opens with the club's name in
               Malayalam script — in the page flow underneath the letterhead, and
               dragged a trailing blank sheet out of the printer with it. Removing
               these elements from flow as well is what actually keeps them off the
               printed application; the letterhead header and the address line
               inside #application-pdf use plain divs, so they are untouched. */
            header, footer, nav, aside { display: none; }
          }
        `}</style>
      </motion.div>
    </div>
  );
}