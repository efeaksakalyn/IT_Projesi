import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useAuthStore = create((set, get) => ({
    user: null,
    profile: null,
    loading: true,

    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile }),
    setLoading: (loading) => set({ loading }),

    initializeAuth: async () => {
        set({ loading: true });
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
                set({ user: session.user });

                // Fetch profile
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (profileData) {
                    set({ profile: profileData });
                }
            } else {
                set({ user: null, profile: null });
            }
        } catch (error) {
            console.error('Auth initialization error:', error);
            set({ user: null, profile: null });
        } finally {
            set({ loading: false });
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                set({ user: session.user });

                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (profileData) {
                    set({ profile: profileData });
                }
            } else if (event === 'SIGNED_OUT') {
                set({ user: null, profile: null });
            }
        });
    },

    login: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        if (data.user) {
            set({ user: data.user });

            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (profileData) {
                set({ profile: profileData });
            }
        }

        return data;
    },

    signup: async (email, password, username) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { username }
            }
        });

        if (error) throw error;

        if (data.user) {
            // Create profile
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: data.user.id,
                    username: username,
                    email: email
                });

            if (profileError) {
                console.error('Profile creation error:', profileError);
            }

            set({ user: data.user });

            // Fetch created profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (profileData) {
                set({ profile: profileData });
            }
        }

        return data;
    },

    logout: async () => {
        await supabase.auth.signOut();
        set({ user: null, profile: null });
    },

    refreshProfile: async () => {
        const user = get().user;
        if (!user) return;

        const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileData) {
            set({ profile: profileData });
        }
    }
}));

export default useAuthStore;
