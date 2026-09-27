import { useEffect, useState } from 'react';
import api, { resolveMedia } from '../api/client';

// Officer signatures are global club settings — identical for every card — so a
// single request is shared by every IDCard instance on the page (the admin
// members list can render many cards at once). Cached at module level to avoid
// refetching per card.
let cache = null;
let inflight = null;

function load() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api
      .get('/settings/signatures')
      .then((res) => {
        cache = res.data?.signatures || {};
        return cache;
      })
      .catch(() => {
        // Signatures are optional: a failure must never break the ID card.
        cache = {};
        return cache;
      });
  }
  return inflight;
}

// Called after an admin uploads or clears a signature so cards pick up the change.
export function invalidateClubSignatures() {
  cache = null;
  inflight = null;
}

export default function useClubSignatures() {
  const [signatures, setSignatures] = useState(cache || {});

  useEffect(() => {
    let alive = true;
    load().then((s) => {
      if (alive) setSignatures(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const resolve = (url) => (url ? resolveMedia(url) : '');
  return {
    presidentSignatureUrl: resolve(signatures.presidentSignatureUrl),
    secretarySignatureUrl: resolve(signatures.secretarySignatureUrl),
  };
}
