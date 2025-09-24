// src/pages/PublicProfile.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function PublicProfile(){
  const { userId } = useParams();

  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState('');

  // Portfolio
  const [portfolio, setPortfolio] = useState([]); // [{name, url}]
  const [loadingPf, setLoadingPf] = useState(true);
  const [loadingPort, setLoadingPort] = useState(true);

  // Reviews
  const [reviews, setReviews] = useState([]); // [{id,rating,comment,created_at,owner_id}]
  const [ownersMap, setOwnersMap] = useState({}); // {owner_id: display_name}
  const [loadingReviews, setLoadingReviews] = useState(true);

  /* ---------------- Profile ---------------- */
  useEffect(() => {
    let alive = true;
    async function load(){
      if (!userId) return;
      setLoadingPf(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, role, display_name, company_name, bio, specialties, logo_url, city, website, min_price, price_note')
        .eq('id', userId)
        .single();
      if (!alive) return;
      if (error) { setErr(error.message); setLoadingPf(false); return; }
      setProfile(data);
      setLoadingPf(false);
    }
    load();
    return () => { alive = false; };
  }, [userId]);

  /* ---------------- Portfolio ---------------- */
  const loadPortfolio = useCallback(async (uid) => {
    if (!uid) return;
    setLoadingPort(true);
    const prefix = `${uid}/`;
    const { data, error } = await supabase.storage.from('portfolio').list(prefix, { limit: 100, offset: 0 });
    if (error) { console.error(error); setPortfolio([]); setLoadingPort(false); return; }
    const items = data || [];
    const urls = await Promise.all(items.map(async (it) => {
      const name = `${prefix}${it.name}`;
      const { data: pub } = await supabase.storage.from('portfolio').getPublicUrl(name);
      return { name, url: pub.publicUrl };
    }));
    setPortfolio(urls);
    setLoadingPort(false);
  }, []);

  useEffect(() => {
    if (userId) loadPortfolio(userId);
  }, [userId, loadPortfolio]);

  /* ---------------- Reviews ---------------- */
  useEffect(() => {
    let alive = true;
    async function loadReviews(){
      if (!userId) return;
      setLoadingReviews(true);

      // 1) Recente reviews voor deze cateraar (laatste 10)
      const { data: revs, error } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, owner_id')
        .eq('caterer_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (!alive) return;
      if (error) { console.error(error); setReviews([]); setLoadingReviews(false); return; }
      setReviews(revs || []);

      // 2) Haal display_names van owners op
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
    loadReviews();
    return () => { alive = false; };
  }, [userId]);

  const ratingStats = useMemo(() => {
    if (!reviews || reviews.length === 0) return { count: 0, avg: null };
    const sum = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);
    const avg = sum / reviews.length;
    return { count: reviews.length, avg };
  }, [reviews]);

  /* ---------------- Helpers ---------------- */
  function euro(v){
    if (v == null || Number.isNaN(Number(v))) return null;
    try { return Number(v).toLocaleString('nl-NL', { style:'currency', currency:'EUR' }); }
    catch { return `€ ${v}`; }
  }

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

  /* ---------------- Renders ---------------- */
  if (loadingPf && !err) return <div style={{padding:20}}>Profiel laden…</div>;
  if (err) return <div style={{padding:20, color:'crimson'}}>Kon profiel niet laden: {err}</div>;
  if (!profile) return <div style={{padding:20}}>Geen profiel gevonden.</div>;

  const isCaterer = profile.role === 'caterer';
  const title = profile.company_name || profile.display_name || 'Cateraar';
  const websiteClean = profile.website?.startsWith('http') ? profile.website : (profile.website ? `https://${profile.website}` : null);

  return (
    <div style={{maxWidth:900, margin:'40px auto', fontFamily:'system-ui'}}>
      <div style={{marginBottom:12}}>
        <Link to={document.referrer ? -1 : '/'}>← Terug</Link>
      </div>

      {/* Header */}
      <div style={{display:'flex', gap:20, alignItems:'center', flexWrap:'wrap'}}>
        <div style={{width:120, height:120, border:'1px solid #ddd', borderRadius:12, overflow:'hidden', background:'#f7f7f7'}}>
          {profile.logo_url ? (
            <img src={profile.logo_url} alt="Logo" style={{width:'100%', height:'100%', objectFit:'cover'}} />
          ) : (
            <div style={{fontSize:12, color:'#888', display:'flex', alignItems:'center', justifyContent:'center', height:'100%'}}>Geen logo</div>
          )}
        </div>
        <div>
          <h1 style={{margin:'6px 0'}}>{title}</h1>
          <div style={{color:'#666'}}>
            Rol: <b>{isCaterer ? 'Cateraar' : profile.role}</b>
            {profile.city ? <> • Locatie: <b>{profile.city}</b></> : null}
          </div>
          {websiteClean && (
            <div style={{marginTop:6}}>
              Website: <a href={websiteClean} target="_blank" rel="noreferrer">{websiteClean}</a>
            </div>
          )}
          {(profile.min_price != null || profile.price_note) && (
            <div style={{marginTop:10, padding:'8px 10px', border:'1px solid #e5e5e5', borderRadius:8, background:'#fafafa'}}>
              <div style={{fontWeight:600, marginBottom:4}}>Prijzen</div>
              {profile.min_price != null && (<div>Vanaf: <b>{euro(profile.min_price)}</b></div>)}
              {profile.price_note && (<div style={{color:'#555', marginTop:2}}>{profile.price_note}</div>)}
            </div>
          )}
          {/* Gemiddelde rating */}
          <div style={{marginTop:10}}>
            {ratingStats.count > 0 ? (
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <Stars value={ratingStats.avg} />
                <span style={{color:'#333', fontWeight:600}}>
                  {ratingStats.avg.toFixed(1)}/5
                </span>
                <span style={{color:'#666'}}>({ratingStats.count} review{ratingStats.count>1?'s':''})</span>
              </div>
            ) : (
              <div style={{color:'#666'}}>Nog geen reviews</div>
            )}
          </div>
        </div>
      </div>

      {/* Over */}
      {profile.bio && (
        <div style={{marginTop:16}}>
          <h3 style={{margin:'6px 0'}}>Over</h3>
          <p style={{whiteSpace:'pre-wrap', lineHeight:1.6}}>{profile.bio}</p>
        </div>
      )}

      {/* Specialisaties */}
      {Array.isArray(profile.specialties) && profile.specialties.length > 0 && (
        <div style={{marginTop:16}}>
          <h3 style={{margin:'6px 0'}}>Specialisaties</h3>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {profile.specialties.map((s, i) => (
              <span key={i} style={{border:'1px solid #ddd', borderRadius:999, padding:'4px 10px', fontSize:12}}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio */}
      <div style={{marginTop:24}}>
        <h3 style={{margin:'6px 0'}}>Portfolio</h3>
        {loadingPort ? (
          <div>Portfolio laden…</div>
        ) : portfolio.length === 0 ? (
          <div style={{color:'#666'}}>Nog geen portfolio-items.</div>
        ) : (
          <div style={{display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))'}}>
            {portfolio.map(item => (
              <a key={item.name} href={item.url} target="_blank" rel="noreferrer"
                 style={{border:'1px solid #eee', borderRadius:8, overflow:'hidden', display:'block'}}>
                <img src={item.url} alt="" style={{width:'100%', height:130, objectFit:'cover', display:'block'}} />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Reviews lijst */}
      <div style={{marginTop:24}}>
        <h3 style={{margin:'6px 0'}}>Reviews</h3>
        {loadingReviews ? (
          <div>Reviews laden…</div>
        ) : reviews.length === 0 ? (
          <div style={{color:'#666'}}>Nog geen reviews.</div>
        ) : (
          <div style={{display:'grid', gap:10}}>
            {reviews.map((r) => (
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
    </div>
  );
}