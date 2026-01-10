import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import useAuthStore from '../stores/useAuthStore';
import BeatCard from '../components/beats/BeatCard';
import { Heart, Loader2 } from 'lucide-react';

const Favorites = () => {
    const { user } = useAuthStore();
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFavorites = async () => {
            if (!user) return;
            setLoading(true);
            const { data } = await supabase
                .from('favorites')
                .select('*, beat:beats(*)')
                .eq('user_id', user.id);

            const beats = data?.map(f => f.beat).filter(Boolean) || [];
            setFavorites(beats);
            setLoading(false);
        };

        fetchFavorites();
    }, [user]);

    if (loading) return <div className="pt-24 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="pt-24 pb-24 container mx-auto px-6">
            <h1 className="text-3xl font-heading font-bold mb-8 flex items-center gap-3">
                <Heart className="text-primary" fill="currentColor" /> My Favorites
            </h1>

            {favorites.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {favorites.map(beat => (
                        <BeatCard key={beat.id} beat={beat} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 text-neutral-500">
                    <p>You haven't liked any beats yet.</p>
                </div>
            )}
        </div>
    );
};

export default Favorites;
