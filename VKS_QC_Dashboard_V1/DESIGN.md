# VKS Design System — iOS 26 Liquid Glass

> **Single source of truth** for all VKS frontend implementations.
> Every new page, component, and modal MUST follow these standards.
> Last updated: 2026-02-10 | Based on iOS 26 / iPadOS 26 "Liquid Glass" (WWDC 2025)

---

## 1. Design Philosophy

**iOS 26 Liquid Glass** — translucent surfaces with refraction, layered depth through blur + shadow, spring-based physics motion, and pill-shaped floating controls. The interface should feel like looking through layers of frosted crystal.

**Keywords:** Premium, Translucent, Springy, Depth-aware, Bilingual-ready

---

## 2. Color Palette

### Primary — Premium Emerald Green
| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#10b981` | Primary actions, success, active nav, brand accent |
| `--primary-hover` | `#059669` | Hover/pressed states, gradients |
| `--primary-light` | `rgba(16, 185, 129, 0.08)` | Subtle backgrounds, selected highlights |
| `--primary-content` | `#ffffff` | Text on primary backgrounds |

> **⚠️ NEVER use `#22c55e` or `#16a34a`** — these are the old green. Always use `#10b981` / `#059669`.

### Surfaces
| Token | Value | Usage |
|-------|-------|-------|
| `--surface` | `#ffffff` | Cards, modals, primary surfaces |
| `--background` | `#f2f2f7` | Page background (iOS system gray 6) |
| `--hover-bg` | `#f8fafc` | Hover state backgrounds |

### Text Hierarchy
| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#1e293b` | Headings, important text |
| `--text-secondary` | `#64748b` | Body text, descriptions |
| `--text-muted` | `#94a3b8` | Placeholders, timestamps, disabled |

### Borders (iOS 26 Translucent Separators)
| Token | Value | Usage |
|-------|-------|-------|
| `--border` | `rgba(60, 60, 67, 0.08)` | Default separator |
| `--border-heavy` | `rgba(60, 60, 67, 0.18)` | Emphasized separator |

> **⚠️ NEVER use opaque borders like `#f1f5f9`** — always use translucent `rgba()`.

### Semantic Colors
| Name | Value | Wash Background |
|------|-------|-----------------|
| Success | `#10b981` | `rgba(16, 185, 129, 0.08)` |
| Warning | `#f59e0b` | `#fffbeb` |
| Error | `#ef4444` | `#fef2f2` |
| Info | `#3b82f6` | `#eff6ff` |

### Gradients (for buttons, headers, avatars)
```css
/* Primary gradient */
background: linear-gradient(135deg, #10b981 0%, #059669 100%);

/* Page background */
background: linear-gradient(180deg, #f2f2f7 0%, #e8e8ed 100%);
```

---

## 3. Typography

### Font Stack
```css
--font-family: 'Noto Sans', 'Noto Sans Lao', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
```

**Always** include `'Noto Sans Lao'` for Lao language support. When using inline styles inside Leaflet maps or third-party containers, explicitly set `font-family: var(--font-family)`.

### Weights
| Weight | Value | Usage |
|--------|-------|-------|
| Regular | 400 | Body text |
| Medium | 500 | Labels, badges |
| Semibold | 600 | Section titles |
| Bold | 700 | KPI values, card titles |
| Extra Bold | 800 | Modal headers, page titles |

### Sizes
| Name | Size | Usage |
|------|------|-------|
| Caption | 10px | Tiny badges, timestamps |
| Small | 12px | Table headers, meta text |
| Body | 14px (0.875rem) | Default text, inputs |
| Large | 16px (1rem) | Emphasized body |
| Stat Value | 24px (1.5rem) | KPI numbers |

---

## 4. Motion System

> **Core principle:** Asymmetric timing. Press feedback is instant (50ms), release bounces back with a spring (250ms).

### Timing Tokens
| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | `100ms` | Micro-interactions |
| `--duration-normal` | `200ms` | State changes, hover |
| `--duration-slow` | `350ms` | Modal entrance, page transitions |

### Easing Curves
| Token | Value | Usage |
|-------|-------|-------|
| `--spring-snappy` | `cubic-bezier(0.2, 0, 0, 1)` | Quick UI responses |
| `--spring-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Modal entrance, toggle switch |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Page reveal, toast slide-in |
| `--ease-in-expo` | `cubic-bezier(0.7, 0, 0.84, 0)` | Exit animations |

### Page Transitions
- **Enter:** `pageReveal` — 250ms fade + 8px translateY via `--ease-out-expo`
- **Exit:** `pageExit` — 150ms fade + 4px translateY up via `--ease-in-expo`
- **Implementation:** See `navigateTo()` in `JavaScript.html` — uses CSS `.exiting` class with `animationend` event

### Button Press
```css
/* Instant press-in, spring release */
.btn:active { transform: scale(0.97); transition-duration: 50ms; }
.btn { transition: transform 250ms var(--spring-bounce); }
```

### Modal Animations
- **Entrance:** `modalEntrance` — 350ms scale 0.97→1.0 with `--spring-bounce`
- **Exit:** `modalExit` — 200ms scale 1.0→0.97 + 8px translateY with `--ease-in-expo`
- **Exit trigger:** Add `.closing` class to `.modal-backdrop`

---

## 5. Depth & Glass System

### Shadow Hierarchy
| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.03)` | Resting cards |
| `--shadow-md` | `0 4px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)` | Hover states |
| `--shadow-lg` | `0 12px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04)` | Dropdowns, floating UI |
| `--shadow-modal` | `0 25px 60px rgba(0,0,0,0.15), 0 10px 20px rgba(0,0,0,0.08)` | Modals |

### Glass (Frosted Blur)
| Token | Value | Usage |
|-------|-------|-------|
| `--glass-frosted` | `rgba(255,255,255,0.72)` | Sidebar, header background |
| `--glass-blur-light` | `blur(12px)` | Subtle glass |
| `--glass-blur-heavy` | `blur(20px)` | Sidebar, header, toast |

### How to Apply Glass
```css
.glass-element {
    background: var(--glass-frosted);
    backdrop-filter: var(--glass-blur-heavy);
    -webkit-backdrop-filter: var(--glass-blur-heavy);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
}
```

---

## 6. Component Standards

### Sidebar Navigation
- **Background:** Frosted glass with `backdrop-filter`
- **Active indicator:** Tinted emerald pill background (NOT green left-border pipe)
- **Active icon:** Filled variant (`font-variation-settings: 'FILL' 1`)
- **Group labels:** `rgba(60,60,67,0.4)`, uppercase, letterspaced

### Header
- **Background:** Frosted glass matching sidebar
- **Border-bottom:** 1px `var(--border)`
- **Shadow:** Subtle `0 1px 3px rgba(0,0,0,0.02)`

### Cards
```css
.card {
    background: var(--surface);
    border: 1px solid var(--border);       /* translucent, NOT opaque */
    border-radius: var(--radius-xl);       /* 16px */
    box-shadow: var(--shadow-sm);          /* subtle depth */
    transition: box-shadow var(--duration-normal) var(--spring-snappy);
}
.card:hover { box-shadow: var(--shadow-md); }
```

### Buttons
```css
.btn {
    border-radius: var(--radius-md);       /* 8px */
    transition: all var(--duration-normal) var(--spring-snappy);
}
.btn:active {
    transform: scale(0.97);
    transition-duration: 50ms;
}
```

### Form Inputs
- **Height:** 44px (iOS touch target minimum)
- **Border-radius:** `var(--radius-md)` (8px)
- **Focus glow:** `0 0 0 4px rgba(16,185,129,0.10), 0 0 0 1px rgba(16,185,129,0.3)`
- **Transition:** Uses `--spring-snappy` curve

### Toggle Switch (iOS 26)
- **Size:** 51×31px (track), 27×27px (knob)
- **Off:** `rgba(120,120,128,0.16)` track
- **On:** `var(--primary)` track
- **Knob shadow:** Multi-layer for depth
- **Transition:** `--spring-bounce` curve

### Toast Notifications
- **Shape:** Pill (`border-radius: var(--radius-full)`)
- **Background:** Frosted glass (`--glass-frosted` + `--glass-blur-heavy`)
- **Position:** Fixed top-center, slides down with `--spring-bounce`
- **Status dot:** 8px circle (green/red/amber/blue)
- **Countdown bar:** 2px progress line at bottom

### Modal
- **Desktop:** Centered card, max-width 40rem, `--shadow-modal`
- **Mobile (≤768px):** Bottom-sheet with rounded top corners + drag handle
- **Entrance:** `modalEntrance` spring animation
- **Exit:** `modalExit` with `.closing` class
- **Body scroll lock:** `overflow: hidden` on `<body>`

### Loading Skeletons
Use `.skeleton` utility classes for loading states:
```html
<div class="skeleton skeleton-title"></div>
<div class="skeleton skeleton-line"></div>
<div class="skeleton skeleton-line-short"></div>
<div class="skeleton skeleton-card"></div>
<div class="skeleton skeleton-avatar"></div>
<div class="skeleton skeleton-badge"></div>
```

### Scrollbar
- **Width:** 5px, near-invisible
- **Track:** Transparent
- **Thumb:** `rgba(0,0,0,0.12)`, fully rounded

---

## 7. Layout

### Border Radius Scale
| Token | Value |
|-------|-------|
| `--radius-sm` | 6px |
| `--radius-md` | 8px |
| `--radius-lg` | 12px |
| `--radius-xl` | 16px |
| `--radius-2xl` | 24px |
| `--radius-full` | 9999px (pills) |

### Page Structure
```
┌─────────────────────────────────────────────────┐
│  SIDEBAR (260px)   │  MAIN CONTENT              │
│  Glass backdrop    │  ┌────────────────────────┐ │
│  ───────────────   │  │ HEADER (Glass)         │ │
│  Logo/Brand        │  └────────────────────────┘ │
│  Nav (Tinted pills)│  ┌────────────────────────┐ │
│                    │  │ PAGE CONTAINER         │ │
│                    │  │ Gradient background    │ │
│                    │  │ pageReveal animation   │ │
│                    │  └────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 8. Accessibility

### Required
- `prefers-reduced-motion`: All animations disabled
- `prefers-contrast`: Thicker borders, darker text
- Touch targets: Minimum 44px
- Focus-visible: Green glow ring on interactive elements

---

## 9. Dark Mode

All tokens have dark mode variants using `body.dark` selector. Key overrides:
- Background: `#020617` → `#0f172a` gradient
- Surface: `#0f172a`
- Text: `#f1f5f9` / `#94a3b8` / `#475569`
- Glass: `rgba(15,23,42,0.72)` with `blur(20px)`

---

## 10. Quick Reference — Do's and Don'ts

| ✅ DO | ❌ DON'T |
|-------|---------|
| Use `#10b981` for primary green | Use `#22c55e` or `#16a34a` |
| Use `rgba()` for borders | Use opaque hex borders like `#f1f5f9` |
| Use spring curves for motion | Use `ease` or `linear` |
| Use `var(--shadow-sm)` for cards | Use invisible `rgba(0,0,0,0.03)` shadows |
| Use 44px+ touch targets | Use tiny click targets on mobile |
| Use bottom-sheet on mobile modals | Use centered modals on small screens |
| Use `var(--font-family)` in map overlays | Assume font inheritance in third-party containers |
| Add `.exiting` class before page swap | Instant `display:none` page swaps |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-01 | Initial DESIGN.md |
| 2.0 | 2026-02-10 | **iOS 26 Liquid Glass rewrite** — premium emerald, spring motion, glass depth, page transitions, toast/skeleton/scrollbar, mobile bottom-sheet, accessibility |
