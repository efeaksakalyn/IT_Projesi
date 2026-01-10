import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import useAuthStore from '../../stores/useAuthStore';
import { Loader2, MessageSquare, ArrowLeft, Plus } from 'lucide-react';

const Inbox = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        const fetchConversations = async () => {
            setLoading(true);
            try {
                // Get all conversations where I am participant_1 or participant_2
                const { data: myConvos, error: convError } = await supabase
                    .from('conversations')
                    .select('id, participant_1, participant_2, last_message, updated_at')
                    .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
                    .order('updated_at', { ascending: false });

                if (convError || !myConvos || myConvos.length === 0) {
                    setConversations([]);
                    return;
                }

                // For each conversation, get the other participant's profile
                const conversationsWithDetails = await Promise.all(
                    myConvos.map(async (convo) => {
                        // Determine who the other user is
                        const otherUserId = convo.participant_1 === user.id ? convo.participant_2 : convo.participant_1;

                        // Get other user's profile
                        const { data: otherProfile } = await supabase
                            .from('profiles')
                            .select('id, username, avatar_url')
                            .eq('id', otherUserId)
                            .single();

                        // Get last message (using 'text' column)
                        const { data: lastMsg } = await supabase
                            .from('messages')
                            .select('text, created_at, sender_id')
                            .eq('conversation_id', convo.id)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        return {
                            id: convo.id,
                            otherUser: otherProfile,
                            lastMessage: lastMsg?.text || convo.last_message || 'No messages yet',
                            lastMessageTime: lastMsg?.created_at || convo.updated_at,
                            isMyMessage: lastMsg?.sender_id === user.id
                        };
                    })
                );

                // DEDUPLICATE: Filter to only show unique conversations by other user ID
                const uniqueConversations = [];
                const seenUserIds = new Set();

                conversationsWithDetails.forEach(conv => {
                    const otherId = conv.otherUser?.id;
                    if (otherId && !seenUserIds.has(otherId)) {
                        seenUserIds.add(otherId);
                        uniqueConversations.push(conv);
                    } else if (!otherId) {
                        uniqueConversations.push(conv); // Keep convos without user data
                    }
                });

                // Sort by last message time
                uniqueConversations.sort((a, b) => {
                    if (!a.lastMessageTime) return 1;
                    if (!b.lastMessageTime) return -1;
                    return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
                });

                console.log('[Inbox] Unique conversations:', uniqueConversations.length);
                setConversations(uniqueConversations);
            } catch (err) {
                console.error("Inbox fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();

        // Focus listener for wake-up
        const handleFocus = () => fetchConversations();
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [user, navigate]);

    if (loading) return <div className="pt-24 flex justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;

    return (
        <div className="pt-24 pb-24 container mx-auto px-6 max-w-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 bg-neutral-800 rounded-full hover:bg-neutral-700 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-2xl font-heading font-black flex items-center gap-2">
                        <MessageSquare className="text-primary" /> Messages
                    </h1>
                </div>
            </div>

            {/* Conversation List */}
            {conversations.length === 0 ? (
                <div className="text-center py-20 text-neutral-500">
                    <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No conversations yet.</p>
                    <p className="text-sm mt-2">Start chatting by clicking 'Message' on a producer's profile!</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {conversations.map((conv) => (
                        <Link
                            key={conv.id}
                            to={`/chat/${conv.id}`}
                            className="flex items-center gap-4 p-4 bg-surface border border-white/10 rounded-xl hover:border-primary/50 transition-all group"
                        >
                            <div className="w-12 h-12 rounded-full bg-neutral-700 overflow-hidden flex-shrink-0">
                                <img
                                    src={conv.otherUser?.avatar_url || `https://ui-avatars.com/api/?name=${conv.otherUser?.username || 'User'}`}
                                    alt=""
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold group-hover:text-primary transition-colors">
                                        {conv.otherUser?.username || 'Unknown User'}
                                    </span>
                                    {conv.lastMessageTime && (
                                        <span className="text-xs text-neutral-500">
                                            {new Date(conv.lastMessageTime).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-neutral-400 truncate mt-1">
                                    {conv.isMyMessage && <span className="text-primary">You: </span>}
                                    {conv.lastMessage}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Inbox;
