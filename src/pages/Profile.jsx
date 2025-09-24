// src/pages/Profile.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../supabase';

export default function Profile(){
  // ---- Auth / user ----
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);

  // ---- Save state ----
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  // ---- Portfolio ----
  const [portfolio, setPortfolio] = useState([]);   // [{name, url}]
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState('');

  // ---- Reviews (ontvangen) ----
  const [reviews, setReviews] = useState([]);       // [{id,rating,comment,created_at,owner_id}]
  const [ownersMap, setOwnersMap] = useState({});   // {owner_id: display_name}
  const [loadingReviews, setLoadingReviews] = useState(true);

  // 1) Session
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session ?? null);
    });
    return () => { alive = false; };
  }, []);

  // 2) Mijn users-profiel
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
    return () => { /* no-op */ };
  }, [session]);

  // 3) Portfolio
  const loadPortfolio = useCallback(async (userId) => {
    if (!userId) return;
    const prefix = `${userId}/`;
    const { data, error } = await supabase.storage.from('portfolio').list(prefix, { limit: 100, offset: 0 });
    if (error) { console.error(error); setPortfolio([]); return; }
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

  // 4) Ontvangen reviews (voor cateraar)
  useEffect(() => {
    let alive = true;
    async function load(){
      if (!session?.user?.id) return;
      setLoadingReviews(true);

      // laatste 20 reviews ophalen
      const { data: revs, error } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, owner_id')
        .eq('caterer_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!alive) return;
      if (error) { console.error(error); setReviews([]); setOwnersMap({}); setLoadingReviews(false); return; }
      setReviews(revs || []);

      // display_name van owners ophalen
      const ownerIds = Array.from(new Set((revs || []).map(r => r.owner_id))).filter(Boolean);
      if (ownerIds.length) {
        const { data: owners, error: ownersErr } = await supabase
          .from('users')
          .select('id, display_name')
          .in('id', ownerIds);
        if (!alive) return;
        if (ownersErr) { console.error(ownersErr); setOwnersMap({}); setLoadingReviews(false); return; }
        const map = {};
        (owners || []).forEach(o => { map[o.id] = o.display_name || 'Owner'; });
        setOwnersMap(map);
      } else {
        setOwnersMap({});
      }

      setLoadingReviews(false);
    }
    load();
    return () => { alive = false; };
  }, [session?.user?.id]);

  // ---- Afgeleide flags ----
  const notReady = !session || !me;
  const isNotCaterer = useMemo(() => me && me.role !== 'caterer', [me]);

  // ---- Helpers ----
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

  // ---- Ratings helpers ----
  const ratingStats = useMemo(() => {
    if (!reviews || reviews.length === 0) return { count: 0, avg: null };
    const sum = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);
    const avg = sum / reviews.length;
    return { count: reviews.length, avg };
  }, [reviews]);

  function Stars({ value = 0, size = 18 }){
    const full = Math.round(value);
    const arr = [1,2,3,4,5];
    return (
      <span aria-label={`${value?.toFixed ? value.toFixed(1) : value}/5`} title={`${value?.toFixed ? value.toFixed(1) : value}/5`}>
        {arr.map(n => (
          <span key={n} style={{ color: n <= full ? '#f5a524' : '#ccc', fontSize: size, lineHeight: 1 }}>★</span>
        ))}
      </span>
    );
  }

  // ---- Render ----
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

      {/* Portfolio */}
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

      {/* Ontvangen reviews */}
      <hr style={{margin:'28px 0'}} />
      <h2>Ontvangen reviews</h2>

      {/* Samenvatting */}
      {ratingStats.count > 0 ? (
        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
          <Stars value={ratingStats.avg} />
          <span style={{color:'#333', fontWeight:600}}>
            {ratingStats.avg.toFixed(1)}/5
          </span>
          <span style={{color:'#666'}}>({ratingStats.count} review{ratingStats.count>1?'s':''}, laatste 20)</span>
        </div>
      ) : (
        <div style={{color:'#666', marginBottom:8}}>Nog geen reviews ontvangen.</div>
      )}

      {/* Lijst */}
      {loadingReviews ? (
        <div>Reviews laden…</div>
      ) : reviews.length === 0 ? null : (
        <div style={{display:'grid', gap:10}}>
          {reviews.map(r => (
            <div key={r.id} style={{border:'1px solid #eee', borderRadius:8, padding:10}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{display:'flex', gap:8, alignItems:'center'}}>
                  <Stars value={r.rating} />
                  <b>{r.rating}/5</b>
                </div>
                <div style={{fontSize:12, color:'#666'}}>
                  {new Date(r.created_at).toLocaleDateString('nl-NL')}
                </div>
              </div>
              {r.comment && (
                <div style={{marginTop:6, color:'#333', whiteSpace:'pre-wrap'}}>{r.comment}</div>
              )}
              <div style={{marginTop:6, fontSize:12, color:'#666'}}>
                door {ownersMap[r.owner_id] || 'Owner'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}