import React, { useState } from 'react';
import { supabase } from '../supabase';

function CreatePost({ user, username }) {
  const [content, setContent] = useState('');

  const handlePost = async () => {
    if (!content.trim()) return;
    await supabase.from('posts').insert({
      content: content,
      author_id: user.id,
      author_name: username || user.email
    });
    setContent('');
  };

  return (
    <div className="create-post">
      <textarea
        placeholder="Quoi de neuf ?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
      />
      <button onClick={handlePost}>Publier</button>
    </div>
  );
}

export default CreatePost;