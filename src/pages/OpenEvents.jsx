// src/pages/OpenEvents.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function OpenEvents(){
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);

  // Resultaten
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // 🔎 Filters
  const [city, setCity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minGuests, setMinGuests] = useState('');
  const [maxGuests, setMaxGuests] = useState('');
  const [sort, setSort] = useState('soonest'); // 'soonest' | 'newest' | 'oldest'

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

  const isCaterer = useMemo(() => me?.role === 'caterer', [me]);

  const load = useCallback(async () => {
    try {
      setLoading(true); setErr('');

      let query = supabase
        .from('events')
        .select('id, title, description, date, guests, status, owner_id, created_at, city')
        .eq('status', 'open');

      // filters
      const cityTrim = city.trim();
      if (cityTrim)  query = query.ilike('city', `%${cityTrim}%`);
      if (dateFrom)  query = query.gte('date', dateFrom);
      if (dateTo)    query = query.lte('date', dateTo);
      if (minGuests !== '' && !Number.isNaN(Number(minGuests))) query = query.gte('guests', Number(minGuests));
      if (maxGuests !== '' && !Number.isNaN(Number(maxGuests))) query = query.lte('guests', Number(maxGuests));

      // sortering
      if (sort === 'soonest') {
        query = query.order('date', { ascending: true, nullsFirst: false });
      } else if (sort === 'newest') {
        query = query.order('created_at', { ascending: false });
      } else if (sort === 'oldest') {
        query = query.order('created_at', { ascending: true });
      }

      const { data, error } = await query;
      if (error) throw error;
      setEvents(data || []);
    } catch (e) {
      setErr(e.message ?? String(e));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [city, dateFrom, dateTo, minGuests, maxGuests, sort]);

  // initial load
  useEffect(() => {
    if (session) load();
  }, [session, load]);

  // Helpers
  function resetFilters(){
    setCity('');
    setDateFrom('');
    setDateTo('');
    setMinGuests('');
    setMaxGuests('');
    setSort('soonest');
  }

  if (!session) return <div style={{padding:20}}>Laden…</div>;
  if (!isCaterer) return <div style={{padding:20}}>Alleen cateraars kunnen open events bekijken.</div>;

  return (
    <div style={{maxWidth:900, margin:'20px auto', fontFamily:'system-ui'}}>
      <h1>Open events</h1>

      {/* 🔎 Filterbalk */}
      <form
        onSubmit={(e)=>{ e.preventDefault(); load(); }}
        style={{display:'grid', gap:10, gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', alignItems:'end', marginTop:12}}
      >
        <label>Plaats / Stad
          <input type="text" placeholder="Bijv. Amsterdam" value={city} onChange={e=>setCity(e.target.value)} />
        </label>
        <label>Datum vanaf
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
        </label>
        <label>Datum t/m
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
        </label>
        <label>Min. gasten
          <input type="number" min="1" step="1" value={minGuests} onChange={e=>setMinGuests(e.target.value)} placeholder="bijv. 50" />
        </label>
        <label>Max. gasten
          <input type="number" min="1" step="1" value={maxGuests} onChange={e=>setMaxGuests(e.target.value)} placeholder="bijv. 200" />
        </label>
        <label>Sorteren op
          <select value={sort} onChange={e=>setSort(e.target.value)}>
            <option value="soonest">Snelst komende datum</option>
            <option value="newest">Nieuwste geplaatst</option>
            <option value="oldest">Oudste geplaatst</option>
          </select>
        </label>
        <div style={{display:'flex', gap:8}}>
          <button type="submit">Filters toepassen</button>
          <button type="button" onClick={resetFilters}>Reset</button>
        </div>
      </form>

      {/* Actieve filter chips */}
      <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:10}}>
        {city.trim() && <Chip label={`Plaats: ${city.trim()}`} onClear={()=>setCity('')} />}
        {dateFrom && <Chip label={`Vanaf ${new Date(dateFrom).toLocaleDateString('nl-NL')}`} onClear={()=>setDateFrom('')} />}
        {dateTo &&   <Chip label={`T/m ${new Date(dateTo).toLocaleDateString('nl-NL')}`} onClear={()=>setDateTo('')} />}
        {minGuests && <Chip label={`≥ ${minGuests} gasten`} onClear={()=>setMinGuests('')} />}
        {maxGuests && <Chip label={`≤ ${maxGuests} gasten`} onClear={()=>setMaxGuests('')} />}
        {sort !== 'soonest' && <Chip label={`Sort: ${sort}`} onClear={()=>setSort('soonest')} />}
      </div>

      {/* Resultaten */}
      {err && <div style={{color:'crimson', marginTop:12}}>Fout: {err}</div>}
      {loading ? (
        <div style={{marginTop:16}}>Events laden…</div>
      ) : events.length === 0 ? (
        <div style={{marginTop:16, color:'#666'}}>Geen open events gevonden met deze filters.</div>
      ) : (
        <div style={{display:'grid', gap:12, marginTop:16}}>
          {events.map(ev => (
            <div key={ev.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:12, flexWrap:'wrap'}}>
                <h3 style={{margin:'4px 0'}}>{ev.title || 'Event'}</h3>
                <div style={{fontSize:12, color:'#666'}}>
                  Geplaatst: {new Date(ev.created_at).toLocaleDateString('nl-NL')}
                </div>
              </div>
              <div style={{fontSize:14, color:'#555'}}>
                {ev.date ? <>Datum: <b>{new Date(ev.date).toLocaleDateString('nl-NL')}</b> • </> : null}
                Gasten: <b>{ev.guests ?? '?'}</b>
                {ev.city ? <> • Plaats: <b>{ev.city}</b></> : null}
              </div>
              {ev.description && (
                <p style={{marginTop:8, color:'#333'}}>
                  {ev.description.length > 180 ? ev.description.slice(0,180) + '…' : ev.description}
                </p>
              )}
              <div style={{display:'flex', gap:10, marginTop:8}}>
                <Link to={`/events/${ev.id}/bid`}>Bied op dit event</Link>
                {/* Optioneel: <Link to={`/owners/${ev.owner_id}`}>Bekijk owner-profiel</Link> */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ label, onClear }){
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6,
      background:'#f1f1f1', border:'1px solid #ddd', borderRadius:999, padding:'2px 8px', fontSize:12
    }}>
      {label}
      <button type="button" onClick={onClear} title="Verwijderen"
        style={{border:'none', background:'transparent', cursor:'pointer', fontSize:14, lineHeight:1}}>×</button>
    </span>
  );
}