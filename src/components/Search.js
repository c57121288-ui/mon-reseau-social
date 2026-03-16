import React, { useState } from 'react';
import { supabase } from '../supabase';

function Search({ user }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [following, setFollowing] = useState([]);

  const handleSearch = async (e) => {
    const val = e.target.value;
    setQuery(val);
    if (!val.trim()) { setResults([]); return; }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${val}%`)
      .neq('id', user.id)
      .limit(10);

    setResults(data || []);

    // Vérifie qui on suit déjà
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    setFollowing((follows || []).map(f => f.following_id));
  };

  const handleFollow = async (targetId) => {
    if (following.includes(targetId)) {
      await supabase.from('follows').delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetId);
      setFollowing(following.filter(id => id !== targetId));
    } else {
      await supabase.from('follows').insert({
        follower_id: user.id,
        following_id: targetId
      });
      setFollowing([...following, targetId]);

      // Crée une notification
      await supabase.from('notifications').insert({
        user_id: targetId,
        from_id: user.id,
        type: 'follow',
        message: 'a commencé à vous suivre'
      });
    }
  };

  return (
    <div className="search-container">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Rechercher un utilisateur..."
          value={query}
          onChange={handleSearch}
        />
      </div>

      {results.length === 0 && query && (
        <p style={{textAlign:'center', color:'#888', padding:'20px'}}>
          Aucun utilisateur trouvé
        </p>
      )}

      {results.map(u => (
        <div key={u.id} className="user-card">
          <div className="avatar">{u.username?.[0]?.toUpperCase()}</div>
          <div>
            <div style={{fontWeight:600}}>{u.username}</div>
            <div style={{fontSize:12, color:'#888'}}>{u.bio || 'Aucune bio'}</div>
          </div>
          <button
            className={`btn-follow ${following.includes(u.id) ? 'following' : ''}`}
            onClick={() => handleFollow(u.id)}
          >
            {following.includes(u.id) ? '✓ Suivi' : '+ Suivre'}
          </button>
        </div>
      ))}
    </div>
  );
}

export default Search;