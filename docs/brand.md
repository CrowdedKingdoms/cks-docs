---
slug: brand
sidebar_position: 2
title: Brand guidelines
---

# Brand guidelines

Crowded Kingdoms should feel **bold, minimal, premium, and technically powerful**. The visual system is black-on-white with ember used sparingly as the single ignition accent.

## Wordmark

Stack the name in all caps:

```text
CROWDED
KINGDOMS
```

- **CROWDED** — black on light backgrounds, white on dark backgrounds
- **KINGDOMS** — ember (`#ED8B00`, Pantone 144 C) on all backgrounds
- Display font: **Avenir Next Heavy** (fallback: Montserrat ExtraBold / Black)

## Core palette

| Token | Hex | Usage |
| --- | --- | --- |
| Void Black | `#030405` | Primary text, nav, dark sections |
| Pure White | `#FFFFFF` | Default page background |
| Soft Black | `#111315` | Secondary dark surfaces |
| Bone White | `#F6F3EA` | Warm off-white sections |
| Steel Gray | `#70757D` | Captions, metadata |
| Border Gray | `#E4E6E8` | Cards, dividers |
| Ember Signal | `#ED8B00` | Logo accent, large ignition CTAs, dark-theme accents (Pantone 144 C) |
| Ember Signal Hover | `#D97706` | Hover / pressed state for ember fills |
| Ember Deep | `#D96E1C` | Accessibility companion when white-on-ember is required |
| Ember Text | `#9A5300` | AA-safe ember for small labels and links on light backgrounds |

**Balance:** roughly 82% black/white, 12% gray, 4% ember. Ember should feel earned, not dominant.

Filled ember CTAs use **black text** on `#ED8B00` (homepage pattern). Prefer `Ember Text` for small ember-colored type on light surfaces.

## Typography

| Role | Font |
| --- | --- |
| Wordmark & display headings | Avenir Next Heavy (Montserrat ExtraBold / Black fallback) |
| Subheads | Avenir Next Demi Bold (Montserrat Bold fallback) |
| Body & UI | Inter |

## Buttons

**Primary:** black background, white text. Hover may shift toward ember with black text.

**Secondary:** black outline, transparent fill. Hover to black fill with white text.

Use ember buttons only for the single most important action or active system moment on a page.

## Product UI

Management UI, docs, and account surfaces should be quieter than marketing pages:

- Clarity and hierarchy over decoration
- Ember for focus rings, selected nav items, links, and key actions
- No fantasy textures, medieval ornament, or heavy gradients

## CSS tokens

```css
:root {
  --color-black: #030405;
  --color-soft-black: #111315;
  --color-white: #ffffff;
  --color-bone: #f6f3ea;
  --color-ember: #ed8b00;
  --color-ember-hover: #d97706;
  --color-ember-deep: #d96e1c;
  --color-ember-text: #9a5300;
  --color-gray: #70757d;
  --color-border: #e4e6e8;
  --font-display: "Avenir Next", "Montserrat", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
}
```

These tokens are applied on [docs.crowdedkingdoms.com](https://docs.crowdedkingdoms.com) and the [Management UI](https://app.crowdedkingdoms.com) portal.

For the full brand system (voice, imagery, layout, do/don't checklist), see the interactive guide: [Full brand guidelines](pathname:///brand/guidelines.html).
