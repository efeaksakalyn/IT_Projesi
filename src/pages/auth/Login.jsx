import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, User } from 'lucide-react';

const Login = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        login: '', // Can be email or username
        password: ''
    });
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { login, password } = formData;
        let emailToUse = login;

        try {
            // 1. Determine if input is Email or Username
            const isEmail = login.includes('@');

            if (!isEmail) {
                // Resolve username to email
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('email')
                    .eq('username', login)
                    .single();

                if (profileError || !profile) {
                    throw new Error('Username not found');
                }
                emailToUse = profile.email;
            }

            // 2. Sign in
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: emailToUse,
                password: password,
            });

            if (authError) throw authError;

            // 3. Success
            navigate('/');
        } catch (err) {
            setError(err.message === 'Invalid login credentials' ? 'Invalid credentials' : err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg relative overflow-hidden">
            <div className="absolute top-0 right-1/2 translate-x-1/2 w-96 h-96 bg-red-900/10 rounded-full blur-[100px]" />

            <div className="w-full max-w-md bg-surface border border-white/5 p-8 rounded-2xl shadow-2xl relative z-10 backdrop-blur-sm">
                <h2 className="text-3xl font-heading font-bold text-center mb-2">Welcome Back</h2>
                <p className="text-neutral-400 text-center mb-8">Login to continue to dlynbtz</p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded mb-4 text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Email or Username</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                            <input
                                type="text"
                                name="login"
                                required
                                className="input-field pl-10"
                                placeholder="username or email"
                                value={formData.login}
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
                                className="input-field pl-10"
                                placeholder="********"
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
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Log In'}
                    </button>
                </form>

                <p className="text-center mt-6 text-neutral-400 text-sm">
                    New here? <Link to="/signup" className="text-white hover:text-primary underline">Create an account</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
