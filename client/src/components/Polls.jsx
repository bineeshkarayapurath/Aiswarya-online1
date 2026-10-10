import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FaPoll, FaWhatsapp, FaLock, FaCheck, FaUsers } from 'react-icons/fa';

// Share a poll to WhatsApp. The message embeds the deep link to /polls/<slug>,
// so a recipient who is not signed in still lands directly on this poll, can
// read it, and is asked to sign in before voting.
export function sharePollOnWhatsApp(poll, origin = window.location.origin) {
  const url = `${origin}/polls/${poll.slug || poll.id}`;
  const text = `${poll.question}\n\nVote here: ${url}`;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

function ResultBar({ option, total }) {
  const pct = total > 0 ? Math.round((option.count / total) * 100) : 0;
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div
        className="absolute inset-y-0 left-0 bg-emerald-900/10"
        style={{ width: `${pct}%` }}
        aria-hidden
      />
      <div className="relative flex items-center justify-between gap-3 px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-700">
          {option.myVote && (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-[9px] text-white">
              <FaCheck />
            </span>
          )}
          <span className="truncate">{option.text}</span>
        </span>
        <span className="shrink-0 text-xs font-bold text-slate-500">
          {option.count} · {pct}%
        </span>
      </div>
    </div>
  );
}

function PollCard({ poll, highlight, innerRef, onVoted }) {
  const { user } = useAuth();
  const isMember = Boolean(user && user.status === 'APPROVED');
  const [selected, setSelected] = useState([]);
  const [voting, setVoting] = useState(false);
  const showResults = poll.hasVoted || poll.isClosed;

  const toggle = (id) => {
    if (poll.allowMultiple) {
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    } else {
      setSelected([id]);
    }
  };

  const submitVote = async () => {
    if (selected.length === 0) return toast.error('Choose an option first');
    setVoting(true);
    try {
      const res = await api.post(`/member/polls/${poll.id}/vote`, { optionIds: selected });
      toast.success('Vote recorded — thank you!');
      onVoted(res.data.poll);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not record your vote');
    } finally {
      setVoting(false);
    }
  };

  return (
    <motion.div
      ref={innerRef}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`scroll-mt-24 rounded-2xl border bg-white p-5 shadow-sm transition ${
        highlight ? 'border-gold ring-2 ring-gold/60' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {highlight && (
            <span className="mb-2 inline-block rounded-full bg-gold/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gold">
              Shared poll
            </span>
          )}
          <h3 className="text-base font-extrabold text-emerald-900">{poll.question}</h3>
          {poll.description && <p className="mt-1 text-sm text-slate-500">{poll.description}</p>}
          <p className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-400">
            <span className="flex items-center gap-1">
              <FaUsers /> {poll.totalVotes} vote{poll.totalVotes === 1 ? '' : 's'}
            </span>
            {poll.closesAt && !poll.isClosed && <span>Closes {new Date(poll.closesAt).toLocaleDateString('en-IN')}</span>}
            {poll.isClosed && <span className="text-red-500">Closed</span>}
            {poll.allowMultiple && <span className="text-emerald-700">Multiple choice</span>}
          </p>
        </div>
        <button
          onClick={() => sharePollOnWhatsApp(poll)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#25D366]/15 px-3 py-1.5 text-xs font-bold text-[#128C7E] transition hover:bg-[#25D366]/25"
          title="Share on WhatsApp"
        >
          <FaWhatsapp /> Share
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {showResults
          ? poll.options.map((o) => <ResultBar key={o.id} option={o} total={poll.totalVotes} />)
          : poll.options.map((o) => {
              const active = selected.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => isMember && toggle(o.id)}
                  disabled={!isMember}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm font-semibold transition ${
                    active
                      ? 'border-emerald-900 bg-emerald-900/5 text-emerald-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-900/40'
                  } ${!isMember ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                      poll.allowMultiple ? 'rounded' : 'rounded-full'
                    } ${active ? 'border-emerald-900 bg-emerald-900 text-white' : 'border-slate-300'}`}
                  >
                    {active && <FaCheck className="text-[8px]" />}
                  </span>
                  {o.text}
                </button>
              );
            })}
      </div>

      {!showResults && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {isMember ? (
            <button
              onClick={submitVote}
              disabled={voting || selected.length === 0}
              className="btn-primary !py-2.5 text-sm disabled:opacity-60"
            >
              {voting ? 'Submitting...' : 'Submit Vote'}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <FaLock /> Sign in to vote
              </span>
              <Link to={`/member-login?redirect=${encodeURIComponent(`/polls/${poll.slug || poll.id}`)}`} className="btn-primary !py-2 text-sm">
                Member Login
              </Link>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function Polls({ focusSlug = null }) {
  const { user } = useAuth();
  const [polls, setPolls] = useState([]);
  const [focused, setFocused] = useState(null);
  const [loading, setLoading] = useState(true);
  const focusRef = useRef(null);
  const scrolledRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const listRes = await api.get('/public/polls');
      const list = listRes.data.polls || [];
      setPolls(list);

      if (focusSlug) {
        const inList = list.find((p) => p.slug === focusSlug || p.id === focusSlug);
        if (inList) {
          setFocused(inList);
        } else {
          // Not in the active list (e.g. an officer deactivated it after it was
          // shared). Fetch it directly so the link still shows something useful.
          try {
            const one = await api.get(`/public/polls/${focusSlug}`);
            setFocused(one.data.poll);
          } catch {
            setFocused(null);
          }
        }
      } else {
        setFocused(null);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load polls');
    } finally {
      setLoading(false);
    }
  }, [focusSlug]);

  useEffect(() => {
    scrolledRef.current = false;
    load();
  }, [load]);

  // Bring the shared poll into view once it has rendered.
  useEffect(() => {
    if (focused && focusRef.current && !scrolledRef.current) {
      scrolledRef.current = true;
      const id = setTimeout(() => {
        focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [focused]);

  const onVoted = (updated) => {
    setPolls((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setFocused((prev) => (prev && prev.id === updated.id ? updated : prev));
  };

  const otherPolls = focused ? polls.filter((p) => p.id !== focused.id) : polls;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-emerald-900">
          <FaPoll className="text-gold" /> Club Polls
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Have your say. Sign in as a member to cast your vote — results update live.
          {user && (user.status === 'APPROVED' ? '' : ' Your membership is not approved yet.')}
        </p>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading polls...</p>
      ) : (
        <>
          {focused && (
            <PollCard poll={focused} highlight innerRef={focusRef} onVoted={onVoted} />
          )}

          {otherPolls.length === 0 && !focused ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
              <FaPoll className="h-10 w-10 text-slate-300" />
              <p className="font-semibold text-slate-500">No active polls right now</p>
              <p className="text-xs text-slate-400">Check back soon — new polls are posted here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {otherPolls.map((p) => (
                <PollCard key={p.id} poll={p} highlight={false} innerRef={null} onVoted={onVoted} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
