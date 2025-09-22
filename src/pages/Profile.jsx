// src/pages/Profile.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../supabase';

export default function Profile(){
  // ---- Hooks (NOOIT conditioneel) ----
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  // Portfolio
  const [portfolio, setPortfolio] = useState([]);   // [{name, url}]
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState('');

  // 1) Session ophalen
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session ?? null);
    });
    return () => { alive = false; };
  }, []);

  // 2) User-profiel ophalen zodra we session hebben
  useEffect(() => {
    let alive = true;
    async function run(){
      if (!session) return;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (!alive) return;
      if (error) { console.error(error); return; }
      setMe({
        ...data,
        company_name: data?.company_name ?? '',
        bio: data?.bio ?? '',
        specialties: Array.isArray(data?.specialties) ? data.specialties : [],
        logo_url: data?.logo_url ?? '',
        city: data?.city ?? '',
        website: data?.website ?? '',
        min_price: Number.isFinite(data?.min_price) ? data.min_price : '',
        price_note: data?.price_note ?? ''
      });
    }
    run();
    return () => { alive = false; };
  }, [session]);

  // 3) Portfolio laden (afzonderlijk)
  const loadPortfolio = useCallback(async (userId) => {
    if (!userId) return;
    const prefix = `${userId}/`;
    const { data, error } = await supabase.storage.from('portfolio').list(prefix, { limit: 100, offset: 0 });
    if (error) { console.error(error); return; }
    const items = data || [];
    const urls = await Promise.all(items.map(async (it) => {
      const fullName = `${prefix}${it.name}`;
      const { data: pub } = await supabase.storage.from('portfolio').getPublicUrl(fullName);
      return { name: fullName, url: pub.publicUrl };
    }));
    setPortfolio(urls);
  }, []);

  useEffect(() => {
    if (session?.user?.id) loadPortfolio(session.user.id);
  }, [session?.user?.id, loadPortfolio]);

  // ---- Afgeleide flags (geen hooks binnen conditionele paden) ----
  const notReady = !session || !me;
  const isNotCaterer = useMemo(() => {
    return me && me.role !== 'caterer';
  }, [me]);

  // ---- Helpers (GEEN hooks hier binnen) ----
  async function uploadLogo(file){
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
      if (!session) throw new Error('Geen sessie.');
      const form = new FormData(e.target);
      const company_name = (form.get('company_name')?.toString().trim() || '') || null;
      const bio = (form.get('bio')?.toString().trim() || '') || null;
      const city = (form.get('city')?.toString().trim() || '') || null;
      const website = (form.get('website')?.toString().trim() || '') || null;

      const specsRaw = form.get('specialties')?.toString() || '';
      const specialties = specsRaw.split(',').map(s => s.trim()).filter(Boolean);

      const minPriceRaw = form.get('min_price')?.toString().trim();
      const min_price = minPriceRaw === '' ? null : Number.parseInt(minPriceRaw, 10);
      if (min_price != null && (Number.isNaN(min_price) || min_price < 0)) {
        throw new Error('“Prijs vanaf” moet een getal ≥ 0 zijn.');
      }
      const price_note = (form.get('price_note')?.toString().trim() || '') || null;

      let logo_url = me.logo_url || null;
      const file = form.get('logo');
      if (file && file.size > 0) {
        logo_url = await uploadLogo(file);
      }

      const payload = { company_name, bio, city, website, specialties, logo_url, min_price, price_note };
      const { error } = await supabase.from('users').update(payload).eq('id', session.user.id);
      if (error) throw error;

      setOk('Opgeslagen!');
      const { data: fresh } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      setMe({
        ...fresh,
        company_name: fresh?.company_name ?? '',
        bio: fresh?.bio ?? '',
        specialties: Array.isArray(fresh?.specialties) ? fresh.specialties : [],
        logo_url: fresh?.logo_url ?? '',
        city: fresh?.city ?? '',
        website: fresh?.website ?? '',
        min_price: Number.isFinite(fresh?.min_price) ? fresh.min_price : '',
        price_note: fresh?.price_note ?? ''
      });
    } catch (e2) {
      setErr(e2.message ?? String(e2));
    } finally {
      setBusy(false);
    }
  }

  async function onUploadPortfolio(e){
    const files = e.target.files;
    if (!files || files.length === 0 || !session?.user?.id) return;
    setUploading(true); setErr('');
    try {
      for (const file of files) {
        const path = `${session.user.id}/${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}-${file.name}`;
        const { error } = await supabase.storage.from('portfolio').upload(path, file);
        if (error) throw error;
      }
      await loadPortfolio(session.user.id);
      e.target.value = '';
    } catch (e2) {
      setErr(e2.message ?? String(e2));
    } finally {
      setUploading(false);
    }
  }

  async function removePortfolioItem(name){
    setRemoving(name); setErr('');
    try {
      const { error } = await supabase.storage.from('portfolio').remove([name]);
      if (error) throw error;
      setPortfolio(p => p.filter(it => it.name !== name));
    } catch (e2) {
      setErr(e2.message ?? String(e2));
    } finally {
      setRemoving('');
    }
  }

  // ---- Render (geen hooks hier!) ----
  if (notReady) return <div style={{padding:20}}>Laden…</div>;
  if (isNotCaterer) return <div style={{padding:20}}>Deze pagina is alleen voor cateraars.</div>;

  return (
    <div style={{maxWidth:900, margin:'40px auto', fontFamily:'system-ui'}}>
      <h1>Mijn profiel</h1>
      <p style={{color:'#555'}}>Account: <b>{session.user.email}</b> • Rol: <b>{me.role}</b></p>

      <form onSubmit={onSubmit} style={{display:'grid', gap:14, marginTop:16}}>
        {/* Logo */}
        <div style={{display:'flex', gap:16, alignItems:'center'}}>
          <div style={{width:96, height:96, border:'1px solid #ddd', borderRadius:8, overflow:'hidden', background:'#f7f7f7'}}>
            {me.logo_url ? (
              <img src={me.logo_url} alt="Logo" style={{width:'100%', height:'100%', objectFit:'cover'}} />
            ) : (
              <div style={{fontSize:12, color:'#888', display:'flex', alignItems:'center', justifyContent:'center', height:'100%'}}>Geen logo</div>
            )}
          </div>
          <div>
            <label style={{display:'block', fontWeight:600}}>Logo / foto</label>
            <input type="file" name="logo" accept="image/*" />
            <div style={{fontSize:12, color:'#666'}}>JPG/PNG</div>
          </div>
        </div>

        {/* Basisvelden */}
        <label>Bedrijfsnaam
          <input name="company_name" placeholder="Bijv. Taste & Co" defaultValue={me.company_name} />
        </label>

        <label>Beschrijving
          <textarea name="bio" placeholder="Vertel iets over je bedrijf / jezelf…" rows={5} defaultValue={me.bio} />
        </label>

        <label>Specialisaties (komma-gescheiden)
          <input name="specialties" placeholder="bijv. BBQ, halal, vegan" defaultValue={(me.specialties || []).join(', ')} />
        </label>

        <div style={{display:'grid', gap:12, gridTemplateColumns:'1fr 1fr'}}>
          <label>Plaats
            <input name="city" placeholder="Bijv. Amsterdam" defaultValue={me.city} />
          </label>
          <label>Website
            <input name="website" placeholder="https://..." defaultValue={me.website} />
          </label>
        </div>

        {/* Prijsvelden */}
        <div style={{display:'grid', gap:12, gridTemplateColumns:'1fr 1fr'}}>
          <label>Prijs vanaf (€)
            <input name="min_price" type="number" min="0" step="1" placeholder="Bijv. 250" defaultValue={me.min_price} />
          </label>
          <label>Prijs toelichting
            <input name="price_note" placeholder="Bijv. excl. reiskosten" defaultValue={me.price_note} />
          </label>
        </div>

        <div style={{display:'flex', gap:10, alignItems:'center'}}>
          <button disabled={busy}>{busy ? 'Opslaan…' : 'Opslaan'}</button>
          {ok && <span style={{color:'green'}}>{ok}</span>}
          {err && <span style={{color:'crimson'}}>{err}</span>}
        </div>
      </form>

      {/* Badges specialties */}
      {Array.isArray(me.specialties) && me.specialties.length > 0 && (
        <div style={{marginTop:16, display:'flex', gap:8, flexWrap:'wrap'}}>
          {me.specialties.map((s, i) => (
            <span key={i} style={{border:'1px solid #ddd', borderRadius:999, padding:'4px 10px', fontSize:12}}>{s}</span>
          ))}
        </div>
      )}

      {/* Portfolio sectie */}
      <hr style={{margin:'28px 0'}} />
      <h2>Portfolio</h2>
      <p style={{color:'#555', marginTop:4}}>Upload foto’s van eerdere opdrachten. (Publiek zichtbaar op je profiel.)</p>

      <div style={{margin:'10px 0'}}>
        <input type="file" accept="image/*" multiple onChange={onUploadPortfolio} disabled={uploading} />
        {uploading && <span style={{marginLeft:8}}>Uploaden…</span>}
      </div>

      {portfolio.length === 0 ? (
        <div style={{color:'#666'}}>Nog geen portfolio-items.</div>
      ) : (
        <div style={{display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', marginTop:10}}>
          {portfolio.map(item => (
            <div key={item.name} style={{border:'1px solid #eee', borderRadius:8, overflow:'hidden', position:'relative'}}>
              <img src={item.url} alt="" style={{width:'100%', height:130, objectFit:'cover', display:'block'}} />
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 8px'}}>
                <a href={item.url} target="_blank" rel="noreferrer" style={{fontSize:12}}>Open</a>
                <button
                  onClick={() => removePortfolioItem(item.name)}
                  disabled={removing === item.name}
                  style={{fontSize:12}}
                >
                  {removing === item.name ? 'Verwijderen…' : 'Verwijderen'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}