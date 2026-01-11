import React, { useEffect, useState } from 'react';
import { Play, Pause, ShoppingCart, Heart, Disc, MessageSquare } from 'lucide-react';
import usePlayerStore from '../../stores/usePlayerStore';
import { supabase } from '../../lib/supabase';
import useAuthStore from '../../stores/useAuthStore';
import { formatPrice } from '../../lib/formatPrice';
import { Link } from 'react-router-dom';

const BeatCard = ({ beat, beatList = [] }) => {
    const { currentTrack, isPlaying, playTrack, pause, resume, refreshTrigger, triggerRefresh } = usePlayerStore();
    const { user } = useAuthStore();
    const [likesCount, setLikesCount] = useState(0);
    const [playsCount, setPlaysCount] = useState(beat.plays_count || 0);
    const [isLiked, setIsLiked] = useState(false);
    const [isOwned, setIsOwned] = useState(false);  // True if user has purchased this beat
    const [isSoldOut, setIsSoldOut] = useState(false);  // True if license_type='Exclusive' exists
    const [producerUsername, setProducerUsername] = useState(null);

    // Update local state if prop changes
    useEffect(() => {
        setPlaysCount(beat.plays_count || 0);
    }, [beat.plays_count]);

    const isCurrent = currentTrack?.id === beat.id;
    const isActive = isCurrent && isPlaying;

    useEffect(() => {
        // Fetch specific accurate count and user like status
        if (!beat.id) return;

        const fetchData = async () => {
            try {
                const { count } = await supabase
                    .from('favorites')
                    .select('*', { count: 'exact', head: true })
                    .eq('beat_id', beat.id);
                setLikesCount(count || 0);

                if (user) {
                    const { data } = await supabase
                        .from('favorites')
                        .select('*')
                        .eq('beat_id', beat.id)
                        .eq('user_id', user.id)
                        .single();
                    setIsLiked(!!data);

                    // Check if user already owns this beat
                    const { data: ownedData } = await supabase
                        .from('purchases')
                        .select('id')
                        .eq('beat_id', beat.id)
                        .eq('user_id', user.id)
                        .single();
                    setIsOwned(!!ownedData);
                }

                // Check if beat is sold as Exclusive (globally sold out)
                const { data: exclusiveSale } = await supabase
                    .from('purchases')
                    .select('id')
                    .eq('beat_id', beat.id)
                    .eq('license_type', 'Exclusive')
                    .single();
                setIsSoldOut(!!exclusiveSale);

                // Fetch producer username
                if (beat.producer_id) {
                    const { data: producerData } = await supabase
                        .from('profiles')
                        .select('username')
                        .eq('id', beat.producer_id)
                        .single();
                    if (producerData) {
                        setProducerUsername(producerData.username);
                    }
                }
            } catch (err) {
                // Ignore single() errors for no rows
            }
        };
        fetchData();

        // Realtime Subscription (kept for external updates)
        const channel = supabase
            .channel(`favorites-sync:${beat.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'favorites',
                filter: `beat_id=eq.${beat.id}`
            }, () => {
                fetchData();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'beats',
                filter: `id=eq.${beat.id}`
            }, (payload) => {
                setPlaysCount(payload.new.plays_count);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [beat.id, user, refreshTrigger]); // Added refreshTrigger to dependency array for global sync

    const handlePlayToggle = (e) => {
        e.preventDefault();
        e.stopPropagation(); // Stop propagation
        if (isCurrent) {
            isActive ? pause() : resume();
        } else {
            playTrack(beat, beatList);
            // RPC for incrementing
            supabase.rpc('increment_plays', { beat_row_id: beat.id }).then(({ error }) => {
                if (error) console.error("Increment error", error);
            });
        }
    };

    const addToCart = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) return alert('Please login to add to cart');
        if (beat.producer_id === user.id) return alert("You cannot buy your own beat.");

        const { error } = await supabase.from('cart_items').insert({
            user_id: user.id,
            beat_id: beat.id,
            price: beat.price,
            currency: beat.currency || 'USD'
        });
        if (error) alert('Error: ' + error.message);
        else alert('Added to cart!');
    };

    const toggleLike = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) return alert("Login to like.");

        // Optimistic Update for instant feedback on the clicking component
        const previousState = isLiked;
        const previousCount = likesCount;

        setIsLiked(!isLiked);
        setLikesCount(prev => isLiked ? Math.max(0, prev - 1) : prev + 1);

        try {
            if (previousState) {
                const { error } = await supabase.from('favorites').delete().match({ user_id: user.id, beat_id: beat.id });
                if (error) throw error;
                triggerRefresh(); // Sync all other cards
            } else {
                const { error } = await supabase.from('favorites').insert({ user_id: user.id, beat_id: beat.id });
                if (error) {
                    if (!error.message.includes('duplicate key')) throw error;
                }
                triggerRefresh(); // Sync all other cards
            }
        } catch (err) {
            console.error(err);
            // Revert on error
            setIsLiked(previousState);
            setLikesCount(previousCount);
        }
    };

    // Fix return statement syntax if it was flagged (looks okay but resetting)
    return (
        <div className="group relative bg-surface border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all duration-300 hover:-translate-y-1">
            {/* Cover Art Wrapper */}
            <div className="aspect-square relative overflow-hidden bg-neutral-800">
                <img
                    src={beat.cover_url || '/placeholder-cover.jpg'}
                    alt={beat.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Overlay & Play Button - Always show for owners OR on hover */}
                <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${isSoldOut && !isOwned ? 'z-0' : 'z-20'}`}>
                    <button
                        onClick={handlePlayToggle}
                        className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform duration-300 shadow-xl shadow-red-900/50"
                    >
                        {isActive ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" className="ml-1" />}
                    </button>
                </div>

                {/* SOLD OUT Badge Overlay - Only blocks non-owners */}
                {isSoldOut && !isOwned && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                        <div className="sold-out-badge bg-red-600 px-4 py-2 rounded-lg text-lg font-bold uppercase tracking-wider transform -rotate-12 shadow-xl">
                            SOLD OUT
                        </div>
                    </div>
                )}

                {/* Owned badge for sold out beats */}
                {isSoldOut && isOwned && (
                    <div className="absolute top-2 right-2 bg-green-600 px-2 py-1 rounded text-xs font-bold uppercase z-30">
                        OWNED
                    </div>
                )}

                {/* Price Tag (only if not sold out) */}
                {!isSoldOut && (
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs font-bold border border-white/10">
                        {formatPrice(beat.price, beat.currency)}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-4">
                <Link to={`/beats/${beat.id}`}>
                    <h3 className="font-bold text-white truncate hover:text-primary transition-colors">{beat.title}</h3>
                </Link>
                {producerUsername && (
                    <Link
                        to={`/profile/${beat.producer_id}`}
                        className="text-sm text-primary hover:text-red-400 transition-colors truncate block"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {producerUsername}
                    </Link>
                )}
                <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-neutral-400 truncate flex items-center gap-2">
                        {beat.bpm} BPM <span className="w-1 h-1 bg-neutral-600 rounded-full" /> {beat.key}
                    </p>
                </div>

                {/* Public Stats Bar */}
                <div className="flex items-center gap-4 mt-3 pb-3 border-b border-white/5 text-xs text-neutral-500 font-medium">
                    <span className="flex items-center gap-1.5" title="Total Plays">
                        <Disc size={14} className="text-neutral-400" /> {playsCount}
                    </span>
                    <span className="flex items-center gap-1.5" title="Total Likes">
                        <Heart size={14} className="text-neutral-400" /> {likesCount}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mt-3 text-xs">
                    <Link to={`/beats/${beat.id}`} className="text-neutral-500 hover:text-white transition-colors">
                        View Details
                    </Link>
                    <div className="flex gap-2">
                        <button onClick={toggleLike} className={`p-2 hover:bg-white/10 rounded-full transition-colors ${isLiked ? 'text-red-500' : 'text-neutral-400 hover:text-red-500'}`}>
                            <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
                        </button>
                        {isSoldOut ? (
                            <Link
                                to={`/chat/u/${beat.producer_id}`}
                                className="p-2 hover:bg-white/10 rounded-full text-primary hover:text-red-400 transition-colors"
                                title="Contact Artist"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <MessageSquare size={18} />
                            </Link>
                        ) : isOwned ? (
                            <span className="p-2 text-green-500" title="Already Owned">
                                <ShoppingCart size={18} />
                            </span>
                        ) : (
                            <button
                                onClick={addToCart}
                                className="p-2 hover:bg-white/10 rounded-full text-neutral-400 hover:text-primary transition-colors"
                            >
                                <ShoppingCart size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BeatCard;
