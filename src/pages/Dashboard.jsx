import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import useAuthStore from '../stores/useAuthStore';
import { formatPrice } from '../lib/formatPrice';
import { ArrowLeft, DollarSign, TrendingUp, Music, Loader2, Download, X, Wallet, ArrowUpRight, ArrowDownRight, Eye, EyeOff, Trash2 } from 'lucide-react';

const Dashboard = () => {
    const navigate = useNavigate();
    const { user, profile, fetchProfile } = useAuthStore();
    const [sales, setSales] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [myBeats, setMyBeats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalEarnings: 0, totalSales: 0, balance: 0 });

    // Withdrawal Modal
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawing, setWithdrawing] = useState(false);
    const [withdrawError, setWithdrawError] = useState('');

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch my beats (including hidden ones for management)
                const { data: myBeats } = await supabase
                    .from('beats')
                    .select('id, title, cover_url, audio_url, is_visible, created_at')
                    .eq('producer_id', user.id)
                    .order('created_at', { ascending: false });

                setMyBeats(myBeats || []);

                let salesData = [];
                let totalEarnings = 0;

                if (myBeats && myBeats.length > 0) {
                    const beatIds = myBeats.map(b => b.id);

                    // Fetch purchases for my beats
                    // SCHEMA: purchases table has license_type and price_paid columns (from fix3.sql)
                    const { data: purchasesData } = await supabase
                        .from('purchases')
                        .select('id, beat_id, user_id, price_paid, currency, license_type, created_at, beat:beats(id, title, cover_url)')
                        .in('beat_id', beatIds)
                        .order('created_at', { ascending: false });

                    salesData = purchasesData || [];
                    // Sum price_paid from purchases table for total earnings
                    totalEarnings = salesData.reduce((sum, s) => sum + parseFloat(s.price_paid || 0), 0);
                }

                // 4. Fetch transaction history FIRST (needed for balance calc)
                const { data: txData } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                setSales(salesData);

                // Calculate withdrawals total
                const totalWithdrawals = (txData || [])
                    .filter(t => t.type === 'withdrawal')
                    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

                // Calculate Available Balance = Total Earnings - Total Withdrawals
                const calculatedBalance = totalEarnings - totalWithdrawals;

                setStats({
                    totalEarnings,
                    totalSales: salesData.length,
                    balance: calculatedBalance > 0 ? calculatedBalance : 0
                });

                setTransactions(txData || []);
            } catch (err) {
                console.error("Dashboard error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, navigate]);

    const handleWithdraw = async () => {
        setWithdrawError('');
        const amount = parseFloat(withdrawAmount);

        // Validation
        if (isNaN(amount) || amount <= 0) {
            setWithdrawError('Please enter a valid amount');
            return;
        }
        if (amount < 15) {
            setWithdrawError('Minimum withdrawal is $15.00');
            return;
        }
        if (amount > stats.balance) {
            setWithdrawError('Insufficient balance');
            return;
        }

        setWithdrawing(true);
        try {
            // WITHDRAWAL STEP 1: Deduct from profiles.balance in Supabase
            const newBalance = stats.balance - amount;
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ balance: newBalance })
                .eq('id', user.id);

            if (updateError) throw updateError;

            // WITHDRAWAL STEP 2: Insert withdrawal record into transactions table
            const { error: txError } = await supabase
                .from('transactions')
                .insert({
                    user_id: user.id,
                    amount: amount,
                    type: 'withdrawal',  // Type: 'withdrawal' = subtract, 'sale' = add
                    status: 'completed'
                });

            if (txError) throw txError;

            // 3. Update local state
            setStats(prev => ({ ...prev, balance: newBalance }));
            setTransactions(prev => [{
                id: Date.now(),
                amount,
                type: 'withdrawal',
                status: 'completed',
                created_at: new Date().toISOString()
            }, ...prev]);

            alert('Funds withdrawn successfully!');
            setShowWithdrawModal(false);
            setWithdrawAmount('');
        } catch (err) {
            console.error("Withdrawal error:", err);
            setWithdrawError('Withdrawal failed. Please try again.');
        } finally {
            setWithdrawing(false);
        }
    };

    /**
     * Toggle Beat Visibility (is_visible column from fix8.sql)
     * NO loading spinner - silent UI update
     */
    const toggleBeatVisibility = async (beatId, currentVisibility) => {
        const newVisibility = !currentVisibility;

        // Update UI instantly (silent, no spinner)
        setMyBeats(prev => prev.map(b =>
            b.id === beatId ? { ...b, is_visible: newVisibility } : b
        ));

        // Update database
        const { error } = await supabase
            .from('beats')
            .update({ is_visible: newVisibility })
            .eq('id', beatId);

        if (error) {
            console.error('Visibility toggle error:', error);
            // Revert on error
            setMyBeats(prev => prev.map(b =>
                b.id === beatId ? { ...b, is_visible: currentVisibility } : b
            ));
        }
    };

    /**
     * Hard Delete Beat with Storage Cleanup
     * Removes audio from beat-files, image from cover-arts, then database record
     */
    const deleteBeatPermanently = async (beat) => {
        const confirmed = window.confirm(
            `⚠️ PERMANENTLY DELETE "${beat.title}"?\n\nThis will:\n• Remove the audio file\n• Remove the cover art\n• Delete all data\n\nThis action cannot be undone.`
        );

        if (!confirmed) return;

        // Update UI instantly (silent, no spinner)
        setMyBeats(prev => prev.filter(b => b.id !== beat.id));

        try {
            // 1. Delete audio from storage
            if (beat.audio_url) {
                const audioPath = beat.audio_url.split('/beat-files/')[1];
                if (audioPath) {
                    await supabase.storage.from('beat-files').remove([decodeURIComponent(audioPath)]);
                }
            }

            // 2. Delete cover from storage
            if (beat.cover_url) {
                const coverPath = beat.cover_url.split('/cover-arts/')[1];
                if (coverPath) {
                    await supabase.storage.from('cover-arts').remove([decodeURIComponent(coverPath)]);
                }
            }

            // 3. Delete database record
            const { error } = await supabase.from('beats').delete().eq('id', beat.id);

            if (error) throw error;

            console.log('Beat deleted successfully:', beat.id);
        } catch (error) {
            console.error('Delete error:', error);
            // Restore to UI on error
            setMyBeats(prev => [...prev, beat]);
            alert('Failed to delete beat. Please try again.');
        }
    };

    if (loading) return <div className="pt-24 flex justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;

    return (
        <div className="pt-24 pb-24 container mx-auto px-6">
            {/* Withdraw Modal */}
            {showWithdrawModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowWithdrawModal(false)}>
                    <div className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl flex items-center gap-2">
                                <Wallet className="text-green-500" /> Withdraw Funds
                            </h3>
                            <button onClick={() => setShowWithdrawModal(false)} className="text-neutral-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm text-neutral-400 mb-2">Available Balance</p>
                            <p className="text-3xl font-bold text-green-500">{formatPrice(stats.balance, 'USD')}</p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm text-neutral-400 mb-2">Withdrawal Amount (Min: $15.00)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">$</span>
                                <input
                                    type="number"
                                    min="15"
                                    step="0.01"
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full bg-neutral-800 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white focus:border-primary focus:outline-none"
                                />
                            </div>
                            {withdrawError && <p className="text-red-500 text-sm mt-2">{withdrawError}</p>}
                        </div>

                        <button
                            onClick={handleWithdraw}
                            disabled={withdrawing}
                            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 py-4 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {withdrawing ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                            {withdrawing ? 'Processing...' : 'Withdraw'}
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="p-2 bg-neutral-800 rounded-full hover:bg-neutral-700 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-3xl font-heading font-black">Producer Dashboard</h1>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                <div className="bg-surface border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <TrendingUp className="text-blue-500" size={24} />
                        </div>
                        <div>
                            <p className="text-neutral-400 text-sm">All-Time Earnings</p>
                            <p className="text-2xl font-bold text-blue-500">{formatPrice(stats.totalEarnings, 'USD')}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-surface border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                            <Wallet className="text-green-500" size={24} />
                        </div>
                        <div>
                            <p className="text-neutral-400 text-sm">Available Balance</p>
                            <p className="text-2xl font-bold text-green-500">{formatPrice(stats.balance, 'USD')}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-surface border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                            <Music className="text-primary" size={24} />
                        </div>
                        <div>
                            <p className="text-neutral-400 text-sm">Total Sales</p>
                            <p className="text-2xl font-bold">{stats.totalSales}</p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setShowWithdrawModal(true)}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-2xl p-6 flex items-center justify-center gap-3 font-bold text-lg transition-all"
                >
                    <Download size={24} />
                    Withdraw Funds
                </button>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sales History */}
                <div className="bg-surface border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-white/10">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <DollarSign size={20} className="text-green-500" /> Sales History
                        </h2>
                    </div>

                    {sales.length === 0 ? (
                        <div className="p-12 text-center text-neutral-500">
                            <p>No sales yet. Keep producing fire beats! 🔥</p>
                        </div>
                    ) : (
                        <div className="max-h-96 overflow-y-auto">
                            {sales.map((sale, index) => (
                                <div key={sale.id || index} className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-neutral-800 rounded overflow-hidden">
                                            <img src={sale.beat?.cover_url || '/placeholder-cover.jpg'} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <p className="font-medium">{sale.beat?.title || 'Unknown Beat'}</p>
                                            <span className={`text-xs px-2 py-0.5 rounded ${sale.license_type === 'Exclusive' ? 'bg-red-500/20 text-red-400' :
                                                sale.license_type === 'WAV Lease' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-neutral-700 text-neutral-300'
                                                }`}>
                                                {sale.license_type}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-green-500 font-bold">+{formatPrice(sale.price_paid, 'USD')}</p>
                                        <p className="text-xs text-neutral-500">{new Date(sale.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Transaction History */}
                <div className="bg-surface border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-white/10">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Wallet size={20} className="text-primary" /> Transaction History
                        </h2>
                    </div>

                    {transactions.length === 0 ? (
                        <div className="p-12 text-center text-neutral-500">
                            <p>No transactions yet.</p>
                        </div>
                    ) : (
                        <div className="max-h-96 overflow-y-auto">
                            {transactions.map((tx, index) => (
                                <div key={tx.id || index} className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'sale' ? 'bg-green-500/20' : 'bg-red-500/20'
                                            }`}>
                                            {tx.type === 'sale' ? (
                                                <ArrowDownRight className="text-green-500" size={20} />
                                            ) : (
                                                <ArrowUpRight className="text-red-500" size={20} />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium capitalize">{tx.type}</p>
                                            <p className="text-xs text-neutral-500">{tx.status}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold ${tx.type === 'sale' ? 'text-green-500' : 'text-red-500'}`}>
                                            {tx.type === 'sale' ? '+' : '-'}{formatPrice(tx.amount, 'USD')}
                                        </p>
                                        <p className="text-xs text-neutral-500">{new Date(tx.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* My Beats Management - Producer can toggle visibility and delete */}
                <div className="bg-surface border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-white/10">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Music size={20} className="text-primary" /> My Beats Management
                        </h2>
                        <p className="text-sm text-neutral-500 mt-1">Toggle visibility or permanently delete your beats</p>
                    </div>

                    {myBeats.length === 0 ? (
                        <div className="p-12 text-center text-neutral-500">
                            <p>No beats uploaded yet.</p>
                            <Link to="/upload" className="text-primary hover:underline mt-2 inline-block">Upload your first beat →</Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {myBeats.map(beat => (
                                <div key={beat.id} className={`flex items-center justify-between p-4 hover:bg-white/5 transition-colors ${!beat.is_visible ? 'opacity-60' : ''}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                                            {beat.cover_url ? (
                                                <img src={beat.cover_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Music size={20} className="text-neutral-600" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <Link to={`/beats/${beat.id}`} className="font-medium hover:text-primary transition-colors">
                                                {beat.title}
                                            </Link>
                                            <div className="flex items-center gap-2 mt-1">
                                                {!beat.is_visible && (
                                                    <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded font-bold">HIDDEN</span>
                                                )}
                                                <span className="text-xs text-neutral-500">
                                                    {new Date(beat.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Visibility Toggle Button */}
                                        <button
                                            onClick={() => toggleBeatVisibility(beat.id, beat.is_visible)}
                                            className={`p-2 rounded-lg transition-colors ${beat.is_visible ? 'bg-neutral-800 hover:bg-neutral-700 text-white' : 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500'}`}
                                            title={beat.is_visible ? 'Hide from public' : 'Make visible'}
                                        >
                                            {beat.is_visible ? <Eye size={18} /> : <EyeOff size={18} />}
                                        </button>
                                        {/* Delete Button */}
                                        <button
                                            onClick={() => deleteBeatPermanently(beat)}
                                            className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-500 transition-colors"
                                            title="Permanently delete"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
