// src/pages/NewEvent.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';

export default function NewEvent(){
  const nav = useNavigate();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [guests, setGuests] = useState('');
  const [city, setCity] = useState('');
  const [budget, setBudget] = useState('');     // ⬅️ NIEUW
  const [address, setAddress] = useState('');
  const [files, setFiles] = useState([]);
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
    if (profile?.city && !city) setCity(profile.city);
  }, [profile, city]);

  if (!session) return <div style={{padding:20}}>Laden…</div>;
  if (profile && profile.role !== 'owner') {
    return <div style={{padding:20}}>Alleen owners kunnen events aanmaken.</div>;
  }

  async function uploadPhotos(){
    const urls = [];
    for (const file of files) {
      const filename = `${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('events').upload(filename, file);
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('events').getPublicUrl(filename);
      urls.push(data.publicUrl);
    }
    return urls;
  }

  async function handleSubmit(e){
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const photoUrls = files.length ? await uploadPhotos() : [];
      const payload = {
        owner_id: session.user.id,
        title: title?.trim() || null,
        description: description?.trim() || null,
        date: date ? new Date(date).toISOString() : null,
        guests: guests ? Number(guests) : null,
        city: city?.trim() || null,
        budget: budget ? Number(budget) : null,     // ⬅️ NIEUW
        location: address ? { address } : null,
        photos: photoUrls,
        status: 'open'
      };
      const { error } = await supabase.from('events').insert(payload);
      if (error) throw error;
      nav('/events/mine');
    } catch (e) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{maxWidth:560, margin:'40px auto', fontFamily:'system-ui'}}>
      <h1>Nieuw event</h1>
      <form onSubmit={handleSubmit} style={{display:'grid', gap:12}}>
        <input placeholder="Titel" value={title} onChange={e=>setTitle(e.target.value)} required />
        <textarea placeholder="Beschrijving" value={description} onChange={e=>setDescription(e.target.value)} />
        <label>Datum/tijd
          <input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} />
        </label>
        <input type="number" placeholder="Aantal gasten" value={guests} onChange={e=>setGuests(e.target.value)} />
        <input placeholder="Plaats / Stad" value={city} onChange={e=>setCity(e.target.value)} />
        <input type="number" min="0" step="1" placeholder="Budget (indicatief, €)" value={budget} onChange={e=>setBudget(e.target.value)} /> {/* ⬅️ NIEUW */}
        <input placeholder="Adres (optioneel)" value={address} onChange={e=>setAddress(e.target.value)} />
        <label>Foto's (optioneel)
          <input type="file" multiple accept="image/*" onChange={e=>setFiles([...e.target.files])} />
        </label>
        <button disabled={busy}>{busy ? 'Opslaan…' : 'Event aanmaken'}</button>
        {err && <div style={{color:'crimson'}}>{err}</div>}
      </form>
    </div>
  );
}