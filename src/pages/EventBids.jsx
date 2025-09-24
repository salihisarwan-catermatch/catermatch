// src/pages/EventBids.jsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { notifyEmail } from '../notify';

export default function EventBids(){
  const { eventId } = useParams();
  const nav = useNavigate();

  // Session / me
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);

  // Event + bids
  const [event, setEvent] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // UI state accept/reject
  const [busyId, setBusyId] = useState(null);

  // Reviews
  const [myReview, setMyReview] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [reviewErr, setReviewErr] = useState('');
  const [reviewOk, setReviewOk] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session ?? null));
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from('users').select('*').eq('id', session.user.id).single()
      .then(({ data, error }) => {
        if (error) console.error(error);
        setMe(data || null);
      });
  }, [session]);

  // Event + bids (incl. cateraar-profiel voor weergave)
  useEffect(() => {
    let alive = true;
    async function load(){
      try {
        setLoading(true); setErr('');
        const [{ data: ev, error: evErr }, { data: bd, error: bdErr }] = await Promise.all([
          supabase.from('events').select('*').eq('id', eventId).single(),
          supabase.from('bids')
            .select('id, event_id, caterer_id, amount, message, status, created_at, caterer:users(id, display_name, company_name, logo_url)')
            .eq('event_id', eventId)
            .order('created_at', { ascending: true })
        ]);
        if (!alive) return;
        if (evErr) throw evErr;
        if (bdErr) throw bdErr;
        setEvent(ev);
        setBids(bd || []);
      } catch (e) {
        setErr(e.message ?? String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    if (eventId) load();
    return () => { alive = false; };
  }, [eventId]);

  const isOwner = useMemo(() => !!(event && session && event.owner_id === session.user.id), [event, session]);
  const acceptedBid = useMemo(() => (bids || []).find(b => b.status === 'accepted') || null, [bids]);

  // Review laden (voor geaccepteerde cateraar)
  useEffect(() => {
    let alive = true;
    async function loadReview(){
      if (!session || !acceptedBid || !isOwner) { setMyReview(null); return; }
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('event_id', eventId)
        .eq('owner_id', session.user.id)
        .eq('caterer_id', acceptedBid.caterer_id)
        .maybeSingle();
      if (!alive) return;
      if (error && error.code !== 'PGRST116') {
        console.error(error);
      }
      setMyReview(data || null);
      if (data) {
        setRating(data.rating);
        setComment(data.comment || '');
      }
    }
    loadReview();
    return () => { alive = false; };
  }, [session, eventId, acceptedBid, isOwner]);

  if (!session) return <div style={{padding:20}}>Laden…</div>;
  if (loading)  return <div style={{padding:20}}>Biedingen laden…</div>;
  if (!event)   return <div style={{padding:20}}>Event niet gevonden.</div>;
  if (!isOwner) return <div style={{padding:20}}>Alleen de eigenaar van dit event kan biedingen bekijken.</div>;

  async function acceptBid(bid){
    setErr('');
    setBusyId(bid.id);
    try {
      // 1) gekozen bod op accepted
      let { error: e1 } = await supabase.from('bids').update({ status: 'accepted' }).eq('id', bid.id);
      if (e1) throw e1;

      // 2) event op booked
      let { error: e2 } = await supabase.from('events').update({ status: 'booked' }).eq('id', eventId);
      if (e2) throw e2;

      // 3) overige bids naar rejected
      const otherIds = bids.filter(b => b.id !== bid.id && b.status === 'sent').map(b => b.id);
      for (const oid of otherIds) {
        const { error } = await supabase.from('bids').update({ status: 'rejected' }).eq('id', oid);
        if (error) throw error;
      }

      // 4) chat halen of maken
      const { data: existing, error: exErr } = await supabase
        .from('chats')
        .select('id')
        .eq('event_id', eventId)
        .eq('owner_id', event.owner_id)
        .eq('caterer_id', bid.caterer_id)
        .maybeSingle();
      if (exErr) throw exErr;

      let chatId = existing?.id;
      if (!chatId) {
        const { data: created, error: createErr } = await supabase
          .from('chats')
          .insert({ event_id: eventId, owner_id: event.owner_id, caterer_id: bid.caterer_id })
          .select('id')
          .single();
        if (createErr) throw createErr;
        chatId = created.id;
      }

      // 5) E-mail naar de cateraar (behoud uit jouw vorige versie)
      const { data: catererProfile } = await supabase
        .from('users').select('email')
        .eq('id', bid.caterer_id).single();
      const catererEmail = catererProfile?.email || null;

      if (catererEmail) {
        const subject = `Je bod is geaccepteerd: ${event.title}`;
        const html = `
          <div style="font-family:system-ui; line-height:1.5">
            <h2>Gefeliciteerd! Je bod is geaccepteerd</h2>
            <p>Event: <b>${escapeHtml(event.title || '')}</b></p>
            <p>Bedrag: <b>€ ${Number(bid.amount).toFixed(2)}</b></p>
            <p>Je kunt nu chatten met de owner: <a href="${location.origin}/chats/${chatId}">${location.origin}/chats/${chatId}</a></p>
            <hr/>
            <small>Catermatch</small>
          </div>
        `;
        await notifyEmail({ to: catererEmail, subject, html });
      }

      // navigeer naar chat
      nav(`/chats/${chatId}`);
    } catch (e) {
      setErr(e.message ?? String(e));
      // refresh lokale state voor betrouwbaarheid
      const { data: refreshed } = await supabase
        .from('bids')
        .select('id, event_id, caterer_id, amount, message, status, created_at, caterer:users(id, display_name, company_name, logo_url)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      setBids(refreshed || []);
      const { data: ev2 } = await supabase.from('events').select('*').eq('id', eventId).single();
      setEvent(ev2);
    } finally {
      setBusyId(null);
    }
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  async function rejectBid(bid){
    setErr('');
    setBusyId(bid.id);
    try {
      const { error } = await supabase.from('bids').update({ status: 'rejected' }).eq('id', bid.id);
      if (error) throw error;
      const { data: refreshed } = await supabase
        .from('bids')
        .select('id, event_id, caterer_id, amount, message, status, created_at, caterer:users(id, display_name, company_name, logo_url)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      setBids(refreshed || []);
    } catch (e) {
      setErr(e.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function submitReview(e){
    e.preventDefault();
    setReviewErr(''); setReviewOk(''); setSavingReview(true);
    try {
      if (!session) throw new Error('Niet ingelogd.');
      if (!isOwner) throw new Error('Alleen de event owner kan een review plaatsen.');
      if (!acceptedBid) throw new Error('Er is (nog) geen geaccepteerd bod.');

      const payload = {
        event_id: eventId,
        owner_id: session.user.id,
        caterer_id: acceptedBid.caterer_id,
        rating: Number(rating),
        comment: comment?.trim() || null
      };

      if (myReview) {
        const { error } = await supabase
          .from('reviews')
          .update({ rating: payload.rating, comment: payload.comment })
          .eq('event_id', eventId)
          .eq('owner_id', session.user.id)
          .eq('caterer_id', acceptedBid.caterer_id);
        if (error) throw error;
        setReviewOk('Review bijgewerkt.');
      } else {
        const { error } = await supabase.from('reviews').insert(payload);
        if (error) throw error;
        setReviewOk('Review geplaatst.');
      }

      const { data: fresh } = await supabase
        .from('reviews')
        .select('*')
        .eq('event_id', eventId)
        .eq('owner_id', session.user.id)
        .eq('caterer_id', acceptedBid.caterer_id)
        .single();
      setMyReview(fresh);
    } catch (e2) {
      setReviewErr(e2.message ?? String(e2));
    } finally {
      setSavingReview(false);
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

      {/* Lijst biedingen */}
      <div style={{display:'grid', gap:16, marginTop:16}}>
        {bids.length === 0 && <p>Nog geen biedingen.</p>}
        {bids.map(b => (
          <div key={b.id} style={{border:'1px solid #ddd', borderRadius:8, padding:12}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap'}}>
              <div style={{display:'flex', gap:10, alignItems:'center'}}>
                <div style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', background: '#f4f4f4', border: '1px solid #eee' }}>
                  {b.caterer?.logo_url ? (
                    <img alt="" src={b.caterer.logo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {b.caterer?.company_name || b.caterer?.display_name || 'Cateraar'}
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    Bod: <b>€ {Number(b.amount || 0).toLocaleString('nl-NL')}</b>
                    {b.status ? <> • Status: <b>{b.status}</b></> : null}
                  </div>
                </div>
              </div>

              <div style={{display:'flex', gap:8}}>
                <Link to={`/caterers/${b.caterer_id}`}>Bekijk profiel</Link>
              </div>
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

      {/* Review-sectie (alleen owner + accepted bid) */}
      {isOwner && acceptedBid && (
        <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 16 }}>
          <h2>Jouw review voor de geaccepteerde cateraar</h2>
          <p style={{ color: '#555', marginTop: 0 }}>
            Cateraar: <b>{acceptedBid.caterer?.company_name || acceptedBid.caterer?.display_name || 'Cateraar'}</b>
          </p>

          <form onSubmit={submitReview} style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
            <label>Beoordeling (1–5)
              <StarPicker value={rating} onChange={setRating} />
            </label>
            <label>Opmerking (optioneel)
              <textarea
                rows={4}
                placeholder="Hoe was de samenwerking?"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button disabled={savingReview}>
                {savingReview ? (myReview ? 'Bijwerken…' : 'Plaatsen…') : (myReview ? 'Review bijwerken' : 'Review plaatsen')}
              </button>
              {reviewOk && <span style={{ color: 'green' }}>{reviewOk}</span>}
              {reviewErr && <span style={{ color: 'crimson' }}>{reviewErr}</span>}
            </div>
            {myReview && (
              <div style={{ fontSize: 13, color: '#666' }}>
                Laatst aangepast: {new Date(myReview.created_at).toLocaleString('nl-NL')}
              </div>
            )}
          </form>
        </div>
      )}

      {!acceptedBid && isOwner && (
        <div style={{ marginTop: 24, color: '#666' }}>
          Er is nog geen geaccepteerd bod. Je kunt een review plaatsen nadat je een bod hebt geaccepteerd.
        </div>
      )}
    </div>
  );
}

/* Kleine sterpicker (zonder extra packages) */
function StarPicker({ value = 5, onChange }) {
  const stars = [1,2,3,4,5];
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', userSelect: 'none' }} aria-label="Rating">
      {stars.map(n => (
        <span
          key={n}
          onClick={() => onChange?.(n)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onChange?.(n)}
          role="button"
          tabIndex={0}
          style={{
            fontSize: 22,
            lineHeight: 1,
            cursor: 'pointer',
            color: n <= value ? '#f5a524' : '#ccc'
          }}
          title={`${n} ster${n>1?'ren':''}`}
        >
          ★
        </span>
      ))}
      <span style={{ marginLeft: 8, fontSize: 14, color: '#555' }}>{value}/5</span>
    </div>
  );
}