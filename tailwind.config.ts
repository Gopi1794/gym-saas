import type { Config } from "tailwindcss"
import animate from "tailwindcss-animate"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans:    ["var(--font-inter)",  "Inter",       "sans-serif"],
        display: ["var(--font-anton)",  "Anton",       "sans-serif"],
        heading: ["var(--font-bebas)",  "Bebas Neue",  "sans-serif"],
      },
      colors: {
        brand: {
          "50":  "#fff1f1",
          "100": "#ffe1e1",
          "200": "#ffc7c7",
          "300": "#ff9d9d",
          "400": "#ff6464",
          "500": "#ff2222",
          "600": "#e51111",
          "700": "#d50000",
          "800": "#a30000",
          "900": "#7c0000",
          "950": "#500000",
          DEFAULT: "#d50000",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        moveHorizontal: {
          "0%":   { transform: "translateX(-50%) translateY(-10%)" },
          "50%":  { transform: "translateX(50%) translateY(10%)" },
          "100%": { transform: "translateX(-50%) translateY(-10%)" },
        },
        moveInCircle: {
          "0%":   { transform: "rotate(0deg)" },
          "50%":  { transform: "rotate(180deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        moveVertical: {
          "0%":   { transform: "translateY(-50%)" },
          "50%":  { transform: "translateY(50%)" },
          "100%": { transform: "translateY(-50%)" },
        },
        waves: {
          "0%":   { transform: "translateY(-170px)" },
          "100%": { transform: "translateY(0px)" },
        },
        "float-bolt": {
          "0%, 100%": { transform: "translateY(0) rotate(-5deg)", opacity: "0.4" },
          "50%":      { transform: "translateY(-28px) rotate(5deg)", opacity: "0.9" },
        },
        "ekg-pulse": {
          "0%, 100%": { opacity: "0.07" },
          "50%":      { opacity: "0.45" },
        },
        "ring-ping": {
          "0%":   { transform: "scale(0.6)", opacity: "0.7" },
          "100%": { transform: "scale(2.8)", opacity: "0" },
        },
        "ekg-scan": {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-192px)" },
        },
        "hex-pulse": {
          "0%, 100%": { opacity: "0.15" },
          "50%":      { opacity: "0.75" },
        },
        "float-hex": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-14px)" },
        },
        "scan-x": {
          "0%":   { transform: "translateX(-60px)" },
          "100%": { transform: "translateX(440px)" },
        },
        "border-glow-green": {
          "0%, 100%": { boxShadow: "0 0 0 1px rgba(52,211,153,0.25), 0 0 10px rgba(52,211,153,0.10)" },
          "50%":      { boxShadow: "0 0 0 1px rgba(52,211,153,0.65), 0 0 20px rgba(52,211,153,0.25)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        first:        "moveVertical 30s ease infinite",
        second:       "moveInCircle 20s reverse infinite",
        third:        "moveInCircle 40s linear infinite",
        fourth:       "moveHorizontal 40s ease infinite",
        fifth:        "moveInCircle 20s ease infinite",
        waves:        "waves 8s linear infinite",
        "float-bolt": "float-bolt 4s ease-in-out infinite",
        "ekg-pulse":  "ekg-pulse 3s ease-in-out infinite",
        "ring-ping":  "ring-ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite",
        "ekg-scan":   "ekg-scan 5s linear infinite",
        "hex-pulse":  "hex-pulse 3s ease-in-out infinite",
        "float-hex":  "float-hex 3s ease-in-out infinite",
        "scan-x":             "scan-x 4s ease-in-out infinite",
        "border-glow-green":  "border-glow-green 2s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
}

export default config
