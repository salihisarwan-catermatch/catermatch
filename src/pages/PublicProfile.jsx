// src/pages/PublicProfile.jsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function PublicProfile(){
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState('');
  const [portfolio, setPortfolio] = useState([]); // [{name, url}]
  const [loadingPf, setLoadingPf] = useState(true);
  const [loadingPort, setLoadingPort] = useState(true);

  // Profiel laden
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

  // Portfolio laden (bucket: portfolio, map: {userId}/)
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

  if (loadingPf && !err) return <div style={{padding:20}}>Profiel laden…</div>;
  if (err) return <div style={{padding:20, color:'crimson'}}>Kon profiel niet laden: {err}</div>;
  if (!profile) return <div style={{padding:20}}>Geen profiel gevonden.</div>;

  const isCaterer = profile.role === 'caterer';
  const title = profile.company_name || profile.display_name || 'Cateraar';
  const websiteClean = profile.website?.startsWith('http') ? profile.website : (profile.website ? `https://${profile.website}` : null);

  function euro(v){
    if (v == null || Number.isNaN(Number(v))) return null;
    try { return Number(v).toLocaleString('nl-NL', { style:'currency', currency:'EUR' }); }
    catch { return `€ ${v}`; }
  }

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
    </div>
  );
}