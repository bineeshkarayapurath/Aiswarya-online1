// Short-lived in-process cache for the public, read-only home-page payloads
// (stats, catalog preview, approved events).
//
// The club's catalog changes a handful of times a week, yet every anonymous
// visitor used to trigger the same three Mongo queries on every page load. This
// keeps the same hand-rolled TTL approach as services/accountService.js, plus
// in-flight de-duplication: a burst of concurrent visitors (or the three
// parallel requests one home page makes) collapses into a single query instead
// of one per request.
//
// Deliberately NOT used for member- or admin-scoped data, and NOT shared between
// processes — each API instance keeps its own copy, which is fine because the
// cached payloads are identical for everyone.

const TTL_MS = {
  stats: 30 * 1000,
  // Keyed per page size, e.g. 'catalog:8' and 'catalog:60'.
  catalog: 30 * 1000,
};

// Emergency escape hatch: keep the map from growing without bound if a caller
// ever derives cache keys from unbounded input.
const MAX_ENTRIES = 64;

const entries = new Map();
const inflight = new Map();

// The home page strip is meant to show something different each visit, so it gets
// a much shorter window than browse. Still far longer than the ~1.3 ms $sample it
// guards, so a burst of visitors collapses into one query and the rotation is
// driven by elapsed time rather than by traffic.
const FEATURED_SCOPE = 'catalog:featured';
const FEATURED_TTL_MS = 10 * 1000;

function ttlFor(scope) {
  if (scope === FEATURED_SCOPE) return FEATURED_TTL_MS;
  return TTL_MS[scope.split(':')[0]] ?? 15 * 1000;
}

function read(scope) {
  const hit = entries.get(scope);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlFor(scope)) {
    entries.delete(scope);
    return null;
  }
  return hit;
}

function evictIfNeeded(scope) {
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined || oldest === scope) break;
    entries.delete(oldest);
  }
}

/**
 * Resolve `scope` through the cache, calling `producer` at most once per TTL
 * window. Concurrent callers share the same in-flight promise, so a cold cache
 * under load still results in a single database query.
 *
 * Failures are never cached: a rejected `producer` propagates to every caller
 * and leaves the cache untouched, so a transient Mongo error cannot pin a bad
 * response for the whole TTL.
 */
async function remember(scope, producer) {
  const hit = read(scope);
  if (hit) return { data: hit.data, hit: true };

  let pending = inflight.get(scope);
  if (!pending) {
    pending = Promise.resolve()
      .then(() => producer())
      .then((data) => {
        const entry = { data, at: Date.now() };
        entries.set(scope, entry);
        evictIfNeeded(scope);
        return data;
      })
      .finally(() => inflight.delete(scope));
    inflight.set(scope, pending);
  }

  return { data: await pending, hit: false };
}

/** True when the scope currently holds a usable cached value. */
function isCached(scope) {
  return read(scope) !== null;
}

/**
 * Drop cached payloads so the next read hits Mongo. Call after anything that
 * changes what the home page shows.
 *
 * With no argument every entry is cleared; otherwise only scopes starting with
 * the given prefix are (e.g. 'catalog' clears catalog pages but keeps stats).
 */
function invalidate(prefix) {
  for (const scope of Array.from(entries.keys())) {
    if (prefix === undefined || scope.startsWith(prefix)) entries.delete(scope);
  }
  for (const scope of Array.from(inflight.keys())) {
    if (prefix === undefined || scope.startsWith(prefix)) inflight.delete(scope);
  }
}

module.exports = { remember, isCached, invalidate };