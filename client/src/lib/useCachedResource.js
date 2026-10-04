import { useCallback, useEffect, useRef, useState } from 'react';

// Generic stale-while-revalidate cache for public, read-only GET resources.
//
// Why hand-rolled instead of React Query / SWR: the app already had one
// hand-rolled module-level cache (lib/useClubSignatures.js) and zero data
// fetching dependencies, so this stays consistent with the existing style and
// adds nothing to the bundle. That cache already de-duped concurrent requests;
// this generalises it and adds cross-reload persistence.
//
// What it buys us for the home page (Landing.jsx):
//   * a reload renders the cached catalog/stats/gallery instantly instead of
//     flashing "Loading catalog..." while three requests are in flight,
//   * revisiting "/" through client-side routing needs no network at all,
//   * several components asking for the same key share a single request,
//   * revalidation still happens in the background once an entry goes stale.
//
// Entries live in a module-level Map (shared by every consumer in the tab) and
// are mirrored into sessionStorage so they survive a full page reload. Only
// public data belongs here — anything user-specific must not be persisted.

const entries = new Map();
const inflight = new Map();

const STORAGE_PREFIX = 'al_res:';
// While an entry is younger than this it is served with no network call at all.
// Past that we still render the cached value, but kick off a background
// revalidation.
const FRESH_FOR_MS = 60 * 1000;
// Stop offering entries from sessionStorage after this long, so returning to a
// tab hours later never renders outdated data.
const MAX_STALE_MS = 30 * 60 * 1000;
// Bound the memory + sessionStorage footprint (oldest keys evicted first).
const MAX_ENTRIES = 24;
// Guard against a pathological payload filling the sessionStorage quota.
const MAX_PERSIST_BYTES = 256 * 1024;

function storageKey(key) {
  return STORAGE_PREFIX + key;
}

function removePersisted(key) {
  try {
    sessionStorage.removeItem(storageKey(key));
  } catch {
    // Storage can be unavailable (private mode / blocked cookies). The
    // in-memory cache still works, so this is not worth surfacing.
  }
}

function evictIfNeeded(key) {
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined || oldest === key) break;
    entries.delete(oldest);
    removePersisted(oldest);
  }
}

function readPersisted(key) {
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw || raw.length > MAX_PERSIST_BYTES) {
      if (raw) removePersisted(key);
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.at !== 'number') return null;
    if (Date.now() - parsed.at > MAX_STALE_MS) {
      removePersisted(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(key, entry) {
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // Quota exceeded or storage disabled — the memory cache stays authoritative.
  }
}

// `{ data, at }` for any usable entry, however old. Callers decide whether an
// old entry still counts as fresh.
function readCache(key) {
  const mem = entries.get(key);
  if (mem) return mem;
  const disk = readPersisted(key);
  if (disk) entries.set(key, disk);
  return disk;
}

// One request per key, no matter how many components ask at the same time.
function fetchResource(key, fetcher) {
  const pending = inflight.get(key);
  if (pending) return pending;

  const request = Promise.resolve()
    .then(() => fetcher())
    .then((data) => {
      const entry = { data, at: Date.now() };
      entries.set(key, entry);
      evictIfNeeded(key);
      writePersisted(key, entry);
      return data;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, request);
  return request;
}

// Drop one key, or every key starting with `prefix` when prefix is given. Call
// this after a mutation so the next read refetches instead of serving the
// pre-mutation value.
export function invalidateCachedResource(prefix) {
  for (const key of Array.from(entries.keys())) {
    if (prefix === undefined || key.startsWith(prefix)) {
      entries.delete(key);
      removePersisted(key);
    }
  }
  for (const key of Array.from(inflight.keys())) {
    if (prefix === undefined || key.startsWith(prefix)) inflight.delete(key);
  }
}

// One cache key per /public/catalog shape so the home page strip and the member
// browse/search panel de-duplicate whenever they ask for the same thing.
export const publicCatalogKey = (q = '', limit = 60) => `public/catalog?q=${q || ''}&limit=${limit}`;

// The rotating home page strip is its own shape: it asks the server for a fresh
// random sample rather than a fixed page, so it must NOT share a key with a
// browse request or the two would fight over one cache entry.
export const FEATURED_CATALOG_KEY = 'public/catalog?featured=1';

// Matches the server's 'catalog:featured' TTL so the client and the API rotate
// on roughly the same schedule. Slightly longer on the client, which lets a
// visitor navigating back to the home page within the window avoid a request
// without the strip visibly stalling.
export const FEATURED_REFRESH_MS = 15 * 1000;

// The member total is the one number an officer expects to move the moment they
// approve someone, so it revalidates on a much shorter window than the default
// 60 s. The cached value still paints immediately and is replaced in the
// background, so this costs a request, never a spinner.
export const STATS_REFRESH_MS = 15 * 1000;

/**
 * @param {string} key                   Stable cache key.
 * @param {() => Promise<any>} fetcher   Request; resolves to the value to cache.
 * @param {{ revalidateAfter?: number }} [options]
 * @returns {{ data: any, isLoading: boolean, isValidating: boolean, error: Error|null, revalidate: () => void }}
 *   `isLoading` is true only while there is nothing to render yet, which is what
 *   lets a component keep showing cached content instead of a spinner when a
 *   revalidation is in flight.
 */
export default function useCachedResource(key, fetcher, options = {}) {
  const revalidateAfter = options.revalidateAfter ?? FRESH_FOR_MS;

  const [state, setState] = useState(() => {
    const cached = readCache(key);
    return { entry: cached ?? null, isValidating: !cached, error: null };
  });

  // Held in a ref so a new fetcher closure never restarts the effect.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // When the caller switches keys (a new search term, say) the previous key's
  // value must not linger: re-derive the state for the new key during render so
  // the effect below never paints stale content under the new key.
  const [activeKey, setActiveKey] = useState(key);
  if (activeKey !== key) {
    const cached = readCache(key);
    setActiveKey(key);
    setState({ entry: cached ?? null, isValidating: !cached, error: null });
  }

  const run = useCallback(
    (force) => {
      const cached = readCache(key);
      if (!force && cached && Date.now() - cached.at <= revalidateAfter) {
        setState({ entry: cached, isValidating: false, error: null });
        return;
      }
      setState((prev) => ({
        // Show a stale value immediately rather than blanking the screen.
        entry: cached ?? prev.entry,
        isValidating: true,
        error: null,
      }));
      fetchResource(key, fetcherRef.current).then(
        (data) => setState({ entry: { data, at: Date.now() }, isValidating: false, error: null }),
        // A failed revalidation must never blank out content that is already on
        // screen, so the stale entry is deliberately kept.
        (error) => setState((prev) => ({ ...prev, isValidating: false, error })),
      );
    },
    [key, revalidateAfter],
  );

  useEffect(() => {
    run(false);
  }, [run]);

  const revalidate = useCallback(() => run(true), [run]);

  return {
    data: state.entry ? state.entry.data : undefined,
    isLoading: !state.entry && state.isValidating,
    isValidating: state.isValidating,
    error: state.error,
    revalidate,
  };
}