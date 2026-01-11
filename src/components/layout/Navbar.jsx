import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, MessageSquare, User, Upload, Home, Search, LogOut, Heart, LayoutDashboard } from 'lucide-react';

import useAuthStore from '../../stores/useAuthStore';

const Navbar = () => {
    const { user } = useAuthStore();
    const location = useLocation();

    // Check if current path matches for active state
    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <>
            {/* ============ DESKTOP TOP BAR (hidden on mobile) ============ */}
            <nav className="hidden md:flex fixed top-0 left-0 right-0 h-16 bg-black/90 backdrop-blur-md border-b border-white/10 z-50 items-center justify-between px-6">
                {/* Logo */}
                <Link to="/" className="text-2xl font-bold tracking-tighter text-white">
                    dlynbtz<span className="text-primary">.</span>
                </Link>

                {/* Desktop Links */}
                <div className="flex items-center gap-6">
                    <NavLink to="/" icon={<Home size={20} />} label="Home" />
                    <NavLink to="/explore" icon={<Search size={20} />} label="Explore" />
                    <NavLink to="/liked" icon={<Heart size={20} className="text-red-500" />} label="Liked" />
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-4">
                    {user ? (
                        <>
                            <Link to="/upload" className="btn-primary flex items-center gap-2 text-sm">
                                <Upload size={16} />
                                <span>Upload</span>
                            </Link>
                            <NavIcon to="/dashboard" icon={<LayoutDashboard size={20} />} />
                            <NavIcon to="/cart" icon={<ShoppingCart size={20} />} />
                            <NavIcon to="/inbox" icon={<MessageSquare size={20} />} />
                            <NavIcon to={`/profile/${user?.id}`} icon={<User size={20} />} />
                            <button onClick={useAuthStore.getState().logout} className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Log Out">
                                <LogOut size={20} />
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="text-neutral-400 hover:text-white font-medium transition-colors">Log In</Link>
                            <Link to="/signup" className="btn-primary text-sm">Sign Up</Link>
                        </>
                    )}
                </div>
            </nav>

            {/* ============ MOBILE BOTTOM BAR (hidden on desktop) ============ */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-black/95 backdrop-blur-md border-t border-white/10 z-50 flex items-center justify-around px-2 safe-area-pb">
                <MobileNavIcon to="/" icon={<Home size={22} />} label="Home" active={isActive('/')} />
                <MobileNavIcon to="/explore" icon={<Search size={22} />} label="Explore" active={isActive('/explore')} />
                <MobileNavIcon to="/liked" icon={<Heart size={22} />} label="Liked" active={isActive('/liked')} />
                {user ? (
                    <>
                        <MobileNavIcon to="/cart" icon={<ShoppingCart size={22} />} label="Cart" active={isActive('/cart')} />
                        <MobileNavIcon to="/inbox" icon={<MessageSquare size={22} />} label="Inbox" active={isActive('/inbox')} />
                        <MobileNavIcon to={`/profile/${user?.id}`} icon={<User size={22} />} label="Profile" active={isActive('/profile')} />
                    </>
                ) : (
                    <>
                        <MobileNavIcon to="/login" icon={<User size={22} />} label="Login" active={isActive('/login')} />
                    </>
                )}
            </nav>
        </>
    );
};

// Desktop NavLink with label
const NavLink = ({ to, icon, label }) => (
    <Link to={to} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
        {icon}
        <span className="font-medium">{label}</span>
    </Link>
);

// Desktop NavIcon (no label)
const NavIcon = ({ to, icon }) => (
    <Link to={to} className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-all">
        {icon}
    </Link>
);

// Mobile bottom nav icon with label
const MobileNavIcon = ({ to, icon, label, active }) => (
    <Link
        to={to}
        className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-colors ${active ? 'text-primary' : 'text-neutral-400 hover:text-white'
            }`}
    >
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
    </Link>
);

export default Navbar;
