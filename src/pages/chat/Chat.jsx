import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import useAuthStore from '../../stores/useAuthStore';
import { Send, Loader2, ArrowLeft } from 'lucide-react';

const Chat = () => {
    const { id } = useParams(); // conversation_id
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const [participants, setParticipants] = useState([]);

    // Logic: verify that the user is actually a participant of this conversation
    // or if the id is valid. If not, maybe redirect to inbox.

    useEffect(() => {
        if (!id || !user) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Validate Access & Fetch Participants
                const { data: parts, error: partError } = await supabase
                    .from('conversation_participants')
                    .select('user:profiles(id, username, avatar_url)')
                    .eq('conversation_id', id);

                if (partError || !parts || parts.length === 0) {
                    console.error("Error fetching participants or invalid conversation", partError);
                    navigate('/inbox');
                    return;
                }

                // Check if I am in it
                const amIParticipant = parts.some(p => p.user.id === user.id);
                if (!amIParticipant) {
                    alert("You are not part of this conversation.");
                    navigate('/inbox');
                    return;
                }

                const others = parts.map(p => p.user).filter(u => u.id !== user.id);
                setParticipants(others);

                // 2. Fetch Messages
                const { data: msgs, error: msgError } = await supabase
                    .from('messages')
                    .select('*, sender:profiles(username, avatar_url)')
                    .eq('conversation_id', id)
                    .order('created_at', { ascending: true });

                if (msgError) console.error(msgError);
                setMessages(msgs || []);
                scrollToBottom();
            } catch (error) {
                console.error("Chat load error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // 3. Realtime
        const channel = supabase
            .channel(`chat:${id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${id}`
            }, async (payload) => {
                const newMsg = payload.new;

                // If it's my message, I might have it already if I optimistic update (not doing that yet for simplicity)
                // but let's fetch sender to be sure
                let sender = null;
                // Optimization: check if sender is me or one of participants
                if (newMsg.sender_id === user.id) {
                    // It's me
                    // sender = ... construct me
                } else {
                    // It's other
                }

                const { data: senderData } = await supabase
                    .from('profiles')
                    .select('username, avatar_url')
                    .eq('id', newMsg.sender_id)
                    .single();

                const msgWithSender = { ...newMsg, sender: senderData };
                setMessages(prev => {
                    // Dedupe
                    if (prev.find(m => m.id === newMsg.id)) return prev;
                    return [...prev, msgWithSender];
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id, user, navigate]);

    // Wake up listener
    useEffect(() => {
        const handleFocus = () => {
            // Re-fetch messages if needed, or rely on realtime. 
            // Simplest is to force a re-mount or re-fetch.
            // We can just call scrollToBottom to be safe or re-verify.
            // Ideally we refetch the last few messages.
        };
        // For Chat, Realtime handles most. But let's add it for safety if connection drops.
        window.addEventListener('focus', () => {
            // We could trigger a re-fetch here if we extracted fetchData
        });
        return () => window.removeEventListener('focus', () => { });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        const content = newMessage.trim();
        if (!content || !user) return;

        // Clear immediately
        setNewMessage('');

        // Insert
        const { error } = await supabase.from('messages').insert({
            conversation_id: id,
            sender_id: user.id,
            content: content
        });

        if (error) {
            console.error("Error sending message:", error);
            // Ideally restore message to input or show toast
            alert("Failed to send message: " + error.message);
        }
    };

    if (loading) return <div className="pt-24 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    const chatPartner = participants[0];

    return (
        <div className="pt-20 h-screen flex flex-col container mx-auto px-4 md:px-6 max-w-4xl pb-4">

            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
                <Link to="/inbox" className="p-2 bg-neutral-800 rounded-full hover:bg-neutral-700 transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                {chatPartner ? (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-700">
                            <img src={chatPartner.avatar_url || `https://ui-avatars.com/api/?name=${chatPartner.username}`} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg leading-none">{chatPartner.username}</h2>
                            <span className="text-xs text-neutral-400">Online</span>
                        </div>
                    </div>
                ) : (
                    <div className="font-bold">Chat</div>
                )}
            </div>

            <div className="flex-1 bg-surface border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-dots">
                    {messages.map((msg, index) => {
                        const isMe = msg.sender_id === user?.id;
                        return (
                            <div key={msg.id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-5 py-3 shadow-md text-sm md:text-base ${isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-neutral-800 text-neutral-200 rounded-tl-none'}`}>
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                    <span className={`text-[10px] block text-right mt-1 opacity-70 ${isMe ? 'text-red-100' : 'text-neutral-400'}`}>
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-white/10 bg-neutral-900/80 backdrop-blur">
                    <form onSubmit={sendMessage} className="flex gap-3 items-center">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 bg-black/40 border border-neutral-700 rounded-full px-5 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-neutral-500"
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim()}
                            className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/25"
                        >
                            <Send size={20} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Chat;
