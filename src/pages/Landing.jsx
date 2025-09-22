// src/pages/Landing.jsx
import { Link } from 'react-router-dom';

export default function Landing(){
  return (
    <div style={{fontFamily:'system-ui', color:'#111'}}>
      {/* Topbar (publiek) */}
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'12px 20px', borderBottom:'1px solid #eee'
      }}>
        <div style={{fontWeight:700}}>Catermatch</div>
        <div style={{display:'flex', gap:12}}>
          <Link to="/login">Inloggen</Link>
          <Link to="/signup" style={{padding:'6px 10px', border:'1px solid #111', borderRadius:6, textDecoration:'none'}}>Account aanmaken</Link>
        </div>
      </div>

      {/* Hero */}
      <div style={{maxWidth:980, margin:'60px auto', padding:'0 20px'}}>
        <h1 style={{fontSize:36, lineHeight:1.2, margin:'0 0 12px'}}>Vind snel de juiste cateraar voor jouw event</h1>
        <p style={{fontSize:18, color:'#444', margin:'0 0 20px'}}>
          Owners plaatsen een aanvraag met details & foto’s. Cateraars bieden.
          Jij kiest, bevestigt en chat direct verder — allemaal op één plek.
        </p>
        <div style={{display:'flex', gap:12}}>
          <Link to="/signup?role=owner" style={ctaStyle('black')}>Ik ben Owner</Link>
          <Link to="/signup?role=caterer" style={ctaStyle('white')}>Ik ben Cateraar</Link>
        </div>

        {/* Bullets */}
        <div style={{display:'grid', gap:16, gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', marginTop:40}}>
          {[
            ['Snel aanvragen', 'Plaats je event met datum, plaats en budget.'],
            ['Biedingen ontvangen', 'Cateraars doen een voorstel met prijs en bericht.'],
            ['Boeken & chatten', 'Accepteer een bod en start direct een chat.'],
            ['Profielen', 'Bekijk logo, specialisaties en website van cateraars.'],
          ].map(([title, body], i) => (
            <div key={i} style={{border:'1px solid #eee', borderRadius:10, padding:16}}>
              <div style={{fontWeight:600, marginBottom:6}}>{title}</div>
              <div style={{color:'#555'}}>{body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{borderTop:'1px solid #eee', padding:'14px 20px', fontSize:13, color:'#666', textAlign:'center'}}>
        © {new Date().getFullYear()} Catermatch
      </div>
    </div>
  );
}

function ctaStyle(variant){
  if (variant === 'black') {
    return {
      background:'#111', color:'#fff', padding:'10px 14px', borderRadius:8, textDecoration:'none'
    };
  }
  return {
    background:'#fff', color:'#111', padding:'10px 14px', border:'1px solid #111', borderRadius:8, textDecoration:'none'
  };
}