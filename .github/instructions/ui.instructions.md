---
name: merchant-ui
description: UI standard for the GoServe merchant (restaurant partner) app. Use whenever building or changing any merchant screen, component, layout, colour, icon, empty/loading/error state, or the orders, menu, earnings, insights or store pages, so the result looks like a professional real-world partner app.
---

# Merchant UI standard

Goal: a calm, dense-but-readable operations tool that a busy kitchen can use at a glance.
It should look like Zomato Restaurant Partner or Uber Eats Manager, not like a template or a demo.

## 1. Principles
1. Speed over decoration. The merchant is cooking. Every primary action is one tap.
2. Status is obvious. Colour, label and position all say what needs attention.
3. Consistency. Same spacing, radius, type and component for the same job everywhere.
4. Honest states. Never show fake data, fake riders or fake GPS. Show real empty states.
5. Calm by default, loud only for new orders and problems.

## 2. Design tokens (define once in `:root`, never hard-code values)
Keep the GoServe brand (deep green + lime) but make surfaces light by default for kitchen readability.
Provide a dark theme through `prefers-color-scheme` and a manual toggle.

Colour (light):
- `--bg: #f5f7f4` page background
- `--surface: #ffffff` cards
- `--surface-2: #eef2ec` subtle fills
- `--border: #dfe5dc`
- `--text: #101a13` primary text (contrast >= 7:1 on surface)
- `--text-muted: #5b6b60` secondary text (contrast >= 4.5:1)
- `--brand: #0f3d24` deep green: headers, primary text on light
- `--accent: #b8f542` lime: highlights only, never as text on white
- `--primary: #1a7f46` primary buttons (white text, contrast >= 4.5:1)
- `--info: #1d6fd1`, `--warning: #b86e00`, `--danger: #c8372d`, `--success: #1a7f46`
- Each semantic colour needs a `-bg` tint (e.g. `--danger-bg: #fdecea`) for badges and alerts.

Order status colours (use consistently on cards, badges, board columns):
- New = info blue, Preparing = warning amber, Ready = success green, Picked up = neutral grey,
  Rejected/Cancelled = danger red.

Type: Inter (system fallback). Scale 12 / 14 / 16 / 20 / 24 / 32. Body 14-16, weights 400/500/600/700 only.
Order numbers and prices use tabular numerals (`font-variant-numeric: tabular-nums`).
Line height 1.4 body, 1.2 headings. No more than 3 sizes on one card.

Spacing: 4px grid (4, 8, 12, 16, 24, 32, 48). Card padding 16 (mobile) / 20 (desktop).
Radius: 8 inputs and buttons, 12 cards, 999 pills. Shadows: one subtle (`0 1px 2px rgba(16,26,19,.06)`) and
one raised (`0 8px 24px rgba(16,26,19,.12)`) for dialogs only.

## 3. Layout
- Mobile (<768px): top app bar + bottom tab bar (Orders, Menu, Earnings, Insights, Store). Safe-area padding.
- Tablet/desktop (>=768px): fixed left sidebar (240px, collapsible to icons) + content max-width 1200px.
- App bar: restaurant name, online/offline switch, busy mode, connection dot, notification bell, avatar menu.
- Orders page on desktop is a kanban board (New | Preparing | Ready | Completed). On mobile it is tabs with count badges.
- Touch targets >= 48px for kitchen actions, >= 44px elsewhere. Primary action sits at the bottom of a card/sheet.
- Use bottom sheets on mobile and centred dialogs on desktop for pickers (prep time, reject reason).

## 4. Components (build once, reuse)
Button (primary, secondary, ghost, danger; sizes md/lg; loading state with spinner; disabled state),
IconButton, Switch, Badge/Pill, Card, Tabs, SegmentedControl, Input, Select, Textarea, Stepper (qty),
Toast, Dialog, BottomSheet, Table (sticky header, responsive to cards), Skeleton, EmptyState, ErrorState,
Banner (offline, store closed, verification pending), Avatar, Countdown, StatCard, Chart wrapper.

Order card anatomy (new order):
- Row 1: `#4821` (bold) | placed time | payment badge (Paid / COD).
- Row 2: customer first name + order type (Delivery).
- Items list: `2 x Chicken Biryani (Full)` with add-ons indented in muted text. Notes in an amber highlighted box.
- Footer: total (right-aligned, tabular), countdown ring/bar to auto-reject, then Reject (secondary) and Accept (primary, lg).
- Whole card must be scannable in under 2 seconds. No more than one primary button.

Online/offline switch: large, labelled ("Online - accepting orders" / "Offline"), green when on, grey when off.
Offline asks for a reason and duration in a sheet.

## 5. Icons and imagery
- One icon set only: Lucide (SVG, 20px default, 1.75 stroke, `currentColor`). Never emoji as icons.
- Food photos: 4:3 crop, `object-fit: cover`, `loading="lazy"`, blurred or coloured placeholder, alt text = item name.
- Veg / non-veg marker: the standard bordered square with a dot (green / red). Make it a small reusable component.

## 6. Required states for every screen
- Loading: skeletons that match the final layout, never a lone spinner for a whole page.
- Empty: icon, one sentence, one action (e.g. "No new orders. You're online and ready." / "Add your first item").
- Error: what failed in plain words + Retry. Keep user input.
- Offline: top banner, disable actions that need the network, queue safe ones.
- Store closed / unverified: persistent banner explaining why and what to do.

## 7. Feedback and motion
- Motion 150-200ms ease-out, only for state change (sheet open, card moving column, toast). Respect `prefers-reduced-motion`.
- Buttons show pressed and loading states and block double submit.
- Destructive or irreversible actions (reject, delete item, remove staff) ask for confirmation or offer Undo toast (5s).
- New order: repeating sound until actioned, tab title flash `(1) New order`, focus moves to the card, `aria-live="assertive"` announcement.
- Toasts bottom-center on mobile, top-right on desktop, max 3 at once, auto-dismiss 4s (errors stay until closed).

## 8. Accessibility (non-negotiable)
- WCAG AA contrast, visible 2px focus ring offset 2px, full keyboard operation, logical tab order.
- Every icon-only button has an `aria-label`. Form fields have visible labels and error text linked with `aria-describedby`.
- Colour is never the only status signal: always add a text label or icon.
- Respect user font scaling up to 200% without breaking layout.

## 9. Content and copy
- Short, direct, merchant-friendly language. "Accept order", "Mark ready", "Out of stock today".
- INR with the rupee symbol and Indian grouping (`₹1,24,500`). 12-hour times with am/pm. Relative times ("2 min ago") under 1 hour.
- Never expose internal terms (state machine names, IDs) to the user.

## 10. Anti-patterns (do not do these)
- Emoji as icons; neon lime on white; gradients or glassmorphism for decoration; centered hero text in an ops tool.
- Placeholder cards saying "coming soon"; lorem ipsum; fake data presented as real.
- Tiny tap targets; low-contrast grey text; more than one primary button per card; modals stacked on modals.
- Horizontal scrolling on mobile; layout shift when data loads; tables that overflow instead of collapsing to cards.
- Inline styles and magic numbers. Use tokens and shared classes.

## 11. Review checklist (run before saying a screen is done)
1. Screenshots at 360, 768 and 1280px reviewed, no overflow, no layout shift.
2. All five states present (loading, empty, error, offline, normal).
3. Tokens only: no hard-coded colours, sizes or fonts.
4. Keyboard pass and contrast pass done; icon buttons labelled.
5. Primary action obvious; status readable in 2 seconds; copy is plain.
6. No console errors; actions are idempotent and block double taps.
