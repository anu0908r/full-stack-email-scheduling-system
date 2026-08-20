# ReachInbox — Design System

## Overview

ReachInbox is a production-grade distributed email scheduling and SMTP infrastructure. The visual language follows an **architectural blueprint** aesthetic — combining editorial typography, structural borders, and drafting-grid patterns to communicate engineering rigor rather than conventional SaaS polish.

---

## Color System

### Core Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Canvas | `#F3ECE5` | Primary background (warm paper) |
| Surface Paper | `#F7F1EB` | Cards, modals, containers |
| Surface Layer | `#E8DDD3` | Layered elements, secondary surfaces |
| Grid Line | `#E1D4C8` | Drafting grid pattern lines |
| Ink | `#1F2736` | Primary text, borders, headings |
| Ink Soft | `#445166` | Secondary text, descriptions |
| Ink Muted | `#798392` | Captions, placeholders |
| Accent | `#D63A35` | Primary CTA, active states, highlights |
| Accent Soft | `#E86A65` | Hover states, secondary accent |
| Dark Surface | `#1F232B` | Footer, dark panels |

### Color Rules

- Accent color is used sparingly — it gains power through rarity
- Text readability always comes first
- The platform feels warm — avoid cold grays, bright blues, neon colors

---

## Typography

### Display Typeface

**Libre Bodoni** (with fallbacks: Cormorant Garamond, EB Garamond, Playfair Display)

Used for:
- Headings and section titles
- Hero statements
- Metric counters

Characteristics: Editorial, elegant, confident, timeless.

### Body Typeface

**Manrope** (with fallback: Inter)

Used for:
- Navigation labels
- Table content
- Form inputs
- Status badges
- Technical metadata

Characteristics: Neutral, technical, highly readable.

### Typography Scale

| Element | Size | Weight | Case |
|---------|------|--------|------|
| Hero heading | 48-64px | 700 | UPPERCASE |
| Section heading | 24-32px | 700 | UPPERCASE |
| Table header | 11px | 700 | UPPERCASE |
| Body text | 13-14px | 400-500 | Normal |
| Status badge | 10px | 700 | UPPERCASE |
| Caption | 11px | 400 | Normal |

---

## Layout System

### Grid

Desktop: 12-column grid with 40px drafting grid background pattern.

```css
.bg-drafting-grid {
  background-image:
    linear-gradient(#E1D4C8 1px, transparent 1px),
    linear-gradient(90deg, #E1D4C8 1px, transparent 1px);
  background-size: 40px 40px;
}
```

### Maximum Width

- Dashboard content: `max-w-7xl` (1280px)
- Modal dialogs: `max-w-3xl` / `max-w-2xl`
- Form inputs: Full width within their container

### Spacing

Base unit: 4px. Scale: 4, 8, 12, 16, 24, 32, 48, 64.

---

## Component System

### Borders (Neo-Brutalist / Architectural)

All structural elements use 3px solid ink borders with offset box-shadows:

```css
.border-blueprint {
  border: 3px solid #1F2736;
  box-shadow: 4px 4px 0px #1F2736;
}

.border-blueprint-sm {
  border: 2px solid #1F2736;
  box-shadow: 2px 2px 0px #1F2736;
}
```

### Interactive Borders

Buttons and clickable elements use transform-based hover feedback:

```css
.border-blueprint-interactive {
  border: 3px solid #1F2736;
  box-shadow: 4px 4px 0px #1F2736;
  transition: all 0.15s ease-in-out;
}

.border-blueprint-interactive:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0px #1F2736;
}
```

### Buttons

**Primary (Accent)**
- Background: `#D63A35`
- Text: White
- Used for: "COMPOSE NEW EMAIL", "SCHEDULE N EMAILS"

**Secondary (Neutral)**
- Background: `#E8DDD3`
- Text: `#1F2736`
- Used for: "CONFIGURE SENDERS", "REFRESH QUEUE", "CANCEL"

**Dark**
- Background: `#1F2736`
- Text: `#F3ECE5`
- Used for: Header logout, table headers

### Cards / Containers

All content containers use:
- Background: `#F7F1EB`
- Border: 3px solid `#1F2736`
- Box-shadow: 4px 4px offset

### Tables

- Header row: Dark background (`#1F2736`) with light text
- Body rows: Alternating hover with `#E8DDD3` tint
- Cell borders: 2px solid `#1F2736`
- Monospace font for technical data

### Status Badges

| Status | Background | Text | Border |
|--------|-----------|------|--------|
| SCHEDULED | `#DBEAFE` (blue-200) | `#1E3A5F` (blue-900) | `#1F2736` |
| PROCESSING | `#FDE047` (amber-400) | `#1F2736` | `#1F2736` + pulse animation |
| SENT | `#BBF7D0` (emerald-200) | `#064E3B` (emerald-900) | `#047857` (emerald-700) |
| FAILED | `#FECACA` (red-200) | `#7F1D1D` (red-900) | `#B91C1C` (red-700) |

### Forms

- Input height: ~40px
- Background: `#F3ECE5`
- Border: 2px solid `#1F2736`
- Focus ring: border changes to `#D63A35`
- Labels: 11px uppercase monospace, bold

### Modals

- Backdrop: `#1F2736` at 70% opacity with `backdrop-blur-xs`
- Container: `#F7F1EB` with blueprint border
- Header with title + close button
- Close button: Dark background, hover turns accent

---

## Navigation

### Header

- Sticky top, z-index 40
- Background: `#F7F1EB`
- Bottom border: 4px solid `#1F2736`
- Contains: Brand logo, system identifier, user identity, logout

### Tab Navigation

- Background: `#E8DDD3` container
- Active tab: `#1F2736` background, `#F3ECE5` text
- Inherit tab: Transparent, hover shows `#F3ECE5` background
- Monospace font, 11px, uppercase, bold

---

## Footer

- Background: `#1F232B` (dark surface)
- Border-top: 4px solid `#1F2736`
- Text: `#F3ECE5` (light)
- Contains: Brand name (accent color), system description

---

## Animation

- Spin animation on loading indicators (border spinner)
- Pulse animation on PROCESSING status badges
- Smooth transitions on interactive borders (150ms ease)
- No excessive motion — everything is purposeful

---

## Responsive

- Mobile: Single column, stacked layout
- Tablet: Two-column grid for metrics
- Desktop: Full 4-column metric grid, side-by-side tables

---

## Design Principles

1. **Engineering Over Decoration** — Every visual element communicates structure and reliability
2. **Blueprint Aesthetic** — Drafting grids, structural borders, offset shadows create depth
3. **Editorial Typography** — Serif headings create identity; monospace labels create technical clarity
4. **Warm Paper Surfaces** — Never pure white; warm tones build trust
5. **Accent Through Rarity** — Red accent gains power by appearing only in CTAs and active states
6. **Content Is Hero** — Data tables and email records are the primary content, not decorative elements
