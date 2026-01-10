import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import GlobalPlayer from './components/player/GlobalPlayer';
import useAuthStore from './stores/useAuthStore';
import { supabase } from './lib/supabase';
import { Loader2 } from 'lucide-react';

// Pages
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import Home from './pages/Home';
import Explore from './pages/Explore';
import BeatDetail from './pages/BeatDetail';
import BeatUpload from './pages/BeatUpload';
import Profile from './pages/Profile';
import Liked from './pages/Liked';
import Cart from './pages/Cart';
import Favorites from './pages/Favorites';
import Inbox from './pages/chat/Inbox';
import ChatDetail from './pages/chat/ChatDetail';


import ChatResolver from './pages/chat/ChatResolver';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';

// Layout Wrapper
const Layout = ({ children }) => {
    const location = useLocation();
    const isAuthPage = ['/login', '/signup'].includes(location.pathname);

    return (
        <div className="min-h-screen bg-bg text-white flex flex-col">
            {!isAuthPage && <Navbar />}
            {/* 
                Mobile: pt-0 (no top bar), pb-36 (bottom nav 16 + player 20)
                Desktop: pt-16 (top bar), pb-20 (player only)
            */}
            <main className={`flex-grow ${!isAuthPage ? 'pt-0 md:pt-16 pb-36 md:pb-20' : ''}`}>
                {children}
            </main>
            {!isAuthPage && <GlobalPlayer />}
        </div>
    );
};

function App() {
    const initializeAuth = useAuthStore((state) => state.initializeAuth);
    const loading = useAuthStore((state) => state.loading);
    const user = useAuthStore((state) => state.user);
    const setProfile = useAuthStore((state) => state.setProfile);

    useEffect(() => {
        initializeAuth();

        /**
         * GLOBAL FOCUS LISTENER - Silent Data Refresh
         * Eliminates "sleeping pages" bug by refreshing essential data when tab regains focus
         * NO loading spinners or UI disruption - completely invisible to user
         */
        const handleGlobalFocus = async () => {
            console.log('[App] Tab focused - Silent refresh triggered');

            // 1. Check User Session (ensure auth token hasn't expired)
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.log('[App] No active session on focus');
                return;
            }

            const currentUserId = session.user?.id;
            if (!currentUserId) return;

            try {
                // 2. Refresh Profile & Balance (silent, no loading state)
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', currentUserId)
                    .single();

                if (profileData) {
                    setProfile(profileData);
                    console.log('[App] Profile refreshed silently');
                }

                // 3. Refresh unread message count (for Navbar badge)
                // This updates the global state for notification badges
                const { count: unreadCount } = await supabase
                    .from('messages')
                    .select('*', { count: 'exact', head: true })
                    .neq('sender_id', currentUserId)
                    .eq('read', false);

                // Store in window for global access (Navbar can read this)
                window.__unreadMessageCount = unreadCount || 0;
                console.log('[App] Unread messages:', unreadCount);

                // 4. Dispatch custom event for components to listen
                window.dispatchEvent(new CustomEvent('app:focus-refresh', {
                    detail: { userId: currentUserId, unreadCount }
                }));

            } catch (error) {
                // Silent fail - don't disrupt user experience
                console.log('[App] Silent refresh error (ignored):', error.message);
            }
        };

        window.addEventListener('focus', handleGlobalFocus);

        // Cleanup to prevent memory leaks
        return () => {
            window.removeEventListener('focus', handleGlobalFocus);
        };
    }, [initializeAuth, setProfile]);

    // Show loading while checking auth
    if (loading) {
        return (
            <div className="min-h-screen bg-bg flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    return (
        <Router>
            <Layout>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/explore" element={<Explore />} />
                    <Route path="/beats/:id" element={<BeatDetail />} />

                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />

                    {/* Protected Routes (TODO: Add AuthGuard) */}
                    <Route path="/upload" element={<BeatUpload />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/profile/:id" element={<Profile />} />
                    <Route path="/profile/user/:username" element={<Profile />} />
                    <Route path="/liked" element={<Liked />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/favorites" element={<Favorites />} />
                    <Route path="/inbox" element={<Inbox />} />
                    <Route path="/chat/:id" element={<ChatDetail />} />
                    <Route path="/chat/u/:userId" element={<ChatResolver />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                </Routes>
            </Layout>
        </Router>
    );
}

export default App;
