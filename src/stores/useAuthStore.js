import { create } from 'zustand';
import { supabase } from '../lib/supabase';

/**
 * Auth Store - INSTANT Release Pattern
 * 
 * Sets loading=false THE MOMENT we know if user exists or not
 * Profile loads in BACKGROUND - never blocks the UI
 */
const useAuthStore = create((set, get) => ({
    user: null,
    profile: null,
    loading: true,

    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile }),
    setLoading: (loading) => set({ loading }),

    initializeAuth: async () => {
        console.log('🟢 AUTH: Starting initialization...');

        // Set up auth state change listener
        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('🟡 AUTH: Event:', event);

            // INSTANT RELEASE: Set loading=false immediately when we know session state
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                if (session?.user) {
                    console.log('🟢 AUTH: User confirmed:', session.user.email);
                    set({ user: session.user, loading: false }); // INSTANT - user is ready

                    // Load profile in BACKGROUND - don't block UI
                    supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single()
                        .then(({ data }) => {
                            if (data) {
                                set({ profile: data });
                                console.log('🟢 AUTH: Profile loaded (background)');
                            }
                        })
                        .catch(e => console.error('Profile fetch error:', e));
                } else {
                    console.log('🟡 AUTH: No user (signed out or no session)');
                    set({ user: null, profile: null, loading: false }); // INSTANT
                }
            } else if (event === 'TOKEN_REFRESHED') {
                // Silent, no action needed
                console.log('🟡 AUTH: Token refreshed');
            }
        });

        // TIGHT Safety net: 1.5 seconds max wait
        setTimeout(() => {
            const state = get();
            if (state.loading) {
                console.log('⚠️ AUTH: 1.5s timeout - forcing loading=false');
                set({ loading: false });
            }
        }, 1500);
    },

    login: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        return data;
    },

    signup: async (email, password, username) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { username } }
        });
        if (error) throw error;

        if (data.user) {
            await supabase.from('profiles').insert({
                id: data.user.id,
                username: username,
                email: email
            });
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

        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (data) set({ profile: data });
    }
}));

export default useAuthStore;
