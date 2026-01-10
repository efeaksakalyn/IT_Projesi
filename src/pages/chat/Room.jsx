import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import useAuthStore from '../../stores/useAuthStore';
import { Send, Loader2 } from 'lucide-react';

const Room = () => {
    const { id } = useParams(); // conversation_id
    const { user } = useAuthStore();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const [sub, setSub] = useState(null);

    useEffect(() => {
        if (!id) return;

        // Fetch initial messages
        const fetchMessages = async () => {
            setLoading(true);
            const { data } = await supabase
                .from('messages')
                .select('*, sender:profiles(username, avatar_url)')
                .eq('conversation_id', id)
                .order('created_at', { ascending: true });

            setMessages(data || []);
            setLoading(false);
            scrollToBottom();
        };

        fetchMessages();

        // Real-time subscription
        const channel = supabase
            .channel(`chat:${id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${id}`
            }, async (payload) => {
                // Fetch the sender profile for the new message to display it correctly
                // Or just push payload.new if we don't need profile immediately (or if sender_id matches user.id we know who it is)
                const newMsg = payload.new;

                // If it's me, I might have optimistically added it?
                // For now, let's just fetch the sender info to be consistent
                const { data: senderData } = await supabase
                    .from('profiles')
                    .select('username, avatar_url')
                    .eq('id', newMsg.sender_id)
                    .single();

                const msgWithSender = { ...newMsg, sender: senderData };
                setMessages(prev => {
                    // Deduplicate just in case
                    if (prev.find(m => m.id === newMsg.id)) return prev;
                    return [...prev, msgWithSender];
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !user) return;

        const content = newMessage.trim();
        setNewMessage(''); // Optimistic clear

        // Safety: ensure sender_id is auth.uid()
        const { error } = await supabase.from('messages').insert({
            conversation_id: id,
            sender_id: user.id,
            content: content
        });

        if (error) {
            console.error("Error sending message:", error);
            alert("Failed to send message.");
        }
        // No need to manually add to state, subscription handles it
    };

    if (loading) return <div className="pt-24 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="pt-24 h-screen flex flex-col container mx-auto px-6 max-w-4xl pb-4">
            {/* Header with other user? We can fetch conversation details if we want */}

            <div className="flex-1 bg-surface border border-white/5 rounded-xl overflow-hidden flex flex-col shadow-2xl">
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-dots">
                    {messages.map((msg, index) => {
                        const isMe = msg.sender_id === user?.id;
                        return (
                            <div key={msg.id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-md ${isMe ? 'bg-primary text-white' : 'bg-neutral-800 text-neutral-200'}`}>
                                    <p className="text-sm md:text-base leading-relaxed">{msg.content}</p>
                                    <span className="text-[10px] opacity-70 block text-right mt-1 pt-1 border-t border-white/10">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-white/10 bg-neutral-900/50 backdrop-blur-md">
                    <form onSubmit={sendMessage} className="flex gap-3 items-center">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 bg-black/50 border border-neutral-700 rounded-full px-5 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
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

export default Room;
