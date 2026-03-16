import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../supabase';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// Hooks personnalisés
const useRealtimeMessages = (activeConv, userId) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const subscriptionRef = useRef(null);

  const loadMessages = useCallback(async () => {
    if (!activeConv) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id(id, username, avatar_url),
          receiver:profiles!receiver_id(id, username, avatar_url)
        `)
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${activeConv}),and(sender_id.eq.${activeConv},receiver_id.eq.${userId})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Erreur chargement messages:', err);
    } finally {
      setLoading(false);
    }
  }, [activeConv, userId]);

  useEffect(() => {
    loadMessages();

    // Cleanup subscription précédente
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
    }

    if (activeConv) {
      subscriptionRef.current = supabase
        .channel(`messages:${userId}:${activeConv}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `or(and(sender_id.eq.${userId},receiver_id.eq.${activeConv}),and(sender_id.eq.${activeConv},receiver_id.eq.${userId}))`
          },
          (payload) => {
            setMessages(prev => {
              // Évite les doublons
              if (prev.some(m => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          }
        )
        .subscribe();
    }

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [activeConv, userId, loadMessages]);

  return { messages, setMessages, loading, refresh: loadMessages };
};

const useConversations = (userId) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState({});

  const loadConversations = useCallback(async () => {
    try {
      // Récupère les messages avec jointures optimisées
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          sender_id,
          receiver_id,
          read,
          sender:profiles!sender_id(id, username, avatar_url),
          receiver:profiles!receiver_id(id, username, avatar_url)
        `)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Groupe par conversation de manière optimisée
      const convMap = new Map();
      const unreadMap = {};

      messages?.forEach(msg => {
        const isSender = msg.sender_id === userId;
        const otherId = isSender ? msg.receiver_id : msg.sender_id;
        const otherUser = isSender ? msg.receiver : msg.sender;

        // Compte les non-lus
        if (!isSender && !msg.read) {
          unreadMap[otherId] = (unreadMap[otherId] || 0) + 1;
        }

        if (!convMap.has(otherId)) {
          convMap.set(otherId, {
            id: otherId,
            user: otherUser,
            lastMsg: {
              content: msg.content,
              created_at: msg.created_at,
              isFromMe: isSender
            },
            unread: unreadMap[otherId] || 0
          });
        }
      });

      setConversations(Array.from(convMap.values()));
      setUnreadCounts(unreadMap);
    } catch (err) {
      console.error('Erreur chargement conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadConversations();

    // Subscription pour nouvelles conversations
    const subscription = supabase
      .channel(`user_messages:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `or(sender_id.eq.${userId},receiver_id.eq.${userId})`
      }, () => {
        loadConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userId, loadConversations]);

  const markAsRead = useCallback(async (convId) => {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('sender_id', convId)
      .eq('receiver_id', userId)
      .eq('read', false);

    setUnreadCounts(prev => ({ ...prev, [convId]: 0 }));
    setConversations(prev => 
      prev.map(c => c.id === convId ? { ...c, unread: 0 } : c)
    );
  }, [userId]);

  return { conversations, loading, unreadCounts, refresh: loadConversations, markAsRead };
};

// Composants enfants
const ConversationItem = React.memo(({ conv, isActive, onClick, unread }) => {
  const timeAgo = useMemo(() => 
    formatDistanceToNow(new Date(conv.lastMsg.created_at), { 
      addSuffix: true, 
      locale: fr 
    }),
    [conv.lastMsg.created_at]
  );

  return (
    <div
      className={`conv-item ${isActive ? 'active' : ''} ${unread > 0 ? 'unread' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="conv-avatar">
        {conv.user?.username?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="conv-info">
        <div className="conv-name">
          {conv.user?.username || 'Utilisateur inconnu'}
          {unread > 0 && <span className="unread-badge">{unread}</span>}
        </div>
        <div className="conv-last">
          {conv.lastMsg.isFromMe && <span className="you-prefix">Vous: </span>}
          {conv.lastMsg.content?.substring(0, 35)}
          {conv.lastMsg.content?.length > 35 && '...'}
        </div>
      </div>
      <div className="conv-time">{timeAgo}</div>
    </div>
  );
});

const MessageBubble = React.memo(({ msg, isMine }) => {
  const time = useMemo(() => 
    new Date(msg.created_at).toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    [msg.created_at]
  );

  return (
    <div className={`message-bubble ${isMine ? 'sent' : 'received'}`}>
      <div className="message-content">{msg.content}</div>
      <div className="message-meta">
        <span className="message-time">{time}</span>
        {isMine && (
          <span className="message-status">
            {msg.read ? '✓✓' : '✓'}
          </span>
        )}
      </div>
    </div>
  );
});

const EmptyState = ({ icon, title, subtitle }) => (
  <div className="empty-state">
    <div className="empty-state-icon">{icon}</div>
    <h3>{title}</h3>
    <p>{subtitle}</p>
  </div>
);

const SkeletonLoader = ({ count = 5 }) => (
  <div className="skeleton-list">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skeleton-item">
        <div className="skeleton-avatar" />
        <div className="skeleton-lines">
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      </div>
    ))}
  </div>
);

// Composant principal
function Messages({ user }) {
  const [activeConv, setActiveConv] = useState(null);
  const [newMsg, setNewMsg] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { 
    conversations, 
    loading: convsLoading, 
    unreadCounts,
    markAsRead 
  } = useConversations(user.id);

  const { 
    messages, 
    loading: msgsLoading, 
    refresh: refreshMessages 
  } = useRealtimeMessages(activeConv, user.id);

  // Scroll automatique
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input quand conversation change
  useEffect(() => {
    if (activeConv) {
      inputRef.current?.focus();
      markAsRead(activeConv);
    }
  }, [activeConv, markAsRead]);

  const handleSelectConv = useCallback((convId) => {
    setActiveConv(convId);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!newMsg.trim() || !activeConv || isSending) return;

    setIsSending(true);
    const content = newMsg.trim();
    
    try {
      // Optimistic update
      const tempId = Date.now();
      const optimisticMsg = {
        id: tempId,
        content,
        sender_id: user.id,
        receiver_id: activeConv,
        created_at: new Date().toISOString(),
        read: false
      };
      
      // Pas besoin d'ajouter manuellement grâce à la subscription temps réel
      setNewMsg('');

      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: activeConv,
        content
      });

      if (error) throw error;

      // Notification
      await supabase.from('notifications').insert({
        user_id: activeConv,
        from_id: user.id,
        type: 'message',
        message: 'vous a envoyé un message',
        read: false,
        created_at: new Date().toISOString()
      });

    } catch (err) {
      console.error('Erreur envoi message:', err);
      // Rollback si besoin
    } finally {
      setIsSending(false);
    }
  }, [newMsg, activeConv, isSending, user.id]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(c => 
      c.user?.username?.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const activeConvData = useMemo(() => 
    conversations.find(c => c.id === activeConv),
    [conversations, activeConv]
  );

  return (
    <div className="messages-container">
      {/* Liste des conversations */}
      <div className="conversations-panel">
        <div className="conversations-header">
          <h2>💬 Messages</h2>
          <div className="search-box">
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="conversations-list">
          {convsLoading ? (
            <SkeletonLoader />
          ) : filteredConversations.length === 0 ? (
            <EmptyState
              icon="💭"
              title={searchQuery ? "Aucun résultat" : "Aucune conversation"}
              subtitle={searchQuery 
                ? "Essayez une autre recherche" 
                : "Recherchez un utilisateur pour commencer à discuter !"
              }
            />
          ) : (
            filteredConversations.map(conv => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={activeConv === conv.id}
                onClick={() => handleSelectConv(conv.id)}
                unread={unreadCounts[conv.id] || 0}
              />
            ))
          )}
        </div>
      </div>

      {/* Zone de chat */}
      <div className="chat-area">
        {!activeConv ? (
          <EmptyState
            icon="👋"
            title="Bienvenue dans vos messages"
            subtitle="Sélectionnez une conversation pour commencer à discuter"
          />
        ) : (
          <>
            <div className="chat-header">
              <button 
                className="back-btn mobile-only"
                onClick={() => setActiveConv(null)}
                aria-label="Retour"
              >
                ←
              </button>
              <div className="conv-avatar">
                {activeConvData?.user?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="chat-header-info">
                <div className="chat-header-name">
                  {activeConvData?.user?.username || 'Utilisateur'}
                </div>
                <div className="chat-header-status">
                  {activeConvData?.user?.online ? 'En ligne' : 'Hors ligne'}
                </div>
              </div>
              <div className="chat-actions">
                <button className="icon-btn" title="Appel vocal">📞</button>
                <button className="icon-btn" title="Plus d'options">⋮</button>
              </div>
            </div>

            <div className="messages-list">
              {msgsLoading ? (
                <div className="messages-loading">
                  <div className="spinner" />
                </div>
              ) : messages.length === 0 ? (
                <EmptyState
                  icon="✨"
                  title="Nouvelle conversation"
                  subtitle="Envoyez votre premier message !"
                />
              ) : (
                messages.map((msg, idx) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMine={msg.sender_id === user.id}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              <button className="attach-btn" title="Joindre un fichier">📎</button>
              <div className="input-wrapper">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Écrivez un message..."
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isSending}
                  maxLength={2000}
                />
                <span className="char-count">{newMsg.length}/2000</span>
              </div>
              <button 
                onClick={handleSendMessage}
                disabled={!newMsg.trim() || isSending}
                className={`send-btn ${isSending ? 'sending' : ''}`}
                aria-label="Envoyer"
              >
                {isSending ? '⏳' : '➤'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default React.memo(Messages);