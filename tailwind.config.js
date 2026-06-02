/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Safelist dynamic/arbitrary classes that Tailwind can't detect at build time
  safelist: [
    // Scale
    { pattern: /^scale-\[/ },
    { pattern: /^hover:scale-\[/ },
    { pattern: /^active:scale-\[/ },
    // Opacity
    { pattern: /^opacity-/ },
    // Z-index
    { pattern: /^z-\[/ },
    // Translate
    { pattern: /^translate-/ },
    { pattern: /^-translate-/ },
    // Colors with opacity
    { pattern: /^bg-\[/ },
    { pattern: /^text-\[/ },
    { pattern: /^border-\[/ },
    { pattern: /^shadow-\[/ },
    // Animations
    'animate-fade-in',
    'animate-fade-in-up',
    'animate-bounce-in',
    'animate-slide-up',
    'animate-slide-down-out',
    'animate-marquee-up',
    'animate-marquee-down',
    'animate-dropdown-in',
    'animate-ripple',
    'animate-success-pop',
    'animate-shake',
    'animate-pulse-badge',
    'animate-card-appear',
    'animate-check-path',
    'animate-spin',
    'animate-bounce',
    'animate-pulse',
    // Backdrop
    { pattern: /^backdrop-blur-/ },
    // Transitions
    { pattern: /^transition-/ },
    { pattern: /^duration-/ },
    { pattern: /^ease-\[/ },
  ],
}
