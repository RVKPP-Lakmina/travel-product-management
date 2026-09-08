# Travel Product Management System - UI/UX Architecture

## 1. Core Aesthetic & Brand

- **Vibe:** Professional, Premium, Fast, Calm, Intelligent, Trustworthy.
- **Inspiration:** Linear, Vercel, Stripe Dashboard.
- **Anti-Patterns (DO NOT USE):** Excessive gradients, huge drop shadows, neon effects, glassmorphism, generic ShadCN template look, cartoon-like UI.

## 2. Color System

- **Primary:** Deep Teal `#0F766E`
- **AI Accent:** Warm Amber `#F59E0B` (RESERVED STRICTLY FOR AI FEATURES)
- **Semantic Success:** Green `#16A34A`
- **Semantic Warning:** Amber `#D97706`
- **Semantic Danger:** Red `#DC2626`
- **Semantic Inactive:** Slate `#64748B`
- **Text (Light Mode):** Slate `#0F172A`
- **Background (Light Mode):** Slate `#F8FAFC`
  _Note: Support both light and dark themes maintaining WCAG AA contrast._

## 3. Typography (Font: Inter)

- **Display:** 30px/36px, Semibold (600)
- **H1:** 24px/32px, Semibold (600)
- **H2:** 18px/28px, Semibold (600)
- **Body:** 14px/20px, Regular (400)
- **Stats/Numbers:** 32px/40px, Semibold (600) -> MUST use `tabular-nums` for alignment.

## 4. Geometry & Spacing

- **Spacing System:** Strict 4px grid (`gap-4`, `p-6`, `mb-8`, etc.). No arbitrary values.
- **Border Radius:** Cards: 10px, Inputs/Buttons: 8px, Badges: 6px, Pills: 9999px.
- **Shadows:** Extremely subtle. Use only `shadow-sm` and `shadow-md`. NO glows or colored shadows.
- **Borders:** Use intentionally (e.g., `border-slate-200`) to separate sections, not to wrap every single element.

## 5. The AI Motif (CRITICAL)

- **Visual Rule:** AI is the most important motif. It must be recognizable but subtle.
- **AI Badge:** An SVG Warm Amber Sparkle icon (NOT a text emoji) + "AI Generated" text or tooltip.
- **Uncertainty State:** Fields the AI couldn't fill get a subtle amber focus ring and a "Needs your input" caption.
- **AI Thinking:** Shimmer/skeleton animation + "Analyzing..." text. No generic spinners.

## 6. Layout & Breakpoints

Design must explicitly target and adapt to: 375px, 768px, 1280px, 1440px.

- **Desktop (≥1280px):** Sidebar is fixed 256px rail. Tables are standard data tables.
- **Tablet (768px):** Sidebar collapses to 64px icon rail. Form layouts collapse to single column. Modals become full-height bottom sheets.
- **Mobile (375px):** Sidebar becomes fixed bottom tab bar + hamburger sheet menu. Data tables morph into stacked cards. Touch targets minimum 44px. NEVER horizontally scroll the page body.

## 7. Component Rules

- **Buttons:** Need distinct default, hover, focus-visible, loading, and disabled states.
- **Data Tables:** Sticky headers, row hover, compact height, right-aligned numbers/prices.
- **Status Badges:** Never communicate state using color alone. Always combine color dot/background with text (e.g., 🟢 Active).
