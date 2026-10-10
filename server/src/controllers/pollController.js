const mongoose = require('mongoose');
const Poll = require('../models/Poll');

// A short, URL-safe, unambiguous slug. Excludes 0/o/1/l/i so a slug read aloud
// or retyped from WhatsApp is not mis-heard. 8 chars from a 30-char alphabet is
// ~6.5e11 combinations, and collisions are still checked against the DB.
const SLUG_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
function randomSlug() {
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return out;
}

async function uniqueSlug() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const slug = randomSlug();
    const clash = await Poll.exists({ slug });
    if (!clash) return slug;
  }
  // Extremely unlikely; fall back to a longer guaranteed-unique value.
  return `${randomSlug()}${Date.now().toString(36)}`;
}

// Build the client-facing shape. Voter identities never leave the server: only
// counts, plus whether the *current* caller has voted and on which options.
function publicShape(poll, user) {
  const totalVotes = poll.options.reduce((sum, o) => sum + (o.votes?.length || 0), 0);
  const uid = user ? String(user._id) : null;
  let myVote = [];
  let hasVoted = false;

  const options = poll.options.map((o) => {
    const votes = o.votes || [];
    const mine = uid ? votes.some((v) => String(v) === uid) : false;
    if (mine) {
      hasVoted = true;
      myVote.push(String(o._id));
    }
    return {
      id: String(o._id),
      text: o.text,
      count: votes.length,
      myVote: mine,
    };
  });

  return {
    id: String(poll._id),
    slug: poll.slug,
    question: poll.question,
    description: poll.description || '',
    allowMultiple: poll.allowMultiple,
    isActive: poll.isActive,
    closesAt: poll.closesAt,
    isClosed: poll.isClosed(),
    createdAt: poll.createdAt,
    totalVotes,
    hasVoted,
    myVote,
    options,
  };
}

// Accept either the pretty slug or the raw document id, so a link created before
// slugs existed (or a hand-typed id) still resolves.
async function findPoll(idOrSlug) {
  if (mongoose.isValidObjectId(idOrSlug)) {
    const byId = await Poll.findById(idOrSlug);
    if (byId) return byId;
  }
  return Poll.findOne({ slug: String(idOrSlug) });
}

/* ---------------------------- Public / Member ---------------------------- */

exports.listPublic = async (req, res) => {
  try {
    const polls = await Poll.find({ isActive: true }).sort({ createdAt: -1 }).limit(100);
    return res.json({ polls: polls.map((p) => publicShape(p, req.user)) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getPublic = async (req, res) => {
  try {
    const poll = await findPoll(req.params.idOrSlug);
    if (!poll) return res.status(404).json({ message: 'Poll not found' });
    return res.json({ poll: publicShape(poll, req.user) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.vote = async (req, res) => {
  try {
    const poll = await findPoll(req.params.idOrSlug);
    if (!poll) return res.status(404).json({ message: 'Poll not found' });

    if (poll.isClosed()) {
      return res.status(400).json({ message: 'This poll is closed' });
    }

    const raw = Array.isArray(req.body.optionIds) ? req.body.optionIds : [];
    const optionIds = [...new Set(raw.map((v) => String(v)))];

    if (optionIds.length === 0) {
      return res.status(400).json({ message: 'Choose an option to vote' });
    }
    if (!poll.allowMultiple && optionIds.length > 1) {
      return res.status(400).json({ message: 'This poll allows only one choice' });
    }

    const chosen = poll.options.filter((o) => optionIds.includes(String(o._id)));
    if (chosen.length !== optionIds.length) {
      return res.status(400).json({ message: 'One or more options are invalid' });
    }

    const uid = String(req.user._id);
    const already = poll.options.some((o) => (o.votes || []).some((v) => String(v) === uid));
    if (already) {
      return res.status(400).json({ message: 'You have already voted on this poll' });
    }

    for (const option of chosen) {
      if (!option.votes) option.votes = [];
      option.votes.push(req.user._id);
    }
    await poll.save();

    return res.json({ poll: publicShape(poll, req.user) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* -------------------------------- Admin -------------------------------- */

function parseOptions(body) {
  const list = Array.isArray(body.options) ? body.options : [];
  return list
    .map((o) => (typeof o === 'string' ? o : o?.text))
    .map((t) => String(t || '').trim())
    .filter(Boolean);
}

exports.listAll = async (req, res) => {
  try {
    const polls = await Poll.find().sort({ createdAt: -1 }).limit(500);
    return res.json({ polls: polls.map((p) => publicShape(p, null)) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const question = String(req.body.question || '').trim();
    if (!question) return res.status(400).json({ message: 'Poll question is required' });

    const texts = parseOptions(req.body);
    if (texts.length < 2) {
      return res.status(400).json({ message: 'Add at least two options' });
    }

    const poll = await Poll.create({
      question,
      description: String(req.body.description || '').trim(),
      options: texts.map((text) => ({ text })),
      allowMultiple: Boolean(req.body.allowMultiple),
      isActive: req.body.isActive === undefined ? true : Boolean(req.body.isActive),
      closesAt: req.body.closesAt ? new Date(req.body.closesAt) : null,
      createdBy: req.user ? req.user._id : null,
      slug: await uniqueSlug(),
    });

    return res.status(201).json({ poll: publicShape(poll, null) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ message: 'Poll not found' });

    if (req.body.question !== undefined) {
      const question = String(req.body.question || '').trim();
      if (!question) return res.status(400).json({ message: 'Poll question is required' });
      poll.question = question;
    }
    if (req.body.description !== undefined) {
      poll.description = String(req.body.description || '').trim();
    }
    if (req.body.isActive !== undefined) {
      poll.isActive = Boolean(req.body.isActive);
    }
    if (req.body.allowMultiple !== undefined) {
      poll.allowMultiple = Boolean(req.body.allowMultiple);
    }
    if (req.body.closesAt !== undefined) {
      poll.closesAt = req.body.closesAt ? new Date(req.body.closesAt) : null;
    }

    // Options may only be rewritten while nobody has voted: silently dropping a
    // voted-for option would erase those votes.
    if (req.body.options !== undefined) {
      const totalVotes = poll.options.reduce((sum, o) => sum + (o.votes?.length || 0), 0);
      if (totalVotes > 0) {
        return res
          .status(400)
          .json({ message: 'Options cannot be changed after people have voted' });
      }
      const texts = parseOptions(req.body);
      if (texts.length < 2) {
        return res.status(400).json({ message: 'Add at least two options' });
      }
      poll.options = texts.map((text) => ({ text, votes: [] }));
    }

    await poll.save();
    return res.json({ poll: publicShape(poll, null) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ message: 'Poll not found' });
    await poll.deleteOne();
    return res.json({ message: 'Poll deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
