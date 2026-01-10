import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import useAuthStore from '../../stores/useAuthStore';
import { Loader2 } from 'lucide-react';

/**
 * ChatResolver - Find or Create Conversation (DEBUG MODE)
 * Schema: fix6.sql with UNIQUE INDEX on (LEAST, GREATEST) participant pair
 */
const ChatResolver = () => {
    const { userId: targetId } = useParams();
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [status, setStatus] = useState('Initializing...');

    useEffect(() => {
        const findOrCreateConversation = async () => {
            // Validation
            if (!user) {
                console.log('[ChatResolver] No user, redirecting to login');
                navigate('/login');
                return;
            }
            if (!targetId) {
                console.log('[ChatResolver] No target ID, redirecting to inbox');
                navigate('/inbox');
                return;
            }

            const meId = user.id;

            if (meId === targetId) {
                console.log('[ChatResolver] Cannot message self');
                alert("You cannot message yourself.");
                navigate('/inbox');
                return;
            }

            console.log('[ChatResolver] =============================');
            console.log('[ChatResolver] Searching for conversation...');
            console.log('[ChatResolver] My ID:', meId);
            console.log('[ChatResolver] Target ID:', targetId);

            try {
                setStatus('Searching for existing conversation...');

                // STRICT QUERY: Use .or() filter for both participant arrangements
                const orFilter = `and(participant_1.eq.${meId},participant_2.eq.${targetId}),and(participant_1.eq.${targetId},participant_2.eq.${meId})`;
                console.log('[ChatResolver] OR Filter:', orFilter);

                const { data: existingConvo, error: searchError } = await supabase
                    .from('conversations')
                    .select('id')
                    .or(orFilter)
                    .maybeSingle();

                console.log('[ChatResolver] Search result:', existingConvo);
                console.log('[ChatResolver] Search error:', searchError);

                // If found, navigate to existing conversation
                if (existingConvo && existingConvo.id) {
                    console.log('[ChatResolver] ✅ FOUND existing conversation:', existingConvo.id);
                    navigate(`/chat/${existingConvo.id}`, { replace: true });
                    return;
                }

                // No existing conversation - attempt to create
                console.log('[ChatResolver] No existing conversation found, creating new one...');
                setStatus('Creating new conversation...');

                const { data: newConvo, error: createError } = await supabase
                    .from('conversations')
                    .insert({
                        participant_1: meId,
                        participant_2: targetId
                    })
                    .select('id')
                    .single();

                // Handle unique constraint violation (duplicate)
                if (createError) {
                    console.log('[ChatResolver] ⚠️ Insert error:', createError.message);

                    // FALLBACK: If insert fails (unique constraint), re-query for existing
                    if (createError.code === '23505' || createError.message.includes('unique') || createError.message.includes('duplicate')) {
                        console.log('[ChatResolver] Unique constraint hit, performing fallback query...');
                        setStatus('Finding existing conversation...');

                        const { data: fallbackConvo } = await supabase
                            .from('conversations')
                            .select('id')
                            .or(orFilter)
                            .single();

                        if (fallbackConvo && fallbackConvo.id) {
                            console.log('[ChatResolver] ✅ FALLBACK found:', fallbackConvo.id);
                            navigate(`/chat/${fallbackConvo.id}`, { replace: true });
                            return;
                        }
                    }

                    // Other error
                    console.error('[ChatResolver] ❌ Failed to create conversation:', createError);
                    alert('Failed to start conversation. Please try again.');
                    navigate('/inbox');
                    return;
                }

                // Successfully created new conversation
                console.log('[ChatResolver] ✅ CREATED new conversation:', newConvo.id);
                navigate(`/chat/${newConvo.id}`, { replace: true });

            } catch (error) {
                console.error('[ChatResolver] ❌ Unexpected error:', error);
                navigate('/inbox');
            }
        };

        findOrCreateConversation();
    }, [user, targetId, navigate]);

    return (
        <div className="h-screen flex items-center justify-center bg-black">
            <div className="text-center">
                <Loader2 className="animate-spin mb-4 mx-auto text-primary" size={40} />
                <p className="text-neutral-400">{status}</p>
                <p className="text-xs text-neutral-600 mt-2">Check console (F12) for debug logs</p>
            </div>
        </div>
    );
};

export default ChatResolver;
