import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';

export default function MyBids(){
  const [session, setSession] = useState(null);
  const [bids, setBids] = useState(null);
  const [eventsById, setEventsById] = useState({});

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session));
  }, []);

  useEffect(() => {
    if (!session) return;
    // Haal mijn biedingen op
    supabase
      .from('bids')
      .select('*')
      .eq('caterer_id', session.user.id)
      .order('created_at', { ascending: false })
      .then(async ({ data, error }) => {
        if (error) { console.error(error); setBids([]); return; }
        setBids(data || []);
        // Laad bijbehorende events (simpel: 1 query per uniek event_id)
        const uniqueIds = [...new Set((data || []).map(b => b.event_id))];
        const map = {};
        for (const id of uniqueIds) {
          const { data: ev } = await supabase.from('events').select('*').eq('id', id).single();
          if (ev) map[id] = ev;
        }
        setEventsById(map);
      });
  }, [session]);

  if (!session) return <div style={{padding:20}}>Laden…</div>;
  if (!bids) return <div style={{padding:20}}>Biedingen laden…</div>;

  return (
    <div style={{maxWidth:900, margin:'40px auto', fontFamily:'system-ui'}}>
      <h1>Mijn biedingen</h1>
      {bids.length === 0 && <p>Je hebt nog geen biedingen geplaatst.</p>}
      <div style={{display:'grid', gap:16}}>
        {bids.map(b => {
          const ev = eventsById[b.event_id];
          return (
            <div key={b.id} style={{border:'1px solid #ddd', borderRadius:8, padding:12}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h3 style={{margin:'4px 0'}}>{ev?.title ?? 'Event'}</h3>
                <span style={{
                  padding:'2px 8px', borderRadius:999, border:'1px solid #ccc', fontSize:12
                }}>{b.status}</span>
              </div>
              <div style={{fontSize:14, color:'#555'}}>
                {ev?.date ? new Date(ev.date).toLocaleString() : ''} • {ev?.guests ?? '?'} gasten
              </div>
              <p style={{margin:'8px 0'}}>Bedrag: <b>€ {Number(b.amount).toFixed(2)}</b></p>
              {b.message && <p style={{marginTop:4}}>{b.message}</p>}
              {ev?.status !== 'open' && (
                <div style={{marginTop:8, fontSize:12, color:'#666'}}>
                  Event status: {ev?.status}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{marginTop:12}}>
        <Link to="/events/open">← Naar open events</Link>
      </div>
    </div>
  );
}