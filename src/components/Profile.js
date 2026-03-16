import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

function Profile({ user }) {
  const [profile, setProfile] = useState({ username: '', bio: '' });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user.id]);

  const handleSave = async () => {
    await supabase.from('profiles').update({
      username: profile.username,
      bio: profile.bio
    }).eq('id', user.id);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-avatar">
          {profile.username?.[0]?.toUpperCase() || '?'}
        </div>
        {editing ? (
          <>
            <input type="text" value={profile.username}
              onChange={(e) => setProfile({ ...profile, username: e.target.value })}
              placeholder="Nom d'utilisateur" />
            <textarea value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              placeholder="Parle de toi..." rows={3} />
            <button onClick={handleSave}>💾 Sauvegarder</button>
            <button onClick={() => setEditing(false)} className="cancel-btn">Annuler</button>
          </>
        ) : (
          <>
            <h2>{profile.username || 'Sans nom'}</h2>
            <p className="profile-email">{user.email}</p>
            <p className="profile-bio">{profile.bio || 'Aucune bio pour le moment.'}</p>
            <button onClick={() => setEditing(true)}>✏️ Modifier le profil</button>
            {saved && <p className="success">✅ Profil mis à jour !</p>}
          </>
        )}
      </div>
    </div>
  );
}

export default Profile;