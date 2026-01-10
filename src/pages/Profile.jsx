import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import useAuthStore from '../stores/useAuthStore';
import BeatCard from '../components/beats/BeatCard';
import { Loader2, Settings as SettingsIcon, MessageSquare, Instagram, Globe } from 'lucide-react';

const Profile = () => {
    const { id, username } = useParams();
    const { user, profile: myProfile } = useAuthStore();
    const paramId = id || username;
    const isOwnProfile = !paramId || (myProfile && (myProfile.id === paramId || myProfile.username === paramId));

    // STATE INITIALIZATION - All states properly initialized to prevent ReferenceError
    const [profile, setProfile] = useState(null);
    const [sellingBeats, setSellingBeats] = useState([]);  // Active beats for sale
    const [soldOutBeats, setSoldOutBeats] = useState([]);  // Beats with Exclusive license sold
    const [collection, setCollection] = useState([]);
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [showFollowers, setShowFollowers] = useState(false);
    const [modalUsers, setModalUsers] = useState([]);
    const [modalTitle, setModalTitle] = useState('');

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('selling');

    // Helper: Ensure URLs have proper protocol for external links
    const formatUrl = (url) => {
        if (!url) return '';
        return url.startsWith('http') ? url : `https://${url}`;
    };

    // Handle initial tab from URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab === 'collection' && isOwnProfile) setActiveTab('collection');
    }, [isOwnProfile]);

    useEffect(() => {
        const fetchProfileData = async () => {
            // Safety check
            // Safety check: if not own profile and no param, return
            if (!isOwnProfile && !paramId) return;

            // Only show full loading spinner if we clearly don't have the profile yet or it's a different one
            const shouldShowSpinner = !profile || (paramId && profile?.id !== paramId && profile?.username !== paramId);
            if (shouldShowSpinner) setLoading(true);

            try {
                let targetProfile = null;

                if (isOwnProfile) {
                    targetProfile = myProfile;
                } else {
                    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paramId);
                    let query = supabase.from('profiles').select('*');
                    if (isUuid) {
                        query = query.eq('id', paramId);
                    } else {
                        query = query.eq('username', paramId);
                    }
                    const { data } = await query.single();
                    targetProfile = data;
                }

                setProfile(targetProfile);

                if (targetProfile) {
                    // 2. Fetch Beats - Show all to owner, only visible to others
                    let beatsQuery = supabase
                        .from('beats')
                        .select('*, producer:profiles(*)')
                        .eq('producer_id', targetProfile.id)
                        .order('created_at', { ascending: false });

                    // If NOT viewing own profile, filter by is_visible (fix8.sql)
                    if (!isOwnProfile) {
                        beatsQuery = beatsQuery.eq('is_visible', true);
                    }

                    const { data: allBeats } = await beatsQuery;

                    // Check which beats are sold exclusively
                    const beatIds = (allBeats || []).map(b => b.id);
                    let exclusiveBeatIds = [];

                    if (beatIds.length > 0) {
                        const { data: exclusivePurchases } = await supabase
                            .from('purchases')
                            .select('beat_id')
                            .in('beat_id', beatIds)
                            .eq('license_type', 'Exclusive');

                        exclusiveBeatIds = (exclusivePurchases || []).map(p => p.beat_id);
                    }

                    // Separate beats
                    const selling = (allBeats || []).filter(b => !exclusiveBeatIds.includes(b.id));
                    const soldOut = (allBeats || []).filter(b => exclusiveBeatIds.includes(b.id));

                    setSellingBeats(selling);
                    setSoldOutBeats(soldOut);

                    // 3. Fetch Collection (Purchases)
                    if (isOwnProfile) {
                        const { data: purchases } = await supabase
                            .from('purchases')
                            .select('*, beat:beats(*, producer:profiles(*))')
                            .eq('user_id', targetProfile.id);

                        const purchasedBeats = purchases?.map(p => p.beat) || [];
                        setCollection(purchasedBeats);
                    }

                    // 4. Fetch Follow Stats
                    const { count: followers } = await supabase
                        .from('follows')
                        .select('*', { count: 'exact', head: true })
                        .eq('following_id', targetProfile.id);
                    setFollowersCount(followers || 0);

                    const { count: following } = await supabase
                        .from('follows')
                        .select('*', { count: 'exact', head: true })
                        .eq('follower_id', targetProfile.id);
                    setFollowingCount(following || 0);

                    // 5. Check if Auth User is Following
                    if (user && !isOwnProfile) {
                        const { data: followData } = await supabase
                            .from('follows')
                            .select('*')
                            .eq('follower_id', user.id)
                            .eq('following_id', targetProfile.id)
                            .single();
                        setIsFollowing(!!followData);
                    }
                }
            } catch (error) {
                console.error("Profile load error:", error);
            } finally {
                setLoading(false);
            }
        };

        if (myProfile || paramId) {
            fetchProfileData();
        }
    }, [paramId, myProfile, isOwnProfile, user]);

    const handleFollow = async () => {
        if (!user) return alert("Login to follow.");
        if (!profile) return;  // Safety check for null profile
        if (isFollowing) {
            const { error } = await supabase.from('follows').delete().match({ follower_id: user.id, following_id: profile.id });
            if (!error) {
                setIsFollowing(false);
                setFollowersCount(prev => prev - 1);
            }
        } else {
            const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: profile.id });
            if (!error) {
                setIsFollowing(true);
                setFollowersCount(prev => prev + 1);
            }
        }
    };

    const openFollowers = async () => {
        setModalTitle('Followers');
        // Explicitly joining with profiles via follower_id relationship/column
        // Note: 'follower:profiles!follower_id(...)' specifies the alias 'follower' AND the table 'profiles' with FK 'follower_id'
        const { data, error } = await supabase
            .from('follows')
            // Trying different join syntaxes to be robust. 
            // If the foreign key is named strictly, try:
            .select(`
                follower_id,
                follower:profiles!follower_id (
                    id, username, avatar_url
                )
            `)
            .eq('following_id', profile.id);

        if (error) console.error("Error fetching followers:", error);

        // Map the result
        setModalUsers(data?.map(d => d.follower).filter(Boolean) || []);
        setShowFollowers(true);
    };

    const openFollowing = async () => {
        setModalTitle('Following');
        const { data, error } = await supabase
            .from('follows')
            .select(`
                following_id,
                following:profiles!following_id (
                    id, username, avatar_url
                )
            `)
            .eq('follower_id', profile.id);

        if (error) console.error("Error fetching following:", error);

        setModalUsers(data?.map(d => d.following).filter(Boolean) || []);
        setShowFollowers(true);
    };

    if (loading) return <div className="pt-24 flex justify-center"><Loader2 className="animate-spin" /></div>;

    if (!profile) {
        return (
            <div className="pt-24 text-center">
                <h2 className="text-xl font-bold mb-4">Profile not found</h2>
                {user && isOwnProfile && (
                    <div className="space-y-4">
                        <p>You don't have a profile yet.</p>
                        <button onClick={() => window.location.reload()} className="btn-primary">Create/Reload Profile</button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="pt-24 pb-24 container mx-auto px-6 relative">

            {/* Modal */}
            {showFollowers && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowFollowers(false)}>
                    <div className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-xl">{modalTitle}</h3>
                            <button onClick={() => setShowFollowers(false)} className="text-neutral-400 hover:text-white">Close</button>
                        </div>
                        <div className="space-y-4">
                            {modalUsers.length > 0 ? modalUsers.map(u => (
                                <Link to={`/profile/${u.id}`} key={u.id} className="flex items-center gap-3 hover:bg-white/5 p-2 rounded transition-colors" onClick={() => setShowFollowers(false)}>
                                    <div className="w-10 h-10 rounded-full bg-neutral-700 overflow-hidden">
                                        <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <span className="font-bold">{u.username}</span>
                                </Link>
                            )) : <p className="text-neutral-500">No users found.</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="mb-12 flex flex-col items-center text-center">
                <div className="w-32 h-32 rounded-full overflow-hidden mb-4 border-4 border-primary shadow-2xl relative">
                    <img src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}`} alt={profile.username} className="w-full h-full object-cover" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                    {profile.is_producer && <span className="bg-primary text-white text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider">Producer</span>}
                    {profile.is_artist && <span className="bg-white text-black text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider">Artist</span>}
                </div>
                <h1 className="text-3xl font-heading font-black mb-1">{profile?.username}</h1>
                <p className="text-neutral-400 max-w-md">{profile?.bio || ''}</p>

                {/* Social Links */}
                <div className="flex items-center gap-4 mt-4">
                    {profile.website && (
                        <a href={formatUrl(profile.website)} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-white transition-colors">
                            <Globe size={20} />
                        </a>
                    )}
                    {profile.twitter && (
                        <a href={`https://x.com/${profile.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-white transition-colors">
                            {/* X Logo */}
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                            </svg>
                        </a>
                    )}
                    {profile.instagram && (
                        <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-white transition-colors">
                            <Instagram size={20} />
                        </a>
                    )}
                </div>

                {/* Follow Stats */}
                <div className="flex items-center gap-6 mt-4 text-sm">
                    <button onClick={openFollowers} className="hover:text-white text-neutral-300">
                        <span className="font-bold text-white text-lg">{followersCount}</span> Followers
                    </button>
                    <button onClick={openFollowing} className="hover:text-white text-neutral-300">
                        <span className="font-bold text-white text-lg">{followingCount}</span> Following
                    </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4 mt-6">
                    {isOwnProfile ? (
                        <Link to="/settings" className="btn-secondary flex items-center gap-2 text-sm border border-white/10 px-4 py-2 rounded hover:bg-white/5 transition-colors">
                            <SettingsIcon size={16} /> Edit Profile
                        </Link>
                    ) : (
                        <>
                            <button
                                onClick={handleFollow}
                                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${isFollowing ? 'bg-neutral-800 text-white hover:bg-neutral-700' : 'bg-white text-black hover:bg-neutral-200'}`}
                            >
                                {isFollowing ? 'Unfollow' : 'Follow'}
                            </button>
                            <Link to={`/chat/u/${profile.id}`} className="btn-primary flex items-center gap-2 px-6 py-2 rounded-full text-sm">
                                <MessageSquare size={16} /> Message
                            </Link>
                        </>
                    )}
                </div>
            </div>

            {/* PROFILE FOLDERS: Selling (Active) vs Sold Out (Exclusive) tabs */}
            {/* Tabs */}
            <div className="flex items-center justify-center gap-8 mb-12 border-b border-white/5 pb-4">
                <button
                    onClick={() => setActiveTab('selling')}
                    className={`text-lg font-bold pb-4 transition-all relative ${activeTab === 'selling' ? 'text-primary' : 'text-neutral-500 hover:text-white'}`}
                >
                    Selling ({sellingBeats.length})
                    {activeTab === 'selling' && <span className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full" />}
                </button>
                {soldOutBeats.length > 0 && (
                    <button
                        onClick={() => setActiveTab('soldout')}
                        className={`text-lg font-bold pb-4 transition-all relative ${activeTab === 'soldout' ? 'text-red-500' : 'text-neutral-500 hover:text-white'}`}
                    >
                        Sold Out ({soldOutBeats.length})
                        {activeTab === 'soldout' && <span className="absolute bottom-0 left-0 w-full h-1 bg-red-500 rounded-t-full" />}
                    </button>
                )}
                {isOwnProfile && (
                    <button
                        onClick={() => setActiveTab('collection')}
                        className={`text-lg font-bold pb-4 transition-all relative ${activeTab === 'collection' ? 'text-primary' : 'text-neutral-500 hover:text-white'}`}
                    >
                        Collection ({collection.length})
                        {activeTab === 'collection' && <span className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full" />}
                    </button>
                )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {activeTab === 'selling' ? (
                    sellingBeats.length > 0 ? (
                        sellingBeats.map(beat => <BeatCard key={beat.id} beat={beat} />)
                    ) : (
                        <p className="col-span-full text-center text-neutral-500 py-12">No beats for sale.</p>
                    )
                ) : activeTab === 'soldout' ? (
                    soldOutBeats.length > 0 ? (
                        soldOutBeats.map(beat => <BeatCard key={beat.id} beat={beat} />)
                    ) : (
                        <p className="col-span-full text-center text-neutral-500 py-12">No sold out beats.</p>
                    )
                ) : (
                    collection.length > 0 ? (
                        collection.map(beat => <BeatCard key={beat.id} beat={beat} />)
                    ) : (
                        <p className="col-span-full text-center text-neutral-500 py-12">You haven't bought any beats yet.</p>
                    )
                )}
            </div>
        </div>
    );
};

export default Profile;
