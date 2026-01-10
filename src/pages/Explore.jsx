import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import BeatCard from '../components/beats/BeatCard';
import { Search, Filter, Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const Explore = () => {
    const [beats, setBeats] = useState([]);
    const [profiles, setProfiles] = useState([]); // Search results for profiles
    const [topProducers, setTopProducers] = useState([]); // Top Producers section
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        search: '',
        genre: '',
        minBpm: '0', // Default 0
        maxBpm: '',
        minPrice: '',
        maxPrice: ''
    });
    const [showFilters, setShowFilters] = useState(false);

    // Fetch logic with filters
    const fetchBeats = async () => {
        setLoading(true);
        try {
            let query = supabase.from('beats').select('*').eq('is_visible', true); // fix8.sql visibility

            if (filters.search) {
                query = query.ilike('title', `%${filters.search}%`);
            }
            if (filters.genre) {
                query = query.ilike('genre', `%${filters.genre}%`);
            }
            if (filters.minBpm) {
                const min = Math.max(0, parseInt(filters.minBpm));
                query = query.gte('bpm', min);
            }
            if (filters.maxBpm) {
                query = query.lte('bpm', filters.maxBpm);
            }

            // Changed to Max Price as requested
            if (filters.maxPrice) {
                query = query.lte('price', filters.maxPrice);
            }

            // Sort by latest
            query = query.order('created_at', { ascending: false });

            const { data: beatsData, error: beatsError } = await query;
            if (beatsError) throw beatsError;
            setBeats(beatsData || []);

            // Search Profiles if searching
            if (filters.search) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .ilike('username', `%${filters.search}%`)
                    .limit(4);
                setProfiles(profileData || []);
            } else {
                setProfiles([]);
            }
        } catch (error) {
            console.error("Explore load error:", error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch Top Producers once on mount
    useEffect(() => {
        const fetchTopProducers = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .eq('is_producer', true)
                .limit(10);
            setTopProducers(data || []);
        };
        fetchTopProducers();
    }, []);

    // Debounce search
    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchBeats();
        }, 500);

        const handleFocus = () => fetchBeats();
        window.addEventListener('focus', handleFocus);

        return () => {
            clearTimeout(timeout);
            window.removeEventListener('focus', handleFocus);
        };
    }, [filters]);

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const clearFilters = () => {
        setFilters({
            search: '',
            genre: '',
            minBpm: '',
            maxBpm: '',
            minPrice: '',
            maxPrice: ''
        });
    };

    return (
        <div className="pt-24 pb-24 container mx-auto px-6">

            {/* Header & Search */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-heading font-bold">Explore Beats</h1>
                    <p className="text-neutral-400">Discover your next hit</p>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                        <input
                            type="text"
                            name="search"
                            placeholder="Search title..."
                            value={filters.search}
                            onChange={handleFilterChange}
                            className="input-field pl-10"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded border transition-colors ${showFilters ? 'bg-primary border-primary text-white' : 'border-neutral-800 text-neutral-400 hover:text-white'}`}
                    >
                        <Filter size={20} />
                    </button>
                </div>
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
                <div className="mb-8 p-6 bg-surface border border-white/5 rounded-xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4">
                    <div>
                        <label className="text-xs text-neutral-500 uppercase font-bold mb-1 block">Genre</label>
                        <input type="text" name="genre" placeholder="Trap, Drill, Lo-Fi..." value={filters.genre} onChange={handleFilterChange} className="input-field text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-neutral-500 uppercase font-bold mb-1 block">BPM Range</label>
                        <div className="flex gap-2">
                            <input type="number" min="0" name="minBpm" placeholder="Min" value={filters.minBpm} onChange={handleFilterChange} className="input-field text-sm" />
                            <input type="number" min="0" name="maxBpm" placeholder="Max" value={filters.maxBpm} onChange={handleFilterChange} className="input-field text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-neutral-500 uppercase font-bold mb-1 block">Max Price</label>
                        <input type="number" min="0" name="maxPrice" placeholder="Max Price" value={filters.maxPrice} onChange={handleFilterChange} className="input-field text-sm" />
                    </div>
                    <div className="flex items-end">
                        <button onClick={clearFilters} className="text-sm text-red-500 hover:text-red-400 flex items-center gap-1">
                            <X size={14} /> Clear All
                        </button>
                    </div>
                </div>
            )}

            {/* Grid */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-neutral-600" size={32} /></div>
            ) : (
                <div className="space-y-12">
                    {/* Profiles Search Result */}
                    {profiles.length > 0 && (
                        <section>
                            <h2 className="text-xl font-bold mb-4 text-white">Artists & Producers</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                {profiles.map(profile => (
                                    <Link to={`/profile/${profile.id}`} key={profile.id} className="group text-center block">
                                        <div className="w-20 h-20 mx-auto bg-neutral-800 rounded-full overflow-hidden mb-3 border-2 border-transparent group-hover:border-primary transition-all">
                                            <img src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}`} alt={profile.username} className="w-full h-full object-cover" />
                                        </div>
                                        <h3 className="font-bold text-white group-hover:text-primary transition-colors truncate">{profile.username}</h3>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Beats Result - FIRST */}
                    <section>
                        {profiles.length > 0 && <h2 className="text-xl font-bold mb-4 text-white">Beats</h2>}
                        {beats.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {beats.map(beat => (
                                    <BeatCard key={beat.id} beat={beat} beatList={beats} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 text-neutral-500">
                                <p>No beats found matching your criteria.</p>
                            </div>
                        )}
                    </section>

                    {/* Top Producers - BELOW BEATS with mt-12 spacing */}
                    {topProducers.length > 0 && (
                        <section className="mt-12 pt-8 border-t border-white/5">
                            <h2 className="text-3xl font-heading font-bold mb-6 text-white">Top Producers</h2>
                            <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
                                {topProducers.map(producer => (
                                    <Link to={`/profile/${producer.username || producer.id}`} key={producer.id} className="group flex-shrink-0 text-center block">
                                        <div className="w-24 h-24 mx-auto bg-neutral-800 rounded-full overflow-hidden mb-3 border-2 border-transparent group-hover:border-primary transition-all shadow-lg">
                                            <img src={producer.avatar_url || `https://ui-avatars.com/api/?name=${producer.username}`} alt={producer.username} className="w-full h-full object-cover" />
                                        </div>
                                        <h3 className="font-bold text-white group-hover:text-primary transition-colors truncate max-w-[96px]">{producer.username}</h3>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}

        </div>
    );
};

export default Explore;
