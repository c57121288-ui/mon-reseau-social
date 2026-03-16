import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import Auth from './components/Auth';
import Feed from './components/Feed';
import Profile from './components/Profile';
import Search from './components/Search';
import Messages from './components/Messages';
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

  const handleLogout = async () => await supabase.auth.signOut();

  if (!user) return <Auth />;

  return (
    <div className="app">
      <nav className="navbar">
        <h1>
          <img src="/logo.svg" alt="Faso" style={{height:'30px'}}/>
          FASO
        </h1>
        <div className="nav-links">
          <button onClick={() => setPage('feed')} className={page === 'feed' ? 'active' : ''}>
            🏠
          </button>
          <button onClick={() => setPage('search')} className={page === 'search' ? 'active' : ''}>
            🔍
          </button>
          <button onClick={() => setPage('messages')} className={page === 'messages' ? 'active' : ''}>
            💬
          </button>
          <button onClick={() => setPage('profile')} className={page === 'profile' ? 'active' : ''}>
            👤
          </button>
          <button onClick={handleLogout} className="logout-btn">
            ⏻
          </button>
        </div>
      </nav>
      <main className="main-content" style={page === 'messages' ? {maxWidth:'100%', padding:0} : {}}>
        {page === 'feed' && <Feed user={user} />}
        {page === 'search' && <Search user={user} />}
        {page === 'messages' && <Messages user={user} />}
        {page === 'profile' && <Profile user={user} />}
      </main>
    </div>
  );
}

export default App;