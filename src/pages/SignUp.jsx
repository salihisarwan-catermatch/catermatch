import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { usePageMeta } from '../usePageMeta';

export default function SignUp(){
  usePageMeta({
    title: 'Account aanmaken — Catermatch',
    robots: 'noindex, nofollow',
    canonical: 'https://catermatch.nl/signup'
  });

  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [name,setName] = useState('');
  const [role,setRole] = useState('owner'); // 'owner' of 'caterer'
  const [busy,setBusy] = useState(false);
  const [err,setErr] = useState('');
  const nav = useNavigate();
  const loc = useLocation();

  // Voorvullen rol via ?role=owner|caterer
  useEffect(() => {
    const p = new URLSearchParams(loc.search);
    const r = (p.get('role') || '').toLowerCase();
    if (r === 'owner' || r === 'caterer') setRole(r);
  }, [loc.search]);

  async function handleSubmit(e){
    e.preventDefault();
    setBusy(true); setErr('');

    try {
      // 1) Account aanmaken
      const { data: signData, error: signErr } = await supabase.auth.signUp({ email, password });
      if (signErr) throw signErr;
      const user = signData.user;
      if (!user) throw new Error('Gebruiker niet gevonden na registratie.');

      // 2) Profiel opslaan (inclusief email → handig voor notificaties)
      const { error: profErr } = await supabase.from('users').insert({
        id: user.id,
        display_name: name,
        role,
        email
      });
      if (profErr) throw profErr;

      nav('/');
    } catch (e2) {
      setErr(e2.message ?? String(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{maxWidth:420, margin:'40px auto', fontFamily:'system-ui'}}>
      <h1>Account aanmaken</h1>
      <form onSubmit={handleSubmit} style={{display:'grid', gap:12}}>
        <input placeholder="Naam" value={name} onChange={e=>setName(e.target.value)} required />
        <input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input type="password" placeholder="Wachtwoord" value={password} onChange={e=>setPassword(e.target.value)} required />

        <label>Rol:&nbsp;
          <select value={role} onChange={e=>setRole(e.target.value)}>
            <option value="owner">Event owner</option>
            <option value="caterer">Cateraar</option>
          </select>
        </label>

        <button disabled={busy}>{busy ? 'Bezig…' : 'Registreren'}</button>
        {err && <div style={{color:'crimson'}}>{err}</div>}
      </form>

      <p style={{marginTop:12}}>
        Heb je al een account? <Link to="/login">Inloggen</Link>
      </p>
    </div>
  );
}