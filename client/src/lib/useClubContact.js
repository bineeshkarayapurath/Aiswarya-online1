import { useEffect, useState } from 'react';
import api from '../api/client';
import { clubConfig } from './club';

// Official club contact, resolved from the server (GET /api/public/settings) so the
// website footer, the receipts/vouchers and the ID cards all show the same current
// values as the generated PDFs. The values in clubConfig are only the fallback used
// on first paint and when the request fails.
//
// Officer phone numbers are already resolved server-side: a number published in the
// admin settings wins, and otherwise the number on the account of whoever currently
// holds the post is used, so electing a new President or Secretary needs no second
// edit here.
//
// Cached at module level — the footer, the receipt document and every ID card on a
// page share the one request.
const FALLBACK = {
  address: clubConfig.organization.address,
  phoneNumber: clubConfig.organization.phone,
  emailAddress: clubConfig.organization.email,
  presidentPhone: '',
  secretaryPhone: '',
};

let cache = null;
let inflight = null;

function load() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api
      .get('/public/settings')
      .then((res) => {
        cache = { ...FALLBACK, ...(res.data?.settings || {}) };
        return cache;
      })
      .catch(() => {
        // Contact details are decorative here: a failure must never break a
        // receipt or an ID card, so fall back to the white-label config.
        cache = { ...FALLBACK };
        return cache;
      });
  }
  return inflight;
}

// Resolves as soon as the contact block is known. The receipt PDF is captured from
// an off-screen React root, so it has to wait for this instead of racing the
// request and printing the fallback details.
export function clubContactReady() {
  return load();
}

// Called after an admin saves settings so open pages pick up the new contact block.
export function invalidateClubContact() {
  cache = null;
  inflight = null;
}

export default function useClubContact() {
  const [contact, setContact] = useState(cache || FALLBACK);

  useEffect(() => {
    let alive = true;
    load().then((c) => {
      if (alive) setContact(c);
    });
    return () => {
      alive = false;
    };
  }, []);

  return contact;
}
