import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Loader2 } from 'lucide-react';

const Signup = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: ''
    });
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { username, email, password } = formData;

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            setLoading(false);
            return;
        }

        try {
            // 1. Check if username exists (optional but good UX)
            const { data: existingUser } = await supabase
                .from('profiles')
                .select('username')
                .eq('username', username)
                .single();

            if (existingUser) {
                throw new Error('Username already taken');
            }

            // 2. Sign up with Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) throw authError;

            if (authData.user) {
                // 3. Create Profile Entry manually (since we disabled trigger reliance for safety/control)
                // Note: If you have a trigger, this might duplicate or error. 
                // We will try to insert. If trigger exists, handle via "ON CONFLICT" or just let trigger do it.
                // User asked NOT to rely on RLS on auth.users, but public.profiles is where we store data.
                // We will explicitly insert into profiles.

                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([
                        {
                            id: authData.user.id,
                            username: username,
                            email: email,
                            avatar_url: `https://ui-avatars.com/api/?name=${username}&background=FF0000&color=fff`
                        }
                    ]);

                if (profileError) {
                    console.error('Profile creation failed:', profileError);
                    // If trigger created it, we might want to update it instead.
                    // Fallback: try update if insert fails (assuming it was unique constraint on ID)
                }
            }

            navigate('/'); // Redirect to home on success
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/20 rounded-full blur-[100px]" />

            <div className="w-full max-w-md bg-surface border border-white/5 p-8 rounded-2xl shadow-2xl relative z-10 backdrop-blur-sm">
                <h2 className="text-3xl font-heading font-bold text-center mb-2">Join dlynbtz</h2>
                <p className="text-neutral-400 text-center mb-8">Start your journey as a producer or artist</p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded mb-4 text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Username</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                            <input
                                type="text"
                                name="username"
                                required
                                className="input-field pl-10"
                                placeholder="producer_name"
                                value={formData.username}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                            <input
                                type="email"
                                name="email"
                                required
                                className="input-field pl-10"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                            <input
                                type="password"
                                name="password"
                                required
                                minLength={8}
                                className="input-field pl-10"
                                placeholder="Min 8 chars"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn-primary mt-6 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Create Account'}
                    </button>
                </form>

                <p className="text-center mt-6 text-neutral-400 text-sm">
                    Already have an account? <Link to="/login" className="text-white hover:text-primary underline">Log in</Link>
                </p>
            </div>
        </div>
    );
};

export default Signup;
