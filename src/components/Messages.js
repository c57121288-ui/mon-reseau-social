import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

function Messages({ user }) {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [username, setUsername] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Récupère le username
    supabase.from('profiles').select('username').eq('id', user.id).single()
      .then(({ data }) => { if (data) setUsername(data.username); });

    loadConversations();
  }, [user.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(username), receiver:profiles!receiver_id(username)')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    // Groupe par conversation
    const convMap = {};
    (data || []).forEach(msg => {
      const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      const otherName = msg.sender_id === user.id ? msg.receiver?.username : msg.sender?.username;
      if (!convMap[otherId]) {
        convMap[otherId] = { id: otherId, name: otherName, lastMsg: msg.content };
      }
    });
    setConversations(Object.values(convMap));
  };

  const loadMessages = async (otherId) => {
    setActiveConv(otherId);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
      .order('created_at');
    setMessages(data || []);

    // Écoute en temps réel
    supabase.channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeConv) return;
    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: activeConv,
      content: newMsg
    });

    // Notification
    await supabase.from('notifications').insert({
      user_id: activeConv,
      from_id: user.id,
      type: 'message',
      message: 'vous a envoyé un message'
    });

    setNewMsg('');
  };

  const activeConvData = conversations.find(c => c.id === activeConv);

  return (
    <div className="messages-container">
      <div className="conversations-list">
        <div style={{padding:'16px', borderBottom:'1px solid #eee', fontWeight:700, fontSize:16}}>
          💬 Messages
        </div>
        {conversations.length === 0 && (
          <p style={{padding:'20px', color:'#888', fontSize:14}}>
            Aucune conversation. Recherche un utilisateur pour commencer !
          </p>
        )}
        {conversations.map(conv => (
          <div
            key={conv.id}
            className={`conv-item ${activeConv === conv.id ? 'active' : ''}`}
            onClick={() => loadMessages(conv.id)}
          >
            <div className="avatar" style={{width:40, height:40, fontSize:16}}>
              {conv.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="conv-name">{conv.name}</div>
              <div className="conv-last">{conv.lastMsg?.substring(0, 30)}...</div>
            </div>
          </div>
        ))}
      </div>

      <div className="chat-area">
        {!activeConv ? (
          <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#888'}}>
            Sélectionne une conversation
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="avatar" style={{width:36, height:36, fontSize:14}}>
                {activeConvData?.name?.[0]?.toUpperCase()}
              </div>
              {activeConvData?.name}
            </div>
            <div className="messages-list">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`message-bubble ${msg.sender_id === user.id ? 'sent' : 'received'}`}
                >
                  {msg.content}
                </div>
              ))}
              <div ref={messagesEndRef}/>
            </div>
            <div className="chat-input">
              <input
                type="text"
                placeholder="Écrire un message..."
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && sendMessage()}
              />
              <button onClick={sendMessage}>➤</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Messages;