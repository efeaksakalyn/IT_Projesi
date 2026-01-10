import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import useAuthStore from '../stores/useAuthStore';
import { formatPrice } from '../lib/formatPrice';
import { Trash2, Loader2, CreditCard } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Cart = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [checkingOut, setCheckingOut] = useState(false);

    useEffect(() => {
        fetchCart();

        const handleFocus = () => fetchCart();
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [user]);

    const fetchCart = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('cart_items')
                .select('*, beat:beats(*)')
                .eq('user_id', user.id);
            if (error) throw error;
            setCartItems(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const removeFromCart = async (itemId) => {
        await supabase.from('cart_items').delete().eq('id', itemId);
        fetchCart();
    };

    const checkout = async () => {
        if (cartItems.length === 0) return;
        setCheckingOut(true);

        // Mock Checkout: Move items to Purchases table
        try {
            const purchases = cartItems.map(item => ({
                user_id: user.id,
                beat_id: item.beat_id,
                price_paid: item.price,
                currency: item.currency,
                license_type: item.license_type,  // Use actual license from cart item
                transaction_id: `TXID_${Date.now()}`
            }));

            // Insert purchases
            const { error: purchaseError } = await supabase.from('purchases').insert(purchases);
            if (purchaseError) throw purchaseError;

            // Clear cart
            await supabase.from('cart_items').delete().eq('user_id', user.id);

            alert('Payment Successful! Beats added to your Collection.');
            navigate('/profile?tab=collection'); // Go to collection
        } catch (err) {
            console.error(err);
            alert('Checkout failed');
        } finally {
            setCheckingOut(false);
        }
    };

    const total = cartItems.reduce((acc, item) => acc + item.price, 0);

    if (loading) return <div className="pt-24 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="pt-24 pb-24 container mx-auto px-6 max-w-4xl">
            <h1 className="text-3xl font-heading font-bold mb-8">Shopping Cart</h1>

            {cartItems.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Items List */}
                    <div className="lg:col-span-2 space-y-4">
                        {cartItems.map(item => (
                            <div key={item.id} className="bg-surface p-4 rounded-xl border border-white/5 flex items-center gap-4">
                                <div className="w-20 h-20 bg-neutral-800 rounded overflow-hidden flex-shrink-0">
                                    <img src={item.beat?.cover_url} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold">{item.beat?.title || 'Unknown Beat'}</h3>
                                    <p className="text-xs text-neutral-400">{item.license_type}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-primary">{formatPrice(item.price, item.currency)}</p>
                                    <button
                                        onClick={() => removeFromCart(item.id)}
                                        className="text-xs text-neutral-500 hover:text-red-500 mt-2 flex items-center justify-end gap-1"
                                    >
                                        <Trash2 size={12} /> Remove
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Summary */}
                    <div className="bg-surface p-6 rounded-xl border border-white/5 h-fit shadow-2xl">
                        <h3 className="font-bold text-lg mb-4">Order Summary</h3>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-neutral-400">Subtotal</span>
                            <span className="font-bold">{formatPrice(total)}</span>
                        </div>
                        <div className="border-t border-white/10 my-4 pt-4 flex justify-between items-center text-xl font-bold">
                            <span>Total</span>
                            <span className="text-primary">{formatPrice(total)}</span>
                        </div>
                        <button
                            onClick={checkout}
                            disabled={checkingOut}
                            className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2 text-lg font-bold"
                        >
                            {checkingOut ? <Loader2 className="animate-spin" /> : <><CreditCard size={20} /> Checkout</>}
                        </button>

                    </div>
                </div>
            ) : (
                <div className="text-center py-20 text-neutral-500">
                    <p className="mb-4">Your cart is empty.</p>
                    <Link to="/explore" className="btn-primary inline-block">Explore Beats</Link>
                </div>
            )}
        </div>
    );
};

export default Cart;
