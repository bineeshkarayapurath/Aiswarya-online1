import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';

export default function EventRegistrationsList() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    try {
      const res = await api.get('/events');
      setEvents(res.data.events || []);
      if ((res.data.events || []).length > 0) {
        setSelectedEvent(res.data.events[0]._id);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load events');
    }
  }, []);

  const loadRegs = useCallback(async () => {
    if (!selectedEvent) return;
    setLoading(true);
    try {
      const res = await api.get('/event-registrations', { params: { eventId: selectedEvent } });
      setRegistrations(res.data.registrations || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, [selectedEvent]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    loadRegs();
  }, [loadRegs]);

  const grouped = registrations.reduce((acc, r) => {
    const key = r.subProgramName || 'Others';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="input w-auto"
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
        >
          {events.map((ev) => (
            <option key={ev._id} value={ev._id}>
              {ev.name}
            </option>
          ))}
        </select>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
          {registrations.length} registration(s)
        </span>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading...</p>
      ) : registrations.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No registrations yet</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([sub, list]) => (
            <div key={sub} className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 font-bold text-emerald-900">
                {sub} ({list.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="px-3 py-2 text-left font-semibold">Chest No</th>
                      <th className="px-3 py-2 text-left font-semibold">Participant</th>
                      <th className="px-3 py-2 text-left font-semibold">Contact</th>
                      <th className="px-3 py-2 text-left font-semibold">Type</th>
                      <th className="px-3 py-2 text-left font-semibold">Lead/Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r._id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-bold text-emerald-700">{r.chestNumber}</td>
                        <td className="px-3 py-2">{r.participantName}</td>
                        <td className="px-3 py-2">{r.contactNumber || '-'}</td>
                        <td className="px-3 py-2">{r.isGroup ? 'Group' : 'Solo'}</td>
                        <td className="px-3 py-2 text-xs">
                          {r.isGroup && (
                            <div>
                              Lead: {r.leadName}
                              {r.otherParticipants?.length > 0 && (
                                <div>Others: {r.otherParticipants.map((p) => p.name).join(', ')}</div>
                              )}
                            </div>
                          )}
                          {!r.isGroup && '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}