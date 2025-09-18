import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function PlaceBid(){
  const { eventId } = useParams();
  const nav = useNavigate();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [event, setEvent] = useState(null);

  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session));
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from('users').select('*').eq('id', session.user.id).single()
      .then(({data}) => setProfile(data));
  }, [session]);

  useEffect(() => {
    if (!eventId) return;
    supabase.from('events').select('*').eq('id', eventId).single()
      .then(({ data, error }) => {
        if (error) console.error(error);
        setEvent(data);
      });
  }, [eventId]);

  if (!session) return <div style={{padding:20}}>Laden…</div>;
  if (profile && profile.role !== 'caterer') {
    return <div style={{padding:20}}>Alleen cateraars kunnen bieden.</div>;
  }
  if (!event) return <div style={{padding:20}}>Event laden…</div>;
  if (event.status !== 'open') {
    return <div style={{padding:20}}>
      Dit event is niet open voor biedingen.
      <div style={{marginTop:12}}><Link to="/events/open">Terug naar open events</Link></div>
    </div>;
  }

  async function submitBid(e){
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const amt = Number(amount);
      if (isNaN(amt) || amt <= 0) throw new Error('Voer een geldig bedrag in (bijv. 250).');
      const payload = {
        event_id: eventId,
        caterer_id: session.user.id,
        amount: amt,
        message,
        status: 'sent'
      };
      const { error } = await supabase.from('bids').insert(payload);
      if (error) throw error;
      nav('/bids/mine');
    } catch (e) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{maxWidth:560, margin:'40px auto', fontFamily:'system-ui'}}>
      <h1>Bied op: {event.title}</h1>
      <p style={{color:'#555', marginTop:4}}>
        {event.date ? new Date(event.date).toLocaleString() : 'Geen datum'} • {event.guests ?? '?'} gasten
      </p>
      <form onSubmit={submitBid} style={{display:'grid', gap:12, marginTop:16}}>
        <label>Bedrag (totaal)
          <input type="number" min="1" step="0.01" placeholder="Bijv. 250.00"
                 value={amount} onChange={e=>setAmount(e.target.value)} required />
        </label>
        <label>Bericht (optioneel)
          <textarea placeholder="Korte toelichting…" value={message} onChange={e=>setMessage(e.target.value)} />
        </label>
        <button disabled={busy}>{busy ? 'Versturen…' : 'Bod plaatsen'}</button>
        {err && <div style={{color:'crimson'}}>{err}</div>}
      </form>
      <div style={{marginTop:12}}>
        <Link to="/events/open">← Terug</Link>
      </div>
    </div>
  );
}