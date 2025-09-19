import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export default function Profile(){
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session));
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from('users').select('*').eq('id', session.user.id).single()
      .then(({ data, error }) => {
        if (error) { console.error(error); return; }
        // fallback lege waarden
        setUser({
          ...data,
          company_name: data?.company_name ?? '',
          bio: data?.bio ?? '',
          specialties: Array.isArray(data?.specialties) ? data.specialties : [],
          logo_url: data?.logo_url ?? '',
          city: data?.city ?? '',
          website: data?.website ?? ''
        });
      });
  }, [session]);

  async function uploadLogo(file){
    if (!file || !session) return null;
    const path = `${session.user.id}/${crypto.randomUUID()}-${file.name}`;
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
      const company_name = form.get('company_name')?.toString().trim() || null;
      const bio = form.get('bio')?.toString().trim() || null;
      const city = form.get('city')?.toString().trim() || null;
      const website = form.get('website')?.toString().trim() || null;
      const specsRaw = form.get('specialties')?.toString() || '';
      const specialties = specsRaw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      let logo_url = user.logo_url || null;
      const file = form.get('logo');
      if (file && file.size > 0) {
        logo_url = await uploadLogo(file);
      }

      const payload = { company_name, bio, city, website, specialties, logo_url };
      const { error } = await supabase.from('users').update(payload).eq('id', session.user.id);
      if (error) throw error;

      setOk('Opgeslagen!');
      // herladen om velden zeker te syncen
      const { data: fresh } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      setUser({
        ...fresh,
        company_name: fresh?.company_name ?? '',
        bio: fresh?.bio ?? '',
        specialties: Array.isArray(fresh?.specialties) ? fresh.specialties : [],
        logo_url: fresh?.logo_url ?? '',
        city: fresh?.city ?? '',
        website: fresh?.website ?? ''
      });
    } catch (e) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!session) return <div style={{padding:20}}>Laden…</div>;
  if (!user) return <div style={{padding:20}}>Profiel laden…</div>;

  const isCaterer = user.role === 'caterer';

  return (
    <div style={{maxWidth:720, margin:'40px auto', fontFamily:'system-ui'}}>
      <h1>Mijn profiel</h1>
      <p style={{color:'#555'}}>Account: <b>{session.user.email}</b> • Rol: <b>{user.role}</b></p>

      <form onSubmit={onSubmit} style={{display:'grid', gap:14, marginTop:16}}>
        <div style={{display:'flex', gap:16, alignItems:'center'}}>
          <div style={{width:96, height:96, border:'1px solid #ddd', borderRadius:8, overflow:'hidden', background:'#f7f7f7'}}>
            {user.logo_url ? (
              <img src={user.logo_url} alt="Logo" style={{width:'100%', height:'100%', objectFit:'cover'}} />
            ) : (
              <div style={{fontSize:12, color:'#888', display:'flex', alignItems:'center', justifyContent:'center', height:'100%'}}>Geen logo</div>
            )}
          </div>
          <div>
            <label style={{display:'block', fontWeight:600}}>Logo / foto</label>
            <input type="file" name="logo" accept="image/*" />
            <div style={{fontSize:12, color:'#666'}}>JPG/PNG, max ~5MB (afhankelijk van policy)</div>
          </div>
        </div>

        {isCaterer && (
          <label>Bedrijfsnaam
            <input name="company_name" placeholder="Bijv. Taste & Co"
                   defaultValue={user.company_name} />
          </label>
        )}

        <label>Beschrijving
          <textarea name="bio" placeholder="Vertel iets over je bedrijf / jezelf…" rows={5}
                    defaultValue={user.bio} />
        </label>

        <label>Specialisaties (komma-gescheiden)
          <input name="specialties" placeholder="bijv. BBQ, halal, vegan"
                 defaultValue={(user.specialties || []).join(', ')} />
        </label>

        <div style={{display:'grid', gap:12, gridTemplateColumns:'1fr 1fr'}}>
          <label>Plaats
            <input name="city" placeholder="Bijv. Amsterdam" defaultValue={user.city} />
          </label>
          <label>Website
            <input name="website" placeholder="https://..." defaultValue={user.website} />
          </label>
        </div>

        <div style={{display:'flex', gap:10, alignItems:'center'}}>
          <button disabled={busy}>{busy ? 'Opslaan…' : 'Opslaan'}</button>
          {ok && <span style={{color:'green'}}>{ok}</span>}
          {err && <span style={{color:'crimson'}}>{err}</span>}
        </div>
      </form>

      {/* Voorbeeld weergave specialisaties */}
      {user.specialties?.length ? (
        <div style={{marginTop:16, display:'flex', gap:8, flexWrap:'wrap'}}>
          {user.specialties.map((s, i) => (
            <span key={i} style={{border:'1px solid #ddd', borderRadius:999, padding:'4px 10px', fontSize:12}}>{s}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}