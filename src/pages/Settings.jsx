import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import useAuthStore from '../stores/useAuthStore';
import { Loader2, Save, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Settings = () => {
    const { user, profile, refreshProfile, logout } = useAuthStore();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        bio: '',
        website: '',
        twitter: '',
        instagram: '',
        is_producer: false,
        is_artist: false,
        favorite_genre: ''
    });
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (profile) {
            setFormData({
                username: profile.username || '',
                bio: profile.bio || '',
                website: profile.website || '',
                twitter: profile.twitter || '',
                instagram: profile.instagram || '',
                is_producer: profile.is_producer || false,
                is_artist: profile.is_artist || false,
                favorite_genre: profile.favorite_genre || ''
            });
        }
    }, [profile]);

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);

        try {
            const { error } = await supabase
                .from('profiles')
                .update(formData)
                .eq('id', user.id);

            if (error) throw error;

            // Password Change
            if (password) {
                const { error: passError } = await supabase.auth.updateUser({ password: password });
                if (passError) throw passError;
                setPassword('');
            }

            // Refresh the profile in the store so changes appear immediately
            await refreshProfile();

            alert('Profile updated successfully!');
        } catch (err) {
            alert('Error updating profile: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    return (
        <div className="pt-24 pb-24 container mx-auto px-6 max-w-2xl">
            <h1 className="text-3xl font-heading font-bold mb-8">Settings</h1>

            <form onSubmit={handleSave} className="bg-surface p-8 rounded-2xl border border-white/5 shadow-2xl space-y-6">

                <div className="space-y-2">
                    <label className="label-text">Username</label>
                    <input type="text" name="username" value={formData.username} onChange={handleChange} className="input-field" />
                </div>

                <div className="space-y-2">
                    <label className="label-text">New Password</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" placeholder="Leave blank to keep current" />
                </div>

                <div className="space-y-2">
                    <label className="label-text">Favorite Genre</label>
                    <input type="text" name="favorite_genre" value={formData.favorite_genre} onChange={handleChange} className="input-field" placeholder="e.g. Trap, Lo-Fi" />
                </div>

                <div className="space-y-2">
                    <label className="label-text">Bio</label>
                    <textarea name="bio" value={formData.bio} onChange={handleChange} className="input-field h-24 resize-none" placeholder="Tell us about yourself..."></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="label-text">Website</label>
                        <input type="text" name="website" value={formData.website} onChange={handleChange} className="input-field" placeholder="https://" />
                    </div>
                    <div className="space-y-2">
                        <label className="label-text">X</label>
                        <input type="text" name="twitter" value={formData.twitter} onChange={handleChange} className="input-field" placeholder="@username" />
                    </div>
                    <div className="space-y-2">
                        <label className="label-text">Instagram</label>
                        <input type="text" name="instagram" value={formData.instagram} onChange={handleChange} className="input-field" placeholder="@username" />
                    </div>
                </div>

                <div className="flex flex-col gap-4 bg-black/20 p-4 rounded-xl border border-white/5">
                    <label className="label-text font-bold">Roles</label>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" name="is_producer" checked={formData.is_producer} onChange={handleChange} className="w-5 h-5 rounded text-primary focus:ring-primary bg-neutral-900 border-neutral-700" />
                            <label className="text-white">Producer</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" name="is_artist" checked={formData.is_artist} onChange={handleChange} className="w-5 h-5 rounded text-primary focus:ring-primary bg-neutral-900 border-neutral-700" />
                            <label className="text-white">Artist</label>
                        </div>
                    </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Save Changes</>}
                </button>

                <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors font-medium"
                >
                    <LogOut size={18} /> Log Out
                </button>

            </form>
        </div>
    );
};

export default Settings;
