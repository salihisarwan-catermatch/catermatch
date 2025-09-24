import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { notifyEmail } from '../notify';

export default function PlaceBid(){
  const { eventId } = useParams();
  const nav = useNavigate();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [event, setEvent] = useState(null);

  // 👇 Nieuw: owner-profiel voor kaartje + link
  const [owner, setOwner] = useState(null);

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
      .then(async ({ data, error }) => {
        if (error) { console.error(error); return; }
        setEvent(data);
        // Zodra event bekend is, laad owner-profiel
        if (data?.owner_id) {
          const { data: own, error: ownErr } = await supabase
            .from('users')
            .select('id, display_name, logo_url, city, website')
            .eq('id', data.owner_id)
            .single();
          if (!ownErr) setOwner(own);
        }
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

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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

      // 🎯 E-mail naar de owner van dit event
      // We gebruiken users.display_name als e-mailadres (zoals eerder ingesteld).
      const { data: ownerProfile } = await supabase
        .from('users').select('display_name')
        .eq('id', event.owner_id).single();

      const ownerEmail = ownerProfile?.display_name || null;
      if (ownerEmail) {
        const subject = `Nieuw bod op jouw event: ${event.title}`;
        const html = `
          <div style="font-family:system-ui; line-height:1.5">
            <h2>Nieuw bod op "${escapeHtml(event.title || '')}"</h2>
            <p>Bedrag: <b>€ ${amt.toFixed(2)}</b></p>
            ${message ? `<p><b>Bericht van cateraar:</b><br/>${escapeHtml(message)}</p>` : ''}
            <p>Bekijk alle biedingen: <a href="${location.origin}/events/${eventId}/bids">${location.origin}/events/${eventId}/bids</a></p>
            <hr/>
            <small>Catermatch</small>
          </div>
        `;
        await notifyEmail({ to: ownerEmail, subject, html });
      }

      nav('/bids/mine');
    } catch (e) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  // Kleine helper voor nette website-url
  const websiteClean = owner?.website
    ? (owner.website.startsWith('http') ? owner.website : `https://${owner.website}`)
    : null;

  return (
    <div style={{maxWidth:560, margin:'40px auto', fontFamily:'system-ui'}}>
      <h1>Bied op: {event.title}</h1>
      <p style={{color:'#555', marginTop:4}}>
        {event.date ? new Date(event.date).toLocaleString() : 'Geen datum'} • {event.guests ?? '?'} gasten
      </p>

      {/* 👇 Nieuw: owner-profielkaart + link */}
      {owner && (
        <div style={{marginTop:12, border:'1px solid #eee', borderRadius:8, padding:12, background:'#fafafa'}}>
          <div style={{display:'flex', gap:12, alignItems:'center'}}>
            <div style={{width:48, height:48, borderRadius:8, overflow:'hidden', background:'#f4f4f4', border:'1px solid #ddd'}}>
              {owner.logo_url ? (
                <img src={owner.logo_url} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}} />
              ) : null}
            </div>
            <div>
              <div style={{fontWeight:600}}>{owner.display_name || 'Owner'}</div>
              <div style={{fontSize:12, color:'#666'}}>
                {owner.city ? <>Locatie: <b>{owner.city}</b></> : 'Locatie onbekend'}
                {websiteClean ? <> • <a href={websiteClean} target="_blank" rel="noreferrer">Website</a></> : null}
              </div>
              <div style={{marginTop:6}}>
                <Link to={`/owners/${owner.id}`}>Bekijk profiel van de owner</Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={submitBid} style={{display:'grid', gap:12, marginTop:16}}>
        <label>Bedrag (totaal)
          <input
            type="number" min="1" step="0.01" placeholder="Bijv. 250.00"
            value={amount} onChange={e=>setAmount(e.target.value)} required
          />
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