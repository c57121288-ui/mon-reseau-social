import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

function Post({ post, user }) {
  const [likes, setLikes] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);

  const hasLiked = likes.some(l => l.user_id === user.id);

  // Charge les likes
  useEffect(() => {
    supabase.from('likes').select('*').eq('post_id', post.id)
      .then(({ data }) => setLikes(data || []));
  }, [post.id]);

  // Charge les commentaires si affichés
  useEffect(() => {
    if (!showComments) return;
    supabase.from('comments').select('*').eq('post_id', post.id).order('created_at')
      .then(({ data }) => setComments(data || []));
  }, [showComments, post.id]);

  const handleLike = async () => {
    if (hasLiked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id);
      setLikes(likes.filter(l => l.user_id !== user.id));
    } else {
      const { data } = await supabase.from('likes').insert({ post_id: post.id, user_id: user.id }).select();
      setLikes([...likes, ...(data || [])]);
    }
  };

  const handleComment = async () => {
    if (!newComment.trim()) return;
    const { data } = await supabase.from('comments').insert({
      post_id: post.id,
      content: newComment,
      author_name: user.email
    }).select();
    setComments([...comments, ...(data || [])]);
    setNewComment('');
  };

  return (
    <div className="post-card">
      <div className="post-header">
        <div className="avatar">{post.author_name?.[0]?.toUpperCase()}</div>
        <div>
          <strong>{post.author_name}</strong>
          <p className="post-date">
            {new Date(post.created_at).toLocaleDateString('fr-FR')}
          </p>
        </div>
      </div>

      <p className="post-content">{post.content}</p>

      <div className="post-actions">
        <button onClick={handleLike} className={hasLiked ? 'liked' : ''}>
          {hasLiked ? '❤️' : '🤍'} {likes.length} J'aime
        </button>
        <button onClick={() => setShowComments(!showComments)}>
          💬 {showComments ? 'Masquer' : 'Commenter'}
        </button>
      </div>

      {showComments && (
        <div className="comments-section">
          {comments.map(c => (
            <div key={c.id} className="comment">
              <strong>{c.author_name}</strong> : {c.content}
            </div>
          ))}
          <div className="comment-input">
            <input
              type="text"
              placeholder="Écrire un commentaire..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button onClick={handleComment}>Envoyer</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Post;