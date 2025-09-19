import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function PublicProfile(){
  const { userId } = useParams();
  const [me, setMe] = useState(null);       // ingelogde user (optioneel)
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    // Niet strikt nodig, maar handig als je later wilt personaliseren
    supabase.auth.getSession().then(({data}) => setMe(data.session?.user ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    // Alleen-lezen profieldata ophalen
    supabase.from('users')
      .select('id, role, email, display_name, company_name, bio, specialties, logo_url, city, website')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (error) { setErr(error.message); return; }
        setProfile(data);
      });
  }, [userId]);

  if (!profile && !err) return <div style={{padding:20}}>Profiel laden…</div>;
  if (err) return <div style={{padding:20, color:'crimson'}}>Kon profiel niet laden: {err}</div>;
  if (!profile) return <div style={{padding:20}}>Geen profiel gevonden.</div>;

  const isCaterer = profile.role === 'caterer';
  const title = profile.company_name || profile.display_name || profile.email || 'Cateraar';
  const websiteClean = profile.website?.startsWith('http') ? profile.website : (profile.website ? `https://${profile.website}` : null);

  return (
    <div style={{maxWidth:900, margin:'40px auto', fontFamily:'system-ui'}}>
      <div style={{marginBottom:12}}>
        <Link to={document.referrer ? -1 : '/'}>← Terug</Link>
      </div>

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
        </div>
      </div>

      {profile.bio && (
        <div style={{marginTop:16}}>
          <h3 style={{margin:'6px 0'}}>Over</h3>
          <p style={{whiteSpace:'pre-wrap', lineHeight:1.6}}>{profile.bio}</p>
        </div>
      )}

      {profile.specialties?.length ? (
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
      ) : null}
    </div>
  );
}