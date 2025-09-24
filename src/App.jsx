import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Pagina's
import SignUp from './pages/SignUp.jsx';
import Login from './pages/Login.jsx';
import NewEvent from './pages/NewEvent.jsx';
import MyEvents from './pages/MyEvents.jsx';
import OpenEvents from './pages/OpenEvents.jsx';
import PlaceBid from './pages/PlaceBid.jsx';
import MyBids from './pages/MyBids.jsx';
import EventBids from './pages/EventBids.jsx';
import MyChats from './pages/MyChats.jsx';
import ChatThread from './pages/ChatThread.jsx';
import Profile from './pages/Profile.jsx';
import PublicProfile from './pages/PublicProfile.jsx';
import Landing from './pages/Landing.jsx';
import OwnerProfile from './pages/OwnerProfile.jsx';
import OwnerPublic from './pages/OwnerPublic.jsx'; // ⬅️ NIEUW

// Layout met menubalk (authed)
import Layout from './Layout.jsx';

function useSession(){
  const [session,setSession] = useState(null);
  const [ready,setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, ready };
}

function Dashboard({ profile }){
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welkom terug, <b>{profile?.display_name ?? 'gebruiker'}</b>!</p>
      <p>Je rol is: <b>{profile?.role}</b></p>
    </div>
  );
}

function RequireAuth({ children }) {
  const { session, ready } = useSession();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!session) return;
    supabase.from('users').select('*').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data));
  }, [session]);

  if (!ready) return <div style={{padding:20}}>Laden…</div>;
  if (!session) return <Navigate to="/login" replace />;

  return (
    <Layout profile={profile}>
      {typeof children === 'function' ? children(profile) : children}
    </Layout>
  );
}

/** Publieke Home: niet ingelogd → Landing; ingelogd → Dashboard */
function Home(){
  const { session, ready } = useSession();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!session) return;
    supabase.from('users').select('*').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data));
  }, [session]);

  if (!ready) return <div style={{padding:20}}>Laden…</div>;
  if (!session) {
    // Publieke landing zonder Layout
    return <Landing />;
  }
  // Ingelogd: dashboard binnen Layout
  return (
    <Layout profile={profile}>
      <Dashboard profile={profile} />
    </Layout>
  );
}

export default function App(){
  return (
    <Routes>
      {/* Publieke of ingelogde home */}
      <Route path="/" element={<Home />} />

      {/* Auth */}
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<Login />} />

      {/* Owner-routes */}
      <Route path="/events/new" element={<RequireAuth>{() => <NewEvent />}</RequireAuth>} />
      <Route path="/events/mine" element={<RequireAuth>{() => <MyEvents />}</RequireAuth>} />
      <Route path="/events/:eventId/bids" element={<RequireAuth>{() => <EventBids />}</RequireAuth>} />
      {/* Owner-profiel (privé) */}
      <Route path="/owner/profile" element={<RequireAuth>{() => <OwnerProfile />}</RequireAuth>} />
      {/* ⬇️ NIEUW: Owner-profiel (publiek voor ingelogden) */}
      <Route path="/owners/:userId" element={<RequireAuth>{() => <OwnerPublic />}</RequireAuth>} />

      {/* Caterer-routes */}
      <Route path="/events/open" element={<RequireAuth>{() => <OpenEvents />}</RequireAuth>} />
      <Route path="/events/:eventId/bid" element={<RequireAuth>{() => <PlaceBid />}</RequireAuth>} />
      <Route path="/bids/mine" element={<RequireAuth>{() => <MyBids />}</RequireAuth>} />

      {/* Chats (beide rollen) */}
      <Route path="/chats/mine" element={<RequireAuth>{() => <MyChats />}</RequireAuth>} />
      <Route path="/chats/:chatId" element={<RequireAuth>{() => <ChatThread />}</RequireAuth>} />

      {/* Cateraar-profielen */}
      <Route path="/profile" element={<RequireAuth>{() => <Profile />}</RequireAuth>} />
      <Route path="/caterers/:userId" element={<RequireAuth>{() => <PublicProfile />}</RequireAuth>} />

      {/* Fallback */}
      <Route path="*" element={<div style={{padding:20}}>Pagina niet gevonden.</div>} />
    </Routes>
  );
}