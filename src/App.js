import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import Auth from './components/Auth';
import Feed from './components/Feed';
import Profile from './components/Profile';
import './styles/App.css';

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('feed');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!user) return <Auth />;

  return (
    <div className="app">
      <nav className="navbar">
        <h1>🌍 MonReseau</h1>
        <div className="nav-links">
          <button onClick={() => setPage('feed')} className={page === 'feed' ? 'active' : ''}>
            Fil d'actualité
          </button>
          <button onClick={() => setPage('profile')} className={page === 'profile' ? 'active' : ''}>
            Mon Profil
          </button>
          <button onClick={handleLogout} className="logout-btn">
            Déconnexion
          </button>
        </div>
      </nav>
      <main className="main-content">
        {page === 'feed' && <Feed user={user} />}
        {page === 'profile' && <Profile user={user} />}
      </main>
    </div>
  );
}

export default App;