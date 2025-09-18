import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';

export default function MyEvents(){
  const [session, setSession] = useState(null);
  const [items, setItems] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session));
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('events')
      .select('*')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setItems(data || []);
      });
  }, [session]);

  if (!session) return <div style={{padding:20}}>Laden…</div>;
  if (!items) return <div style={{padding:20}}>Events laden…</div>;

  return (
    <div style={{maxWidth:900, margin:'40px auto', fontFamily:'system-ui'}}>
      <h1>Mijn events</h1>
      {items.length === 0 && <p>Je hebt nog geen events.</p>}
      <div style={{display:'grid', gap:16}}>
        {items.map(ev => (
          <div key={ev.id} style={{border:'1px solid #ddd', borderRadius:8, padding:12}}>
            <h3 style={{margin:'4px 0'}}>{ev.title}</h3>
            <div style={{fontSize:14, color:'#555'}}>
              Status: <b>{ev.status}</b> • {ev.date ? new Date(ev.date).toLocaleString() : 'Geen datum'}
            </div>
            {ev.photos?.length ? (
              <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap'}}>
                {ev.photos.map((url, i) => (
                  <img key={i} src={url} alt="" style={{height:80, borderRadius:4, objectFit:'cover'}} />
                ))}
              </div>
            ) : null}
            {ev.description && <p style={{marginTop:8}}>{ev.description}</p>}
            <div style={{marginTop:10, display:'flex', gap:8}}>
              <Link to={`/events/${ev.id}/bids`}><button>Bekijk biedingen</button></Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}