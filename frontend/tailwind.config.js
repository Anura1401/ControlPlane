/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#09090b',
        darkSurface: '#18181b',
        darkBorder: '#27272a',
        darkTextPrimary: '#f4f4f5',
        darkTextSecondary: '#a1a1aa',
        riskLow: '#22c55e',
        riskMedium: '#eab308',
        riskHigh: '#f97316',
        riskCritical: '#ef4444',
      }
    },
  },
  plugins: [],
}
