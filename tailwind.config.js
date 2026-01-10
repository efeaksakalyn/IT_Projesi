/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class', // We will force dark mode anyway, but 'class' gives control
    theme: {
        extend: {
            colors: {
                primary: '#FF0000',
                bg: '#0a0a0a',
                surface: '#121212',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                heading: ['Outfit', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
