import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, MessageSquare, User, Upload, Settings, Home, Search, LogOut, Heart, LayoutDashboard } from 'lucide-react';

import useAuthStore from '../../stores/useAuthStore';

const Navbar = () => {
    const { user } = useAuthStore();

    return (
        <nav className="fixed top-0 left-0 right-0 h-16 bg-black/90 backdrop-blur-md border-b border-white/10 z-50 flex items-center justify-between px-6">
            {/* Logo */}
            <Link to="/" className="text-2xl font-bold tracking-tighter text-white">
                dlynbtz<span className="text-primary">.</span>
            </Link>

            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-6">
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
                        <button onClick={useAuthStore.getState().signOut} className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Log Out">
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
    );
};

const NavLink = ({ to, icon, label }) => (
    <Link to={to} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
        {icon}
        <span className="font-medium">{label}</span>
    </Link>
);

const NavIcon = ({ to, icon }) => (
    <Link to={to} className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-all">
        {icon}
    </Link>
);

export default Navbar;
