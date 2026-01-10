export const formatPrice = (price, currency = 'USD') => {
    // Only USD logic requested by user ("sadece dolar bırakmak lazım")
    return `$${parseFloat(price).toFixed(2)}`;
};
