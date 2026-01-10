import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import BeatCard from '../components/beats/BeatCard';
import { Loader2, TrendingUp, Sparkles, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/useAuthStore';

const Home = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();

    const handleStartSelling = (e) => {
        if (!user) {
            e.preventDefault();
            navigate('/login');
        }
    };

    const [featuredBeats, setFeaturedBeats] = useState([]);
    const [trendingBeats, setTrendingBeats] = useState([]);
    const [featuredArtists, setFeaturedArtists] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            // Fetch latest beats (only visible ones)
            const { data: latest } = await supabase
                .from('beats')
                .select('*')
                .eq('is_visible', true)  // fix8.sql visibility filter
                .order('created_at', { ascending: false })
                .limit(4);

            // Fetch trending (most plays - only visible ones)
            const { data: trending } = await supabase
                .from('beats')
                .select('*')
                .eq('is_visible', true)  // fix8.sql visibility filter
                .order('plays_count', { ascending: false })
                .limit(4);

            // Fetch featured artists (producers)
            const { data: artists } = await supabase
                .from('profiles')
                .select('*')
                .eq('is_producer', true)
                .limit(6);

            if (latest) setFeaturedBeats(latest);
            if (trending) setTrendingBeats(trending);
            if (artists) setFeaturedArtists(artists);
            setLoading(false);
        };

        fetchData();
    }, []);

    return (
        <div className="pb-24">
            {/* Hero Section */}
            <section className="relative h-[60vh] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-red-900/20 to-bg z-0" />
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-10 blur-sm" />

                <div className="relative z-10 text-center max-w-4xl px-6">
                    <h1 className="text-5xl md:text-7xl font-heading font-black tracking-tighter mb-6 text-white">
                        LEVEL UP <span className="text-primary block md:inline">YOUR SOUND.</span>
                    </h1>
                    <p className="text-lg md:text-xl text-neutral-400 mb-8 font-light">
                        Not another marketplace. Built for artists and producers.
                    </p>
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                        <Link to="/explore" className="btn-primary w-full md:w-auto">Start Exploring</Link>
                        <Link to="/upload" onClick={handleStartSelling} className="px-8 py-2 rounded font-bold border border-white/20 hover:bg-white/10 transition-all w-full md:w-auto">
                            Start Selling
                        </Link>
                    </div>
                </div>
            </section>

            <div className="container mx-auto px-6 space-y-20">

                {/* Featured Section */}
                <section>
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
                            <Sparkles className="text-primary" size={24} />
                            Fresh Drops
                        </h2>
                        <Link to="/explore" className="text-sm text-neutral-400 hover:text-white transition-colors">View All</Link>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-neutral-600" size={32} /></div>
                    ) : featuredBeats.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {featuredBeats.map(beat => (
                                <BeatCard key={beat.id} beat={beat} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 text-neutral-500 bg-neutral-900/50 rounded-xl border border-white/5">
                            <p>No beats yet. Be the first to upload!</p>
                            <Link to="/upload" className="text-primary hover:underline mt-2 inline-block">Upload a Beat</Link>
                        </div>
                    )}
                </section>

                {/* Featured Artists Section */}
                <section>
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
                            <User className="text-primary" size={24} />
                            Featured Artists
                        </h2>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-neutral-600" size={32} /></div>
                    ) : featuredArtists.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                            {featuredArtists.map(artist => (
                                <Link to={`/profile/${artist.id}`} key={artist.id} className="group text-center">
                                    <div className="w-24 h-24 mx-auto bg-neutral-800 rounded-full overflow-hidden mb-3 border-2 border-transparent group-hover:border-primary transition-all">
                                        {artist.avatar_url ? (
                                            <img src={artist.avatar_url} alt={artist.username} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-neutral-500 font-bold text-xl">
                                                {artist.username ? artist.username[0].toUpperCase() : '?'}
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-white group-hover:text-primary transition-colors truncate">{artist.username || 'Unknown'}</h3>
                                    <p className="text-xs text-neutral-500">Producer</p>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-neutral-500">
                            <p>No featured artists found.</p>
                        </div>
                    )}
                </section>

                {/* Trending Section */}
                <section>
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
                            <TrendingUp className="text-primary" size={24} />
                            Trending Now
                        </h2>
                    </div>

                    {!loading && trendingBeats.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {trendingBeats.map(beat => (
                                <BeatCard key={beat.id} beat={beat} />
                            ))}
                        </div>
                    )}
                </section>

            </div>
        </div>
    );
};

export default Home;
