import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import usePlayerStore from '../stores/usePlayerStore';
import useAuthStore from '../stores/useAuthStore';
import { formatPrice } from '../lib/formatPrice';
import { Play, Pause, Heart, ShoppingCart, MessageSquare, Share2, Clock, Music4, Loader2, Eye, EyeOff, Trash2 } from 'lucide-react';

const BeatDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { playTrack, currentTrack, isPlaying, pause, triggerRefresh, refreshTrigger } = usePlayerStore();

    const [beat, setBeat] = useState(null);
    const [producer, setProducer] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedLicense, setSelectedLicense] = useState('MP3 Lease');
    const [isOwned, setIsOwned] = useState(false);
    const [isSoldOut, setIsSoldOut] = useState(false);

    // Check if current user is the producer (owner) of this beat
    const isOwner = user && beat && beat.producer_id === user.id;

    useEffect(() => {
        const fetchBeat = async () => {
            if (!beat) setLoading(true);
            try {
                // Fetch beat
                const { data: beatData, error } = await supabase
                    .from('beats')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (beatData) {
                    setBeat(beatData);
                    // Fetch producer
                    const { data: producerData } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', beatData.producer_id)
                        .single();
                    setProducer(producerData);

                    // Fetch comments
                    fetchComments();

                    // Log view
                    if (user) {
                        supabase.from('view_logs').insert({ beat_id: id, user_id: user.id });

                        // Check if user owns this beat
                        const { data: ownedData } = await supabase
                            .from('purchases')
                            .select('id')
                            .eq('beat_id', id)
                            .eq('user_id', user.id)
                            .single();
                        setIsOwned(!!ownedData);
                    }

                    // Check if Exclusive sold
                    const { data: exclusiveSale } = await supabase
                        .from('purchases')
                        .select('id')
                        .eq('beat_id', id)
                        .eq('license_type', 'Exclusive')
                        .single();
                    setIsSoldOut(!!exclusiveSale);
                }
            } catch (err) {
                console.error("BeatDetail error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchBeat();
    }, [id]);

    const fetchComments = async () => {
        const { data } = await supabase
            .from('comments')
            .select('*, profiles(username, avatar_url)')
            .eq('beat_id', id)
            .order('created_at', { ascending: false });
        setComments(data || []);
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (!user || !newComment.trim()) return;

        await supabase.from('comments').insert({
            beat_id: id,
            user_id: user.id,
            content: newComment
        });
        setNewComment('');
        fetchComments();
    };

    const isCurrent = currentTrack?.id === beat?.id;

    // OWNER FUNCTIONS: Toggle visibility and delete beat
    const toggleVisibility = async () => {
        if (!isOwner || !beat) return;
        const newVisibility = !beat.is_visible;

        // Update local state instantly
        setBeat(prev => ({ ...prev, is_visible: newVisibility }));

        // Update database
        const { error } = await supabase
            .from('beats')
            .update({ is_visible: newVisibility })
            .eq('id', beat.id);

        if (error) {
            console.error('Toggle visibility error:', error);
            alert('Failed to update visibility. Check RLS policies.');
            setBeat(prev => ({ ...prev, is_visible: !newVisibility })); // Revert
        }
    };

    const deleteBeat = async () => {
        if (!isOwner || !beat) return;

        const confirmed = window.confirm(
            `⚠️ PERMANENTLY DELETE "${beat.title}"?\n\nThis will remove the audio file, cover art, and all data.\n\nThis action cannot be undone.`
        );
        if (!confirmed) return;

        try {
            // 1. Delete related records first (to avoid foreign key constraints)
            await supabase.from('comments').delete().eq('beat_id', beat.id);
            await supabase.from('favorites').delete().eq('beat_id', beat.id);
            await supabase.from('cart_items').delete().eq('beat_id', beat.id);
            await supabase.from('view_logs').delete().eq('beat_id', beat.id);

            // 2. Delete audio from storage (ignore errors)
            if (beat.audio_url) {
                const audioPath = beat.audio_url.split('/beat-files/')[1];
                if (audioPath) {
                    await supabase.storage.from('beat-files').remove([decodeURIComponent(audioPath)]).catch(() => { });
                }
            }

            // 3. Delete cover from storage (ignore errors)
            if (beat.cover_url) {
                const coverPath = beat.cover_url.split('/cover-arts/')[1];
                if (coverPath) {
                    await supabase.storage.from('cover-arts').remove([decodeURIComponent(coverPath)]).catch(() => { });
                }
            }

            // 4. Delete beat database record
            const { error } = await supabase.from('beats').delete().eq('id', beat.id);

            if (error) {
                console.error('Delete error:', error);
                alert('Failed to delete beat: ' + error.message);
                return;
            }

            alert('Beat deleted successfully!');
            navigate('/profile');
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete beat: ' + error.message);
        }
    };

    if (loading) return <div className="pt-24 flex justify-center"><Loader2 className="animate-spin" /></div>;
    if (!beat) return <div className="pt-24 text-center">Beat not found</div>;



    const handleAddToCart = async () => {
        if (!user) return alert("Login required");
        if (beat.producer_id === user.id) return alert("You cannot buy your own beat.");

        // Check for duplicate
        const { data: existing } = await supabase
            .from('cart_items')
            .select('id')
            .eq('user_id', user.id)
            .eq('beat_id', beat.id)
            .single();

        if (existing) return alert("This beat is already in your cart");

        // Use actual database pricing columns from fix7.sql
        let price = beat.price || 19.99;  // MP3 Lease (default)
        if (selectedLicense === 'WAV Lease') price = beat.price_wav || 29.99;
        if (selectedLicense === 'Exclusive') price = beat.price_exclusive || 149.99;

        const { error } = await supabase.from('cart_items').insert({
            user_id: user.id,
            beat_id: beat.id,
            price: price,
            currency: 'USD',
            license_type: selectedLicense
        });
        if (error) alert("Already in cart or error.");
        else alert("Added to cart!");
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        alert("Link copied to clipboard!");
    };

    const handleContactArtist = () => {
        if (!user || !producer) {
            alert('Please login to contact the artist');
            return;
        }
        // Use ChatResolver to find or create conversation
        navigate(`/chat/u/${producer.id}`);
    };

    const handleLike = async () => {
        if (!user) return alert("Login required");

        // Check if already liked
        const { data: existing } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', user.id)
            .eq('beat_id', beat.id)
            .single();

        if (existing) {
            // Unlike
            const { error } = await supabase.from('favorites').delete().eq('id', existing.id);
            if (error) alert("Error unliking");
            else alert("Unliked!");
        } else {
            // Like
            const { error } = await supabase.from('favorites').insert({ user_id: user.id, beat_id: beat.id });
            if (error) alert("Already liked?");
            else alert("Liked!");
        }
        triggerRefresh();
    };

    return (
        <div className="pt-24 pb-24 container mx-auto px-6">
            {/* Top Section */}
            <div className="bg-surface border border-white/5 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
                {/* Visual */}
                <div className="w-full md:w-96 aspect-square bg-neutral-800 relative group">
                    <img src={beat.cover_url || '/placeholder-cover.jpg'} alt={beat.title} className="w-full h-full object-cover" />

                    {/* SOLD OUT Overlay - Checks purchases.license_type === 'Exclusive' */}
                    {isSoldOut && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                            <div className="sold-out-badge bg-red-600 px-6 py-3 rounded-lg text-2xl font-bold uppercase tracking-wider transform -rotate-12 shadow-xl border-2 border-red-400">
                                SOLD OUT
                            </div>
                        </div>
                    )}

                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => isCurrent && isPlaying ? pause() : playTrack(beat)}
                            className="w-20 h-20 bg-primary rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
                        >
                            {isCurrent && isPlaying ? <Pause size={40} fill="white" /> : <Play size={40} fill="white" className="ml-2" />}
                        </button>
                    </div>
                </div>

                {/* Details */}
                <div className="p-8 flex-1 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-primary font-bold tracking-widest text-sm uppercase">{beat.genre}</span>
                            <span className="text-neutral-500 text-sm flex items-center gap-1"><Clock size={14} /> {new Date(beat.created_at).toLocaleDateString()}</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-heading font-black mb-2">{beat.title}</h1>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-neutral-800 px-3 py-1 rounded text-sm font-mono text-neutral-300">{beat.bpm} BPM</div>
                            <div className="bg-neutral-800 px-3 py-1 rounded text-sm font-mono text-neutral-300">Key: {beat.key}</div>
                        </div>
                        <div className="flex items-center gap-4 mb-8">
                            <Link to={`/profile/${producer?.username}`} className="flex items-center gap-2 group">
                                <div className="w-10 h-10 rounded-full bg-neutral-700 overflow-hidden">
                                    {producer?.avatar_url && <img src={producer.avatar_url} alt="" />}
                                </div>
                                <div>
                                    <p className="text-xs text-neutral-500 group-hover:text-primary">Produced by</p>
                                    <p className="font-bold group-hover:underline">{producer?.username || 'Unknown'}</p>
                                </div>
                            </Link>
                        </div>

                        {/* OWNER CONTROL PANEL - Only visible to beat producer */}
                        {isOwner && (
                            <div className="mb-8 p-4 bg-neutral-900/80 border border-white/10 rounded-xl">
                                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3">Beat Management</h3>
                                <div className="flex items-center gap-3">
                                    {/* Visibility Toggle */}
                                    <button
                                        onClick={toggleVisibility}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${beat.is_visible === false
                                            ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
                                            : 'bg-neutral-800 text-white hover:bg-neutral-700'
                                            }`}
                                    >
                                        {beat.is_visible === false ? <EyeOff size={18} /> : <Eye size={18} />}
                                        {beat.is_visible === false ? 'Hidden (Click to Show)' : 'Visible (Click to Hide)'}
                                    </button>

                                    {/* Delete Button */}
                                    <button
                                        onClick={deleteBeat}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                        Delete Beat
                                    </button>
                                </div>
                                {beat.is_visible === false && (
                                    <p className="text-xs text-yellow-500 mt-2">⚠️ This beat is hidden from public view</p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4 mt-8 md:mt-0">
                        <div className="flex-1 flex flex-col gap-2">
                            {isSoldOut ? (
                                <>
                                    <div className="bg-red-600/20 border border-red-600 py-3 px-6 rounded-xl text-center font-bold uppercase tracking-wider text-red-400">
                                        SOLD OUT (Exclusive)
                                    </div>
                                    {user && producer && user.id !== producer.id && (
                                        <button
                                            onClick={handleContactArtist}
                                            className="bg-primary hover:bg-red-600 py-4 rounded-xl flex items-center justify-center gap-2 text-lg w-full transition-transform hover:scale-[1.02] font-bold"
                                        >
                                            <MessageSquare size={24} />
                                            <span>Contact Artist</span>
                                        </button>
                                    )}
                                </>
                            ) : isOwned ? (
                                <div className="bg-green-600 py-4 px-6 rounded-xl text-center font-bold flex items-center justify-center gap-2">
                                    <ShoppingCart /> Already Owned
                                </div>
                            ) : (
                                <>
                                    <select
                                        value={selectedLicense}
                                        onChange={(e) => setSelectedLicense(e.target.value)}
                                        className="bg-neutral-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                                    >
                                        <option value="MP3 Lease">MP3 Lease - {formatPrice(beat.price || 19.99, 'USD')}</option>
                                        <option value="WAV Lease">WAV Lease - {formatPrice(beat.price_wav || 29.99, 'USD')}</option>
                                        <option value="Exclusive">Exclusive - {formatPrice(beat.price_exclusive || 149.99, 'USD')}</option>
                                    </select>
                                    <button onClick={handleAddToCart} className="btn-primary py-4 rounded-xl flex items-center justify-center gap-2 text-lg w-full transition-transform hover:scale-[1.02]">
                                        <ShoppingCart />
                                        <span>Add to Cart</span>
                                    </button>
                                </>
                            )}
                        </div>
                        <button onClick={handleLike} className="p-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white transition-colors">
                            <Heart />
                        </button>
                        <button onClick={handleShare} className="p-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white transition-colors">
                            <Share2 />
                        </button>
                    </div>
                </div>
            </div>

            {/* Description & Comments */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
                <div className="md:col-span-2 space-y-8">
                    <section className="bg-surface p-6 rounded-xl border border-white/5">
                        <h3 className="text-xl font-bold mb-4">Description</h3>
                        <p className="text-neutral-400 leading-relaxed">
                            {beat.description || 'No description provided.'}
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><MessageSquare size={20} /> Comments ({comments.length})</h3>

                        {user && (
                            <form onSubmit={handleComment} className="mb-6 flex gap-4">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Leave a comment..."
                                    className="input-field"
                                />
                                <button type="submit" className="btn-primary rounded px-6">Post</button>
                            </form>
                        )}

                        <div className="space-y-4">
                            {comments.map(comment => (
                                <div key={comment.id} className="bg-surface p-4 rounded-xl border border-white/5 flex gap-4">
                                    <div className="w-10 h-10 rounded-full bg-neutral-700 overflow-hidden flex-shrink-0">
                                        <img src={comment.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${comment.profiles?.username}`} alt="" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-sm">{comment.profiles?.username}</span>
                                            <span className="text-xs text-neutral-600">{new Date(comment.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-neutral-300 text-sm">{comment.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Sidebar (e.g. Related beats, License info) */}
                <div className="space-y-6">
                    <div className="bg-surface p-6 rounded-xl border border-white/5">
                        <h3 className="font-bold mb-4 flex items-center gap-2"><Music4 className="text-primary" /> Licensing</h3>
                        <ul className="space-y-3 text-sm text-neutral-400">
                            <li className="flex justify-between items-center">
                                <span>MP3 Lease</span>
                                <span className="text-white font-bold">{formatPrice(beat.price || 19.99, beat.currency || 'USD')}</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span>WAV Lease</span>
                                <span className="text-white font-bold">{formatPrice(beat.price_wav || 29.99, beat.currency || 'USD')}</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span>Exclusive</span>
                                <span className="text-white font-bold">{formatPrice(beat.price_exclusive || 149.99, beat.currency || 'USD')}</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default BeatDetail;
