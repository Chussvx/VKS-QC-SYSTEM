# Design System: VKS QC Dashboard V1
**Project ID:** VKS QC DASHBOARD V1  
**Stitch Reference:** [VKS Guard Patrol Dashboard](projects/6600674478619098215)

---

## 1. Visual Theme & Atmosphere

The VKS QC Dashboard exudes a **Professional-Enterprise** aesthetic with an **Airy, Clean** visual density. The design philosophy prioritizes clarity over decoration, creating a utilitarian workspace that feels modern yet approachable.

**Mood Keywords:** Clean, Professional, Spacious, Security-focused, Bilingual-ready

The interface uses generous whitespace and whisper-soft shadows to create depth without visual heaviness. Cards float gently above the background with minimal elevation, creating a layered but uncluttered feel. The overall impression is that of a premium security operations control panel—serious but not sterile.

---

## 2. Color Palette & Roles

### Primary Brand Color
| Name | Hex | Role |
|------|-----|------|
| **Vibrant Security Green** | `#22c55e` | Primary actions, success states, active navigation, brand accent |
| **Vibrant Green (Light Wash)** | `rgba(34, 197, 94, 0.08)` | Subtle hover backgrounds, selected item highlights |

### Surface Colors
| Name | Hex | Role |
|------|-----|------|
| **Pure White Canvas** | `#ffffff` | Card backgrounds, modals, primary surfaces |
| **Soft Cloud Gray** | `#f9fafb` | Page background, recessed areas |
| **Whisper Gray Border** | `#f1f5f9` | Subtle card borders, dividers |
| **Hover Mist** | `#f8fafc` | Hover state backgrounds |

### Text Hierarchy
| Name | Hex | Role |
|------|-----|------|
| **Deep Slate** | `#1e293b` | Primary headings, important text |
| **Balanced Slate** | `#64748b` | Body text, descriptions |
| **Muted Silver** | `#94a3b8` | Placeholders, disabled text, timestamps |

### Semantic Colors
| Name | Hex | Role |
|------|-----|------|
| **Success Green** | `#22c55e` | Complete, present, approved states |
| **Success Green Wash** | `#f0fdf4` | Success badge backgrounds |
| **Warning Amber** | `#f59e0b` | Pending, overdue, attention needed |
| **Warning Amber Wash** | `#fffbeb` | Warning badge backgrounds |
| **Critical Red** | `#ef4444` | Errors, absent, critical alerts |
| **Critical Red Wash** | `#fef2f2` | Error badge backgrounds |
| **Info Blue** | `#3b82f6` | Informational, neutral highlights |
| **Info Blue Wash** | `#eff6ff` | Info badge backgrounds |

### Sidebar Specific
| Name | Hex | Role |
|------|-----|------|
| **Sidebar Active Green** | `#16a34a` | Active navigation text |
| **Sidebar Active Background** | `#f0fdf4` | Active navigation item highlight |

---

## 3. Typography Rules

### Font Family
**Primary:** `'Noto Sans', 'Noto Sans Lao', system-ui, -apple-system, BlinkMacSystemFont, sans-serif`

This bilingual-ready font stack ensures perfect rendering of both English and Lao (ພາສາລາວ) text with consistent weight and character harmony.

**Monospace:** `'JetBrains Mono', 'Inter', monospace` for code snippets and data displays.

### Weight Usage
| Weight | Value | Usage |
|--------|-------|-------|
| **Regular** | 400 | Body text, descriptions |
| **Medium** | 500 | Labels, secondary headings, badges |
| **Semibold** | 600 | Section titles, emphasized text |
| **Bold** | 700 | KPI values, card titles, primary headings |

### Text Sizes
| Name | Size | Usage |
|------|------|-------|
| **Caption** | 0.625rem (10px) | Extra small badges |
| **Small** | 0.75rem (12px) | Table headers, timestamps, meta |
| **Body** | 0.875rem (14px) | Default text, table cells, inputs |
| **Large** | 1rem (16px) | Emphasized body |
| **Stat Value** | 1.5rem (24px) | KPI numbers in stat cards |

### Letter Spacing
- **Table Headers:** 0.05em (5% tracking) for uppercase labels
- **Body Text:** Normal tracking for readability

---

## 4. Component Stylings

### Buttons

#### Primary Button
- **Shape:** Gently rounded corners (8px radius)
- **Background:** Vibrant Security Green (`#22c55e`)
- **Text:** Pure white, medium weight
- **Behavior:** Subtle scale-down on press (0.98 transform)
- **Hover:** Slight darkening, whisper shadow emerges

#### Secondary Button
- **Shape:** Gently rounded corners (8px radius)
- **Background:** Transparent or soft gray
- **Border:** Whisper Gray Border (`#f1f5f9`)
- **Text:** Deep Slate, medium weight

#### Icon Button
- **Shape:** Circular or square with rounded corners
- **Size:** Compact (36px default)
- **Background:** Transparent, subtle on hover

### Cards/Containers

#### Standard Card
- **Background:** Pure White Canvas (`#ffffff`)
- **Border:** 1px Whisper Gray (`#f1f5f9`)
- **Corners:** Generously rounded (1rem / 16px radius)
- **Shadow:** Whisper-soft diffused shadow that deepens on hover
- **Padding:** Comfortable 1.25rem (20px)

#### Stat Card
- **Structure:** Header with icon + label, large value below
- **Icon Container:** Pill-shaped background with semantic color wash
- **Value:** Bold 1.5rem numbers
- **Trend Badge:** Pill-shaped with appropriate semantic color

#### Glass Card (Premium Overlay)
- **Background:** Semi-transparent white (`rgba(255, 255, 255, 0.7)`)
- **Border:** Frosted glass edge (`rgba(255, 255, 255, 0.4)`)
- **Effect:** 12px blur backdrop filter
- **Shadow:** Deep diffused shadow (`0 8px 32px 0 rgba(31, 38, 135, 0.07)`)

### Inputs/Forms

#### Text Input
- **Height:** 2.5rem (40px)
- **Border:** 1px Whisper Gray, transitions to Primary on focus
- **Background:** Pure White
- **Focus Ring:** 2px Primary Green outline
- **Corners:** Medium rounded (8px)

#### Select Dropdown
- **Appearance:** Native select with custom chevron icon
- **Chevron:** SVG chevron-down in muted gray
- **Menu:** Floating card with soft shadow, pill-rounded corners
- **Item Hover:** Hover Mist background

#### Textarea
- **Min Height:** 5rem (80px)
- **Resizable:** Vertical only
- **Focus:** Same 2px Primary outline as inputs

### Badges

#### Structure
- **Shape:** Pill-shaped (full radius)
- **Padding:** 0.25rem × 0.625rem
- **Font:** Small (12px), medium weight
- **Border:** 1px with 20% opacity semantic color

#### Variants
| Type | Background | Text | Border |
|------|------------|------|--------|
| Success | `#f0fdf4` | `#22c55e` | `rgba(34, 197, 94, 0.2)` |
| Warning | `#fffbeb` | `#f59e0b` | `rgba(245, 158, 11, 0.2)` |
| Error | `#fef2f2` | `#ef4444` | `rgba(239, 68, 68, 0.2)` |
| Info | `#eff6ff` | `#3b82f6` | `rgba(59, 130, 246, 0.2)` |
| Neutral | `#f8fafc` | `#64748b` | `#f1f5f9` |

### Tables

#### Header Row
- **Background:** Hover Mist (`#f8fafc`)
- **Text:** Muted Silver, uppercase, letterspaced
- **Position:** Sticky on scroll

#### Body Cells
- **Padding:** 0.75rem × 1rem
- **Border:** Top only, Whisper Gray
- **Text:** Balanced Slate

#### Row Hover
- **Background:** Hover Mist subtle highlight

---

## 5. Layout Principles

### Spacing System (4px Base)
| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 0.375rem (6px) | Subtle rounding |
| `--radius-md` | 0.5rem (8px) | Inputs, small cards |
| `--radius-lg` | 0.75rem (12px) | Medium containers |
| `--radius-xl` | 1rem (16px) | Cards, modals |
| `--radius-2xl` | 1.5rem (24px) | Large hero sections |
| `--radius-full` | 9999px | Pills, avatars |

### Shadow Depth
| Level | Value | Usage |
|-------|-------|-------|
| **Whisper** | `0 1px 2px rgba(0,0,0,0.03)` | Resting cards |
| **Gentle** | `0 4px 6px rgba(0,0,0,0.05)` | Hover states |
| **Floating** | `0 10px 15px rgba(0,0,0,0.04)` | Modals, dropdowns |

### Grid System
- **KPI Row:** 1-5 columns responsive (1→2→3→4→5)
- **Gap:** 1rem consistent
- **Breakpoints:**
  - Mobile: 1 column
  - Tablet (640px): 2 columns
  - Desktop (1024px): 3-5 columns

### Page Structure
```
┌─────────────────────────────────────────────────┐
│  SIDEBAR (260px)  │  MAIN CONTENT              │
│  ─────────────    │  ┌────────────────────────┐│
│  Logo/Brand       │  │ HEADER BAR             ││
│  Navigation       │  └────────────────────────┘│
│  Items            │  ┌────────────────────────┐│
│                   │  │ PAGE CONTAINER         ││
│                   │  │ (2.5rem padding)       ││
│                   │  │                        ││
│                   │  │ [Content Cards]        ││
│                   │  │                        ││
│                   │  └────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### Animation Timing
| Type | Duration | Easing |
|------|----------|--------|
| Micro-interactions | 0.1s | ease |
| State changes | 0.15s | ease |
| Page transitions | 0.2-0.3s | ease-out |
| Modal entrance | 0.15s | ease-out |

---

## 6. Stitch Prompt Guidelines

When generating new screens for VKS QC Dashboard in Stitch, use these keywords:

**Atmosphere:** "Clean, professional enterprise dashboard with airy spacing"

**Colors:** "Vibrant green (#22c55e) as primary accent on white canvas (#ffffff) with soft gray (#f9fafb) background"

**Components:** "ShadCN-style cards with whisper shadows, pill-shaped badges, 8px rounded inputs"

**Typography:** "Noto Sans / Noto Sans Lao for bilingual support, bold KPI values, muted gray labels"

**Layout:** "Sidebar navigation on left, generous 2.5rem padding, responsive grid for stat cards"

**Read-Only Views:** "Cards on Gray pattern: `bg-gray-100` modal background with clean `bg-white` content cards. No borders/input-styles for read-only text."

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-01 | Initial DESIGN.md created from VKS QC Dashboard V1 Styles.html |
