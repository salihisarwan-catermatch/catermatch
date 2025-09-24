// src/pages/OwnerPublic.jsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function OwnerPublic(){
  const { userId } = useParams();
  const [owner, setOwner] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load(){
      try {
        setLoading(true); setErr('');
        const { data, error } = await supabase
          .from('users')
          .select('id, role, display_name, logo_url, city, website, bio')
          .eq('id', userId)
          .single();
        if (!alive) return;
        if (error) throw error;
        setOwner(data);
      } catch (e) {
        if (!alive) return;
        setErr(e.message ?? String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    if (userId) load();
    return () => { alive = false; };
  }, [userId]);

  const websiteClean = useMemo(() => {
    const w = owner?.website?.trim();
    if (!w) return null;
    return w.startsWith('http') ? w : `https://${w}`;
  }, [owner]);

  if (loading) return <div style={{ padding: 20 }}>Profiel laden…</div>;
  if (err) return <div style={{ padding: 20, color: 'crimson' }}>Kon profiel niet laden: {err}</div>;
  if (!owner) return <div style={{ padding: 20 }}>Owner niet gevonden.</div>;
  if (owner.role !== 'owner') return <div style={{ padding: 20 }}>Dit is geen owner-profiel.</div>;

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', fontFamily: 'system-ui' }}>
      <div style={{ marginBottom: 12 }}>
        <Link to={document.referrer ? -1 : '/'}>← Terug</Link>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 120, height: 120, border: '1px solid #ddd', borderRadius: 12, overflow: 'hidden', background: '#f7f7f7' }}>
          {owner.logo_url ? (
            <img src={owner.logo_url} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              Geen foto
            </div>
          )}
        </div>
        <div>
          <h1 style={{ margin: '6px 0' }}>{owner.display_name || 'Owner'}</h1>
          <div style={{ color: '#666' }}>
            Rol: <b>Owner</b>
            {owner.city ? <> • Locatie: <b>{owner.city}</b></> : null}
          </div>
          {websiteClean && (
            <div style={{ marginTop: 6 }}>
              Website: <a href={websiteClean} target="_blank" rel="noreferrer">{websiteClean}</a>
            </div>
          )}
        </div>
      </div>

      {/* Over */}
      {owner.bio && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ margin: '6px 0' }}>Over</h3>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{owner.bio}</p>
        </div>
      )}
    </div>
  );
}