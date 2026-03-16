import React, { useState } from 'react';
import { supabase } from '../supabase';

function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleRegister = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(error.message); return; }

    // Crée le profil dans la table profiles
    await supabase.from('profiles').insert({
      id: data.user.id,
      username: username,
      bio: ''
    });
    setMessage('Compte créé ! Tu peux te connecter.');
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError('Email ou mot de passe incorrect');
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>🌍 MonReseau</h2>
        <h3>{isLogin ? 'Connexion' : 'Créer un compte'}</h3>

        {!isLogin && (
          <input
            type="text"
            placeholder="Nom d'utilisateur"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Mot de passe (min. 6 caractères)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <button onClick={isLogin ? handleLogin : handleRegister}>
          {isLogin ? 'Se connecter' : "S'inscrire"}
        </button>

        <p onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); }} className="toggle-auth">
          {isLogin ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
        </p>
      </div>
    </div>
  );
}

export default Auth;