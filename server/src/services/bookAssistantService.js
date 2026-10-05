const config = require('../config/constants');

// AI Book Assistant.
//
// Talks to any OpenAI-compatible /chat/completions endpoint (see config.AI) and
// returns a normalised, display-ready object. Design notes:
//
// - The API key never leaves the server. The browser only ever calls this API.
// - The model is asked for strict JSON and the result is validated and coerced
//   field by field, so a chatty or malformed answer degrades into a usable
//   screen instead of throwing.
// - Answers are cached in memory. Members ask about the same popular titles
//   repeatedly, and this is the only thing keeping the feature from being an
//   unbounded bill.
const MAX_TITLE = 120;
const MAX_AUTHOR = 80;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 200;

class AssistantError extends Error {
  constructor(code, status, message) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const cache = new Map();
function cacheKey(title, author) {
  return `${title.toLowerCase()}|${author.toLowerCase()}`;
}
function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Refresh recency so the LRU evicts genuinely cold entries.
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}
function cacheSet(key, value) {
  cache.set(key, { at: Date.now(), value });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

const SYSTEM_PROMPT = `You are the reading adviser for a community club library.
Given a book title (and optionally an author), reply with STRICT JSON only - no markdown, no code fences, no commentary - using exactly these keys:

{
  "title": string,
  "author": string,
  "genre": string,
  "publishedYear": string,
  "language": string,
  "summary": string,
  "themes": string[],
  "keyPoints": string[],
  "readingLevel": string,
  "readingTimeMinutes": number,
  "similarBooks": [{ "title": string, "author": string, "why": string }],
  "discussionQuestions": string[]
}

Rules:
- summary: 3 to 5 sentences, plain prose, no spoilers for the ending.
- themes: 3 to 5 short noun phrases.
- keyPoints: 3 to 5 single-sentence takeaways.
- readingLevel: one of "Easy", "Moderate", "Challenging".
- similarBooks: 3 to 4 genuinely different books, each with a one-line reason.
- discussionQuestions: 3 to 4 questions suitable for a club discussion group.
- If you are unsure about a specific detail, give your best answer rather than
  refusing, but never invent a publication year - use "" if you do not know.
- If the title is ambiguous, describe the best-known book with that title and
  set "author" to the author you assumed.`;

// Coerce whatever the model produced into the shape the UI renders. Anything
// unusable becomes an empty list rather than an exception in the client.
function str(v, max = 4000) {
  if (v === null || v === undefined) return '';
  return String(v).slice(0, max).trim();
}
function strList(v, maxItems = 6, maxLen = 400) {
  if (!Array.isArray(v)) {
    if (typeof v === 'string' && v.trim()) return [str(v, maxLen)];
    return [];
  }
  return v
    .map((x) => (typeof x === 'string' ? str(x, maxLen) : str(x && (x.title || x.text || x.name), maxLen)))
    .filter(Boolean)
    .slice(0, maxItems);
}
function normalise(raw, askedTitle, askedAuthor) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const books = Array.isArray(o.similarBooks) ? o.similarBooks : [];
  const readingTime = Number(o.readingTimeMinutes);
  return {
    title: str(o.title, 200) || askedTitle,
    author: str(o.author, 200) || askedAuthor || 'Unknown',
    genre: str(o.genre, 120) || 'Unclassified',
    publishedYear: str(o.publishedYear, 20),
    language: str(o.language, 60),
    summary: str(o.summary) || 'No summary was returned for this title.',
    themes: strList(o.themes, 6, 80),
    keyPoints: strList(o.keyPoints, 6, 300),
    readingLevel: ['Easy', 'Moderate', 'Challenging'].includes(str(o.readingLevel, 20))
      ? str(o.readingLevel, 20)
      : 'Moderate',
    readingTimeMinutes:
      Number.isFinite(readingTime) && readingTime > 0 ? Math.min(Math.round(readingTime), 2000) : null,
    similarBooks: books
      .map((b) => ({
        title: str(b && b.title, 200),
        author: str(b && b.author, 200),
        why: str(b && (b.why || b.reason), 300),
      }))
      .filter((b) => b.title)
      .slice(0, 4),
    discussionQuestions: strList(o.discussionQuestions, 5, 300),
  };
}

function isConfigured() {
  return Boolean(config.AI.apiKey);
}

// Pull a JSON object out of a model response that may be wrapped in code fences
// or padded with prose, then parse it.
function extractJson(text) {
  const raw = str(text, 20000);
  if (!raw) throw new AssistantError('empty_response', 502, 'The AI service returned nothing.');
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new AssistantError('bad_response', 502, 'The AI service returned an unreadable answer.');
  }
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch (e) {
    throw new AssistantError('bad_response', 502, 'The AI service returned an unreadable answer.');
  }
}

// `responseFormat` is optional because not every OpenAI-compatible provider
// accepts it: Gemini's endpoint takes json_object, but others reject the field
// with a 400. Dropping it is safe here because extractJson() copes with JSON
// wrapped in prose or fences anyway.
async function callModel(title, author, { responseFormat = true } = {}) {
  const userText = author
    ? `Book title: ${title}\nAuthor (use as a hint only, the member may have misspelled it): ${author}`
    : `Book title: ${title}`;

  const requestBody = {
    model: config.AI.model,
    temperature: 0.4,
    max_tokens: 1200,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userText },
    ],
  };
  if (responseFormat) requestBody.response_format = { type: 'json_object' };

  let res;
  try {
    res = await fetch(`${config.AI.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.AI.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(config.AI.timeoutMs),
    });
  } catch (e) {
    if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new AssistantError('timeout', 504, 'The AI service took too long to respond. Please try again.');
    }
    console.warn(`[book-assistant] request failed: ${e && e.message}`);
    throw new AssistantError('unreachable', 502, 'Could not reach the AI service. Please try again shortly.');
  }

  if (!res.ok) {
    // Log the status ONLY. The provider's error body routinely echoes parts of
    // the API key and account details, so it must never reach the log or the
    // response.
    console.warn(`[book-assistant] upstream responded ${res.status}`);
    // 404 and 400 are almost always a misconfigured base URL or model id rather
    // than anything the member did, so they get an actionable message.
    if (res.status === 404) {
      throw new AssistantError(
        'bad_endpoint',
        502,
        'The AI service could not find that endpoint or model. Check AI_BASE_URL and AI_MODEL.',
      );
    }
    if (res.status === 400) {
      throw new AssistantError(
        'rejected',
        502,
        'The AI service rejected the request. Check that AI_MODEL is a valid model for AI_BASE_URL.',
      );
    }
    const message =
      res.status === 401 || res.status === 403
        ? 'The AI service rejected the configured API key.'
        : res.status === 429
          ? 'The AI service is rate limited right now. Please try again shortly.'
          : 'The AI service is unavailable right now. Please try again shortly.';
    throw new AssistantError('upstream', 502, message);
  }

  let payload;
  try {
    payload = await res.json();
  } catch (e) {
    throw new AssistantError('bad_response', 502, 'The AI service returned an unreadable answer.');
  }
  const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message
    ? payload.choices[0].message.content
    : '';
  return extractJson(content);
}

async function describeBook({ title, author }) {
  const cleanTitle = str(title, MAX_TITLE);
  const cleanAuthor = str(author, MAX_AUTHOR);
  if (!cleanTitle) {
    throw new AssistantError('missing_title', 400, 'Please enter the name of a book.');
  }

  if (!isConfigured()) {
    throw new AssistantError(
      'not_configured',
      503,
      'The AI Book Assistant is not configured yet. An administrator needs to add an AI_API_KEY to the server environment.',
    );
  }

  const key = cacheKey(cleanTitle, cleanAuthor);
  const cached = cacheGet(key);
  if (cached) return { ...cached, cached: true };

  // Two fallback attempts, each for a different reason:
  //   1. drop response_format, for a provider that rejects the field
  //   2. resend once, for a model that simply produced unusable output
  // Both are cheap compared with showing a member an error they cannot act on.
  const attempts = [
    { responseFormat: true },
    { responseFormat: false },
  ];
  let lastError;
  for (const attempt of attempts) {
    try {
      const value = normalise(await callModel(cleanTitle, cleanAuthor, attempt), cleanTitle, cleanAuthor);
      if (lastError) console.warn(`[book-assistant] recovered on retry without response_format`);
      cacheSet(key, value);
      return { ...value, cached: false };
    } catch (e) {
      lastError = e;
      if (!(e instanceof AssistantError)) throw e;
      // Connection-level problems are not worth repeating, and a rejected key or
      // endpoint will fail identically no matter which body we send.
      if (['timeout', 'unreachable', 'not_configured', 'missing_title', 'bad_endpoint', 'upstream'].includes(e.code)) {
        throw e;
      }
    }
  }
  throw lastError;
}

module.exports = { describeBook, isConfigured, AssistantError };