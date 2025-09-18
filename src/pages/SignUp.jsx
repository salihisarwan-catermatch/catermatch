import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function SignUp(){
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [name,setName] = useState('');
  const [role,setRole] = useState('owner'); // 'owner' of 'caterer'
  const [busy,setBusy] = useState(false);
  const [err,setErr] = useState('');
  const nav = useNavigate();

  async function handleSubmit(e){
    e.preventDefault();
    setBusy(true); setErr('');

    // 1) Account aanmaken
    const { data: signData, error: signErr } = await supabase.auth.signUp({ email, password });
    if (signErr) { setErr(signErr.message); setBusy(false); return; }
    const user = signData.user;

    // 2) Profiel opslaan (tabel 'users' heb je in stap 1 aangemaakt met policies)
    const { error: profErr } = await supabase.from('users').insert({
      id: user.id,
      display_name: name,
      role
    });
    if (profErr) { setErr(profErr.message); setBusy(false); return; }

    nav('/');
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
      <p style={{marginTop:12}}>Heb je al een account? <Link to="/login">Inloggen</Link></p>
    </div>
  );
}