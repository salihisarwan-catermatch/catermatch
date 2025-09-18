import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function EventBids(){
  const { eventId } = useParams();
  const nav = useNavigate();
  const [session, setSession] = useState(null);
  const [event, setEvent] = useState(null);
  const [bids, setBids] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session));
  }, []);

  // Event ophalen
  useEffect(() => {
    if (!eventId || !session) return;
    supabase.from('events').select('*').eq('id', eventId).single()
      .then(({ data, error }) => {
        if (error) { setErr(error.message); return; }
        setEvent(data);
      });
  }, [eventId, session]);

  // Biedingen ophalen
  useEffect(() => {
    if (!eventId) return;
    supabase.from('bids')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error(error); setBids([]); return; }
        setBids(data || []);
      });
  }, [eventId]);

  const isOwner = useMemo(() => {
    if (!session || !event) return false;
    return event.owner_id === session.user.id;
  }, [session, event]);

  if (!session) return <div style={{padding:20}}>Laden…</div>;
  if (!event) return <div style={{padding:20}}>Event laden…</div>;
  if (!isOwner) return <div style={{padding:20}}>Alleen de eigenaar van dit event kan biedingen bekijken.</div>;
  if (!bids) return <div style={{padding:20}}>Biedingen laden…</div>;

  async function acceptBid(bid){
    setErr('');
    setBusyId(bid.id);
    try {
      // 1) Zet gekozen bod op accepted
      let { error: e1 } = await supabase.from('bids').update({ status: 'accepted' }).eq('id', bid.id);
      if (e1) throw e1;

      // 2) Markeer event als booked
      let { error: e2 } = await supabase.from('events').update({ status: 'booked' }).eq('id', eventId);
      if (e2) throw e2;

      // 3) Zet andere bids op rejected (die nog 'sent' zijn)
      const otherIds = bids.filter(b => b.id !== bid.id && b.status === 'sent').map(b => b.id);
      for (const oid of otherIds) {
        const { error } = await supabase.from('bids').update({ status: 'rejected' }).eq('id', oid);
        if (error) throw error;
      }

      // 4) Chat ophalen of aanmaken en DIRECT naartoe navigeren
      // Bestaat er al een chat tussen deze owner/caterer voor dit event?
      const { data: existing, error: exErr } = await supabase
        .from('chats')
        .select('id')
        .eq('event_id', eventId)
        .eq('owner_id', event.owner_id)
        .eq('caterer_id', bid.caterer_id)
        .maybeSingle();
      if (exErr) throw exErr;

      if (existing?.id) {
        nav(`/chats/${existing.id}`);
        return;
      }

      // Zo niet: aanmaken en naar de chat gaan
      const { data: created, error: createErr } = await supabase
        .from('chats')
        .insert({
          event_id: eventId,
          owner_id: event.owner_id,
          caterer_id: bid.caterer_id
        })
        .select('id')
        .single();
      if (createErr) throw createErr;

      nav(`/chats/${created.id}`);
      return;

    } catch (e) {
      setErr(e.message ?? String(e));
      // Fallback: ververs lokaal de data zodat UI consistent blijft
      const { data: refreshed } = await supabase.from('bids').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
      setBids(refreshed || []);
      const { data: ev2 } = await supabase.from('events').select('*').eq('id', eventId).single();
      setEvent(ev2);
    } finally {
      setBusyId(null);
    }
  }

  async function rejectBid(bid){
    setErr('');
    setBusyId(bid.id);
    try {
      const { error } = await supabase.from('bids').update({ status: 'rejected' }).eq('id', bid.id);
      if (error) throw error;
      // lijst herladen
      const { data: refreshed } = await supabase.from('bids').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
      setBids(refreshed || []);
    } catch (e) {
      setErr(e.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{maxWidth:900, margin:'40px auto', fontFamily:'system-ui'}}>
      <div style={{marginBottom:12}}>
        <Link to="/events/mine">← Terug naar mijn events</Link>
      </div>
      <h1>Biedingen voor: {event.title}</h1>
      <div style={{fontSize:14, color:'#555', marginTop:4}}>
        Status event: <b>{event.status}</b> • {event.date ? new Date(event.date).toLocaleString() : 'Geen datum'}
      </div>
      {err && <div style={{color:'crimson', marginTop:12}}>{err}</div>}

      <div style={{display:'grid', gap:16, marginTop:16}}>
        {bids.length === 0 && <p>Nog geen biedingen.</p>}
        {bids.map(b => (
          <div key={b.id} style={{border:'1px solid #ddd', borderRadius:8, padding:12}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h3 style={{margin:'4px 0'}}>Bod: € {Number(b.amount).toFixed(2)}</h3>
              <span style={{padding:'2px 8px', borderRadius:999, border:'1px solid #ccc', fontSize:12}}>
                {b.status}
              </span>
            </div>
            {b.message && <p style={{marginTop:6}}>{b.message}</p>}
            <div style={{display:'flex', gap:8, marginTop:8}}>
              <button
                disabled={busyId === b.id || event.status === 'booked' || b.status !== 'sent'}
                onClick={() => acceptBid(b)}
              >
                {busyId === b.id ? 'Bezig…' : 'Accepteren'}
              </button>
              <button
                disabled={busyId === b.id || b.status !== 'sent'}
                onClick={() => rejectBid(b)}
              >
                Weigeren
              </button>
            </div>
          </div>
        ))}
      </div>

      {event.status === 'booked' && (
        <div style={{marginTop:16, padding:12, background:'#f6fff6', border:'1px solid #cde9cd'}}>
          Dit event is <b>geboekt</b>. Je kunt nu chatten met de geaccepteerde cateraar via <Link to="/chats/mine">Mijn chats</Link>.
        </div>
      )}
    </div>
  );
}