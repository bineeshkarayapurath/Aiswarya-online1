const config = require('../config/constants');
const { describeBook, isConfigured, AssistantError } = require('../services/bookAssistantService');

// Per-member hourly quota. Every question is a paid upstream call, so this is a
// cost control, not just abuse prevention. In-memory and per-process, which is
// fine for a single-instance deployment.
const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map();

function quotaFor(userId) {
  const now = Date.now();
  const entry = hits.get(userId);
  if (!entry || now - entry.start > WINDOW_MS) {
    const fresh = { start: now, count: 0 };
    hits.set(userId, fresh);
    return fresh;
  }
  return entry;
}

exports.status = async (req, res) => {
  const q = quotaFor(req.user._id.toString());
  return res.json({
    configured: isConfigured(),
    model: config.AI.model,
    limit: config.AI.maxPerHour,
    remaining: Math.max(0, config.AI.maxPerHour - q.count),
  });
};

exports.ask = async (req, res) => {
  try {
    const q = quotaFor(req.user._id.toString());

    if (q.count >= config.AI.maxPerHour) {
      const retryMins = Math.max(1, Math.ceil((WINDOW_MS - (Date.now() - q.start)) / 60000));
      return res.status(429).json({
        message: `You have used all ${config.AI.maxPerHour} questions for this hour. Please try again in ${retryMins} minute${retryMins === 1 ? '' : 's'}.`,
      });
    }

    const result = await describeBook({
      title: req.body && req.body.title,
      author: req.body && req.body.author,
    });

    // Only count calls that actually reached the model, so a cached repeat or a
    // validation error never eats a member's quota.
    if (!result.cached) q.count += 1;

    // Bound the map so a long-running process cannot grow it without limit.
    if (hits.size > 2000) hits.clear();

    return res.json({
      book: result,
      limit: config.AI.maxPerHour,
      remaining: Math.max(0, config.AI.maxPerHour - q.count),
    });
  } catch (err) {
    if (err instanceof AssistantError) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error(`[book-assistant] ${err.message}`);
    return res.status(500).json({ message: 'Could not look that book up. Please try again.' });
  }
};