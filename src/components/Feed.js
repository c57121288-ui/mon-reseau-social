import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import CreatePost from './CreatePost';
import Post from './Post';

function Feed({ user }) {
  const [posts, setPosts] = useState([]);
  const [username, setUsername] = useState('');

  useEffect(() => {
    supabase.from('profiles').select('username').eq('id', user.id).single()
      .then(({ data }) => { if (data) setUsername(data.username); });

    supabase.from('posts').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setPosts(data || []));
  }, [user.id]);

  return (
    <div className="feed">
      <CreatePost user={user} username={username} />
      <div className="posts-list">
        {posts.length === 0 && (
          <p className="empty-feed">Aucun post pour l'instant. Soyez le premier ! 🚀</p>
        )}
        {posts.map(post => (
          <Post key={post.id} post={post} user={user} />
        ))}
      </div>
    </div>
  );
}

export default Feed;