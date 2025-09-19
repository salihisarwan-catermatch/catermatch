import { Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabase';

export default function Layout({ children, profile }){
  const nav = useNavigate();

  async function logout(){
    await supabase.auth.signOut();
    nav('/login');
  }

  return (
    <div style={{fontFamily:'system-ui'}}>
      {/* Menubalk */}
      <div style={{
        background:'#333', color:'#fff',
        padding:'10px 20px',
        display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12
      }}>
        <div style={{display:'flex', gap:16, flexWrap:'wrap'}}>
          <Link to="/" style={{color:'#fff', textDecoration:'none'}}>Dashboard</Link>

          {profile?.role === 'owner' && (
            <>
              <Link to="/events/new" style={{color:'#fff', textDecoration:'none'}}>Nieuw event</Link>
              <Link to="/events/mine" style={{color:'#fff', textDecoration:'none'}}>Mijn events</Link>
            </>
          )}

          {profile?.role === 'caterer' && (
            <>
              <Link to="/events/open" style={{color:'#fff', textDecoration:'none'}}>Open events</Link>
              <Link to="/bids/mine" style={{color:'#fff', textDecoration:'none'}}>Mijn biedingen</Link>
            </>
          )}

          {/* Altijd zichtbaar */}
          <Link to="/profile" style={{color:'#fff', textDecoration:'none'}}>Mijn profiel</Link>
          <Link to="/chats/mine" style={{color:'#fff', textDecoration:'none'}}>Mijn chats</Link>
        </div>

        <button onClick={logout} style={{background:'crimson', color:'#fff', border:'none', padding:'6px 12px', borderRadius:4}}>
          Uitloggen
        </button>
      </div>

      {/* Pagina-inhoud */}
      <div style={{padding:'20px'}}>
        {children}
      </div>
    </div>
  );
}