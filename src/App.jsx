import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
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

// Global logout redirect handler
const LogoutRedirector = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                // Only redirect if not already on home or auth pages
                if (location.pathname !== '/' && location.pathname !== '/login' && location.pathname !== '/signup') {
                    navigate('/');
                }
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate, location.pathname]);

    return null;
};

// Layout Wrapper
const Layout = ({ children }) => {
    const location = useLocation();
    const isAuthPage = ['/login', '/signup'].includes(location.pathname);

    return (
        <div className="min-h-screen bg-bg text-white flex flex-col">
            <LogoutRedirector />
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

    useEffect(() => {
        console.log('🟡 APP: Calling initializeAuth...');
        initializeAuth();
    }, [initializeAuth]);

    // Show loading spinner while auth is hydrating
    // This ensures pages don't render with empty user data
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

                    {/* Protected Routes */}
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
