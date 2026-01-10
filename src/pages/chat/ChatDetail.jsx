import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import useAuthStore from '../../stores/useAuthStore';
import { Send, Loader2, ArrowLeft, User } from 'lucide-react';

/**
 * ChatDetail - Full Chat Implementation with Realtime
 * Schema: fix6.sql (participant_1, participant_2, messages.text)
 * 
 * Features:
 * - Fetches messages from messages table ordered by created_at ASC
 * - Real-time subscription via supabase.channel() for instant updates
 * - Message insert via supabase.from('messages').insert()
 */
const ChatDetail = () => {
    const { id: conversationId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const [chatPartner, setChatPartner] = useState(null);

    useEffect(() => {
        if (!conversationId || !user) {
            navigate('/inbox');
            return;
        }

        // Fetch conversation data and messages
        const fetchChatData = async () => {
            setLoading(true);
            try {
                // 1. Get conversation and validate access
                const { data: convo, error: convoError } = await supabase
                    .from('conversations')
                    .select('id, participant_1, participant_2')
                    .eq('id', conversationId)
                    .single();

                if (convoError || !convo) {
                    console.error("Conversation not found:", convoError);
                    navigate('/inbox');
                    return;
                }

                // Validate I am a participant
                const isParticipant = convo.participant_1 === user.id || convo.participant_2 === user.id;
                if (!isParticipant) {
                    alert("Access denied: You are not part of this conversation.");
                    navigate('/inbox');
                    return;
                }

                // 2. Get chat partner's profile
                const partnerId = convo.participant_1 === user.id ? convo.participant_2 : convo.participant_1;
                const { data: partnerData } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .eq('id', partnerId)
                    .single();

                setChatPartner(partnerData);

                // 3. Fetch all messages for this conversation (ordered by created_at ASC)
                const { data: msgData, error: msgError } = await supabase
                    .from('messages')
                    .select('id, conversation_id, sender_id, text, created_at')
                    .eq('conversation_id', conversationId)
                    .order('created_at', { ascending: true });

                if (msgError) {
                    console.error("Failed to fetch messages:", msgError);
                }
                setMessages(msgData || []);

            } catch (err) {
                console.error("Chat load error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchChatData();

        /**
         * REALTIME SUBSCRIPTION
         * Listen for INSERT events on messages table for this conversation
         * Messages will appear instantly without page refresh
         */
        console.log(`[Realtime] Setting up subscription for conversation: ${conversationId}`);

        const realtimeChannel = supabase
            .channel(`messages:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    console.log('[Realtime] New message received:', payload.new);
                    const incomingMessage = payload.new;

                    setMessages(currentMessages => {
                        // Check for duplicate
                        const isDuplicate = currentMessages.some(m => m.id === incomingMessage.id);
                        if (isDuplicate) {
                            console.log('[Realtime] Duplicate blocked');
                            return currentMessages;
                        }
                        console.log('[Realtime] Adding to message list');
                        return [...currentMessages, incomingMessage];
                    });
                }
            )
            .subscribe((status) => {
                console.log(`[Realtime] Subscription status: ${status}`);
            });

        // Tab focus listener - refetch on return
        const onTabFocus = () => {
            console.log('[Focus] Tab regained focus, refetching...');
            fetchChatData();
        };
        window.addEventListener('focus', onTabFocus);

        // Cleanup
        return () => {
            console.log('[Cleanup] Removing realtime channel');
            supabase.removeChannel(realtimeChannel);
            window.removeEventListener('focus', onTabFocus);
        };
    }, [conversationId, user, navigate]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Send message handler
    const handleSendMessage = async (e) => {
        e.preventDefault();
        const messageText = newMessage.trim();
        if (!messageText || !user || sending) return;

        setSending(true);
        setNewMessage('');

        try {
            // INSERT new message into messages table (using 'text' column from fix6.sql)
            const { error: insertError } = await supabase
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: user.id,
                    text: messageText
                });

            if (insertError) {
                console.error("Message send failed:", insertError);
                alert("Failed to send message. Please try again.");
                setNewMessage(messageText); // Restore on error
            }
            // Note: Message will appear via realtime subscription
        } catch (err) {
            console.error("Send error:", err);
            setNewMessage(messageText);
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="pt-24 flex justify-center">
                <Loader2 className="animate-spin text-primary" size={40} />
            </div>
        );
    }

    return (
        <div className="pt-20 h-screen flex flex-col container mx-auto px-4 md:px-6 max-w-4xl pb-4">
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
                <button
                    onClick={() => {
                        // Use history back if possible, otherwise go to inbox
                        if (window.history.length > 2) {
                            navigate(-1);
                        } else {
                            navigate('/inbox');
                        }
                    }}
                    className="p-2 bg-neutral-800 rounded-full hover:bg-neutral-700 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                {chatPartner ? (
                    <Link to={`/profile/${chatPartner.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-700">
                            <img
                                src={chatPartner.avatar_url || `https://ui-avatars.com/api/?name=${chatPartner.username}`}
                                alt=""
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg leading-none">{chatPartner.username}</h2>
                            <span className="text-xs text-neutral-400">Click to view profile</span>
                        </div>
                    </Link>
                ) : (
                    <div className="flex items-center gap-2">
                        <User size={24} />
                        <span className="font-bold">Chat</span>
                    </div>
                )}
            </div>

            {/* Messages Container */}
            <div className="flex-1 bg-surface border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-neutral-500">
                            <p>No messages yet. Say hello! 👋</p>
                        </div>
                    ) : (
                        messages.map((msg, index) => {
                            const isMe = msg.sender_id === user?.id;
                            return (
                                <div key={msg.id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-5 py-3 shadow-md ${isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-neutral-800 text-neutral-200 rounded-tl-none'}`}>
                                        <p className="whitespace-pre-wrap">{msg.text}</p>
                                        <span className={`text-[10px] block text-right mt-1 opacity-70 ${isMe ? 'text-red-100' : 'text-neutral-400'}`}>
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-white/10 bg-neutral-900/80 backdrop-blur">
                    <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 bg-black/40 border border-neutral-700 rounded-full px-5 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-neutral-500"
                            disabled={sending}
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || sending}
                            className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/25"
                        >
                            {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChatDetail;
