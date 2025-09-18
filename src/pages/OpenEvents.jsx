import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';

export default function OpenEvents(){
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session));
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from('users').select('*').eq('id', session.user.id).single()
      .then(({data}) => setProfile(data));
  }, [session]);

  useEffect(() => {
    supabase
      .from('events')
      .select('*')
      .eq('status','open')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setItems(data || []);
      });
  }, []);

  if (!session) return <div style={{padding:20}}>Laden…</div>;
  if (profile && profile.role !== 'caterer') {
    return <div style={{padding:20}}>Alleen cateraars zien open events.</div>;
  }
  if (!items) return <div style={{padding:20}}>Open events laden…</div>;

  return (
    <div style={{maxWidth:900, margin:'40px auto', fontFamily:'system-ui'}}>
      <h1>Open events</h1>
      {items.length === 0 && <p>Er zijn nog geen open events.</p>}
      <div style={{display:'grid', gap:16}}>
        {items.map(ev => (
          <div key={ev.id} style={{border:'1px solid #ddd', borderRadius:8, padding:12}}>
            <h3 style={{margin:'4px 0'}}>{ev.title}</h3>
            <div style={{fontSize:14, color:'#555'}}>
              {ev.date ? new Date(ev.date).toLocaleString() : 'Geen datum'} • {ev.guests ?? '?'} gasten
            </div>
            {ev.photos?.length ? (
              <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap'}}>
                {ev.photos.slice(0,3).map((url, i) => (
                  <img key={i} src={url} alt="" style={{height:60, borderRadius:4, objectFit:'cover'}} />
                ))}
              </div>
            ) : null}
            {ev.description && <p style={{marginTop:8}}>{ev.description}</p>}
            <div style={{marginTop:8}}>
              <Link to={`/events/${ev.id}/bid`}><button>Bied op dit event</button></Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}