import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';

export default function MyChats(){
  const [session, setSession] = useState(null);
  const [items, setItems] = useState(null);
  const [eventsById, setEventsById] = useState({});

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session));
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from('chats')
      .select('*')
      .or(`owner_id.eq.${session.user.id},caterer_id.eq.${session.user.id}`)
      .order('created_at', { ascending: false })
      .then(async ({ data, error }) => {
        if (error) { console.error(error); setItems([]); return; }
        setItems(data || []);
        // Laad gekoppelde events voor titels
        const unique = [...new Set((data || []).map(c => c.event_id))];
        const map = {};
        for (const id of unique) {
          const { data: ev } = await supabase.from('events').select('*').eq('id', id).single();
          if (ev) map[id] = ev;
        }
        setEventsById(map);
      });
  }, [session]);

  if (!session) return <div style={{padding:20}}>Laden…</div>;
  if (!items) return <div style={{padding:20}}>Chats laden…</div>;

  return (
    <div style={{maxWidth:800, margin:'40px auto', fontFamily:'system-ui'}}>
      <h1>Mijn chats</h1>
      {items.length === 0 && <p>Je hebt nog geen chats.</p>}
      <div style={{display:'grid', gap:12}}>
        {items.map(c => {
          const ev = eventsById[c.event_id];
          return (
            <Link key={c.id} to={`/chats/${c.id}`} style={{textDecoration:'none', color:'inherit'}}>
              <div style={{border:'1px solid #ddd', borderRadius:8, padding:12}}>
                <div style={{fontWeight:600}}>{ev?.title ?? 'Event'}</div>
                <div style={{fontSize:13, color:'#555'}}>Chat aangemaakt: {new Date(c.created_at).toLocaleString()}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}