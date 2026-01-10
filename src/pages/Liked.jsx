import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import useAuthStore from '../stores/useAuthStore';
import BeatCard from '../components/beats/BeatCard';
import { Loader2, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

const Liked = () => {
    const { user } = useAuthStore();
    const [beats, setBeats] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLikedBeats = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            // Join favorites with beats
            // Supabase inner join syntax via select:
            // select('beat_id, beats(*)')
            // But getting nested data and flattening is easier.

            const { data, error } = await supabase
                .from('favorites')
                .select('beat_id, beats:beats(*)')
                .eq('user_id', user.id);

            if (data) {
                // Flatten the structure: we want the beat object, not the favorite wrapper
                // beat:beats(*) returns the beat object in a property named 'beats' or 'beats' alias
                // data is [{ beat_id: '...', beats: { ...beatData } }]
                const likedBeats = data.map(item => item.beats).filter(Boolean);
                setBeats(likedBeats);
            }
            setLoading(false);
        };

        fetchLikedBeats();
    }, [user]);

    if (!user) {
        return (
            <div className="pt-32 pb-24 text-center">
                <Heart size={64} className="mx-auto text-neutral-600 mb-6" />
                <h2 className="text-3xl font-heading font-bold mb-4">Your Likes</h2>
                <p className="text-neutral-400 mb-8">Log in to see your favorite tracks.</p>
                <Link to="/login" className="btn-primary">Log In</Link>
            </div>
        );
    }

    return (
        <div className="pt-24 pb-24 container mx-auto px-6">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-red-900/20 rounded-full text-primary">
                    <Heart size={32} fill="currentColor" />
                </div>
                <div>
                    <h1 className="text-4xl font-heading font-black">Liked Beats</h1>
                    <p className="text-neutral-400">{beats.length} tracks saved</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-neutral-600" size={32} /></div>
            ) : beats.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {beats.map(beat => (
                        <BeatCard key={beat.id} beat={beat} beatList={beats} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 text-neutral-500 bg-surface rounded-2xl border border-white/5">
                    <p>You haven't liked any beats yet.</p>
                    <Link to="/explore" className="text-primary hover:underline mt-2 inline-block">Go Explore</Link>
                </div>
            )}
        </div>
    );
};

export default Liked;
