import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Login(){
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [busy,setBusy] = useState(false);
  const [err,setErr] = useState('');
  const nav = useNavigate();

  async function handleSubmit(e){
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('[login] data:', data, 'error:', error);
      if (error) {
        setErr(error.message);
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      console.log('[login] session after sign-in:', sess);
      if (!sess.session) {
        setErr('Inloggen gelukt maar geen sessie gevonden. Controleer e-mailbevestiging in Supabase.');
        return;
      }
      nav('/');
    } catch (e) {
      console.error(e);
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{maxWidth:420, margin:'40px auto', fontFamily:'system-ui'}}>
      <h1>Inloggen</h1>
      <form onSubmit={handleSubmit} style={{display:'grid', gap:12}}>
        <input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input type="password" placeholder="Wachtwoord" value={password} onChange={e=>setPassword(e.target.value)} required />
        <button disabled={busy}>{busy ? 'Bezig…' : 'Inloggen'}</button>
        {err && <div style={{color:'crimson'}}>{err}</div>}
      </form>
      <p style={{marginTop:12}}>Nog geen account? <Link to="/signup">Account aanmaken</Link></p>
    </div>
  );
}