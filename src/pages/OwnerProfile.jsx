// src/pages/OwnerProfile.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export default function OwnerProfile(){
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session ?? null);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    async function load(){
      if (!session) return;
      const { data, error } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      if (!alive) return;
      if (error) { console.error(error); return; }
      setMe({
        ...data,
        display_name: data?.display_name ?? '',
        logo_url: data?.logo_url ?? '',
        city: data?.city ?? '',
        website: data?.website ?? '',
        bio: data?.bio ?? '',
      });
    }
    load();
    return () => { alive = false; };
  }, [session]);

  if (!session || !me) return <div style={{padding:20}}>Laden…</div>;
  if (me.role !== 'owner') return <div style={{padding:20}}>Deze pagina is alleen voor event owners.</div>;

  async function uploadAvatar(file){
    if (!file || !session) return null;
    const path = `${session.user.id}/${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('profiles').upload(path, file);
    if (upErr) throw upErr;
    const { data: pub } = await supabase.storage.from('profiles').getPublicUrl(path);
    return pub.publicUrl;
  }

  async function onSubmit(e){
    e.preventDefault();
    setBusy(true); setErr(''); setOk('');
    try {
      const form = new FormData(e.target);
      const display_name = form.get('display_name')?.toString().trim() || null;
      const city = form.get('city')?.toString().trim() || null;
      const websiteRaw = form.get('website')?.toString().trim() || '';
      const website = websiteRaw ? (websiteRaw.startsWith('http') ? websiteRaw : `https://${websiteRaw}`) : null;
      const bio = form.get('bio')?.toString().trim() || null;

      let logo_url = me.logo_url || null;
      const file = form.get('avatar');
      if (file && file.size > 0) {
        logo_url = await uploadAvatar(file);
      }

      const payload = { display_name, city, website, bio, logo_url };
      const { error } = await supabase.from('users').update(payload).eq('id', session.user.id);
      if (error) throw error;

      setOk('Opgeslagen!');
      const { data: fresh } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      setMe({
        ...fresh,
        display_name: fresh?.display_name ?? '',
        logo_url: fresh?.logo_url ?? '',
        city: fresh?.city ?? '',
        website: fresh?.website ?? '',
        bio: fresh?.bio ?? '',
      });
    } catch (e2) {
      setErr(e2.message ?? String(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{maxWidth:900, margin:'40px auto', fontFamily:'system-ui'}}>
      <h1>Mijn profiel (Owner)</h1>
      <p style={{color:'#555'}}>Account: <b>{session.user.email}</b> • Rol: <b>{me.role}</b></p>

      <form onSubmit={onSubmit} style={{display:'grid', gap:14, marginTop:16}}>
        {/* Avatar */}
        <div style={{display:'flex', gap:16, alignItems:'center'}}>
          <div style={{width:96, height:96, border:'1px solid #ddd', borderRadius:8, overflow:'hidden', background:'#f7f7f7'}}>
            {me.logo_url ? (
              <img src={me.logo_url} alt="Foto" style={{width:'100%', height:'100%', objectFit:'cover'}} />
            ) : (
              <div style={{fontSize:12, color:'#888', display:'flex', alignItems:'center', justifyContent:'center', height:'100%'}}>Geen foto</div>
            )}
          </div>
          <div>
            <label style={{display:'block', fontWeight:600}}>Profielfoto</label>
            <input type="file" name="avatar" accept="image/*" />
            <div style={{fontSize:12, color:'#666'}}>JPG/PNG</div>
          </div>
        </div>

        <label>Naam
          <input name="display_name" placeholder="Jouw naam" defaultValue={me.display_name} />
        </label>

        <label>Plaats
          <input name="city" placeholder="Bijv. Amsterdam" defaultValue={me.city} />
        </label>

        <label>Website (optioneel)
          <input name="website" placeholder="https://..." defaultValue={me.website} />
        </label>

        <label>Korte beschrijving (optioneel)
          <textarea name="bio" rows={5} placeholder="Vertel kort iets over jezelf of je event-plannen…" defaultValue={me.bio} />
        </label>

        <div style={{display:'flex', gap:10, alignItems:'center'}}>
          <button disabled={busy}>{busy ? 'Opslaan…' : 'Opslaan'}</button>
          {ok && <span style={{color:'green'}}>{ok}</span>}
          {err && <span style={{color:'crimson'}}>{err}</span>}
        </div>
      </form>
    </div>
  );
}