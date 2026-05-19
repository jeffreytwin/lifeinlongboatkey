# Life in Longboat Key — design tokens

A portable reference for the visual system used on the LBK interactive
map. Drop these tokens into any new surface (microsite, marketing page,
embed) and it should sit cleanly alongside the existing UI.

---

## Fonts

Two families, loaded together from Google Fonts. One serif for
display + price, one sans for everything else.

| Role | Family | Weights used | Notes |
|---|---|---|---|
| Display / numerals / accents | **Fraunces** | 300, 400, 500, 600, 700 + italic 400 | Used for headings, the brand wordmark, prices, the result count, hover-card community name, detail-panel title. Italic is used only on the brand mark. |
| UI / body | **Manrope** | 300, 400, 500, 600, 700 | Body copy, sidebar labels, chips, buttons, meta text, map control labels. |

Google Fonts URL (copy verbatim):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

Default stack on `<body>`:

```css
font-family: 'Manrope', system-ui, sans-serif;
font-size: 14px;
line-height: 1.5;
-webkit-font-smoothing: antialiased;
```

All `<h1>`–`<h4>` get:

```css
font-family: 'Fraunces', Georgia, serif;
font-weight: 500;
letter-spacing: -0.01em;
```

---

## Color palette

CSS variables live on `:root`. Hex values:

**Brand palette** is built from three colors the lifeinlongboatkey.com
homepage uses:

- `#49C3A9` — mint (logo letterforms)
- `#E6A039` — gold (the heron silhouette)
- `#605E5E` — warm gray (body text)

The mint is too light for white-text-on-bg surfaces (~1.97 contrast),
so the working teal is a darker mint (`--teal: #2A8E78`) that pairs
with both white text on the button AND dark text on cream. The bright
logo mint is kept as `--teal-bright` for decorative fills.

### Surfaces

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#F8F4EC` | App background. Warm cream. |
| `--bg-card` | `#FFFFFF` | Cards, popovers, the details panel, sidebar surfaces that sit on the bg. |
| `--sand` | `#EFE5CC` | Secondary fill (rare; mostly used to back the "55+" pill). |

### Rules + muted strokes

| Token | Hex | Role |
|---|---|---|
| `--rule` | `#E6DFD2` | 1 px dividers between sections, card outlines. |
| `--rule-soft` | `#F0EADD` | Softer dividers inside cards. |

### Type

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#2D2D2D` | Primary text. Warm dark gray. |
| `--ink-soft` | `#605E5E` | Secondary text, sidebar copy, labels. Brand warm gray. |
| `--ink-muted` | `#9A9794` | Tertiary text, meta lines, counts. |

### Brand — mint (primary)

| Token | Hex | Role |
|---|---|---|
| `--teal` | `#2A8E78` | Primary brand color. Wordmark, condo pin, active filter pill, CTA button, links. |
| `--teal-deep` | `#1F6B5A` | Deeper variant — cluster bubbles, zone labels, hover emphasis. |
| `--teal-hover` | `#1F6B5A` | Alias of `--teal-deep` for clarity in hover rules. |
| `--teal-bright` | `#49C3A9` | The logo-true bright mint. Use sparingly for decorative fills. |

### Brand — gold (accent)

| Token | Hex | Role |
|---|---|---|
| `--coral` | `#E6A039` | Neighborhood polygon fill + outline, brand-mark dot, hover-card neighborhood accent. Variable kept as `--coral` for compatibility; carries the gold hex. |
| `--coral-deep` | `#A87A1A` | Dark gold for text on gold-tint backgrounds and neighborhood pin outlines. |
| `--coral-soft` | `#FAE6C7` | Soft gold wash for the chip variant that signals a neighborhood. |

### Supporting palette

| Token | Hex | Role |
|---|---|---|
| `--gulf` | `#2A8E78` | Gulf-front waterfront tag (harmonized with `--teal`). |
| `--bay` | `#3A6EA5` | Bay-front waterfront tag. |
| `--ok` | `#4A7C59` | Success / "Yes" state in amenity rows. |

### Drop-in `:root` block

```css
:root {
  --bg: #F8F4EC;
  --bg-card: #FFFFFF;
  --ink: #2D2D2D;
  --ink-soft: #605E5E;
  --ink-muted: #9A9794;
  --rule: #E6DFD2;
  --rule-soft: #F0EADD;
  --teal: #2A8E78;
  --teal-deep: #1F6B5A;
  --teal-hover: #1F6B5A;
  --teal-bright: #49C3A9;
  --coral: #E6A039;
  --coral-deep: #A87A1A;
  --coral-soft: #FAE6C7;
  --sand: #EFE5CC;
  --gulf: #2A8E78;
  --bay: #3A6EA5;
  --ok: #4A7C59;
}
```

---

## Type scale

Sizes are absolute pixels. The base body size is **14 px**. The scale
is hand-tuned rather than mathematical — sizes shown are the ones
actually in use.

### Display / serif (Fraunces)

| Size | Weight | Where it's used |
|---|---|---|
| 26 px | 500 | Card price (`.card-price`) — the headline number on a community card |
| 22 px | 500 italic | Brand wordmark in the app header (`.brand-mark`) |
| 20 px | 500 | Detail panel title (`.detail-name`) at desktop |
| 18 px | 500 | Section subheads, hover-card community name |
| 16 px | 500 | Card community name (`.card-name`) on the list grid |
| 15 px | 500 | Hover-card community name (compact) |
| 14 px | 500 | Hover-card price, inline accent numbers |
| 13 px | 500 | Detail-panel price, secondary serif accents |

### UI / sans (Manrope)

| Size | Weight | Where it's used |
|---|---|---|
| 14 px | 400 | Base body copy |
| 14 px | 600 | "View N homes for sale" CTA |
| 13 px | 400–500 | Sidebar checklist labels, toggle rows, descriptions |
| 12 px | 600 | Map style toggle pills, chip-style filter buttons |
| 12 px | 700 | Header result count strong text |
| 11 px | 700 | Sidebar section titles, ALL-CAPS labels |
| 10 px | 700 | Chip counts, micro labels |
| 9 px | 700 | Map pin labels (ultra-compact) |

### Letter-spacing conventions

- Headings (Fraunces): `letter-spacing: -0.01em` (slight negative — tighter for the serif's natural width)
- ALL-CAPS micro-labels (11 px, 10 px): `letter-spacing: 0.08em` to `0.15em` (positive, opens them up)
- Brand wordmark: `letter-spacing: -0.02em` (Fraunces italic, tighter)

---

## Pairings + recipes

### Brand mark

```html
<span class="brand-mark">Life in Longboat Key</span>
<span class="brand-sub">Neighborhoods &amp; Condos</span>
```

```css
.brand-mark {
  font-family: 'Fraunces', serif;
  font-size: 22px;
  font-weight: 500;
  font-style: italic;
  color: var(--teal);
  letter-spacing: -0.02em;
}
.brand-mark::before {
  content: "◐";
  font-style: normal;
  color: var(--coral);
  margin-right: 8px;
  font-size: 18px;
}
.brand-sub {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--ink-muted);
}
```

### Price headline on a card

```css
.card-price {
  font-family: 'Fraunces', serif;
  font-size: 26px;
  font-weight: 500;
  color: var(--teal);
}
```

### Section-header micro-label

```css
.section-title {
  font-family: 'Manrope', sans-serif;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ink-muted);
}
```

### Primary CTA

```css
.cta {
  background: var(--teal);
  color: #FFFFFF;
  font-family: 'Manrope', sans-serif;
  font-size: 14px;
  font-weight: 600;
  padding: 12px 18px;
  border: 0;
  border-radius: 4px;
}
.cta:hover { background: var(--teal-hover); }
```

---

## Notes for downstream work

- **Contrast.** `--teal` on `--bg` passes WCAG AA for body text. `--ink-muted` on `--bg` does NOT — keep it for ≥ 11 px ALL-CAPS or for non-critical meta.
- **Coral is an accent only.** It signals "neighborhood" (vs condo teal) and decorates the brand mark. Don't use it for primary CTAs.
- **The serif does the emotional work.** Reach for Fraunces on prices, names, headlines. Manrope handles every utilitarian surface.
- **The negative letter-spacing on Fraunces is doing more work than it looks.** Skip it and the wordmark feels loose.
- **Background `#F5F1E8` is warm cream, not white.** Pairing white cards (`--bg-card: #FFFFFF`) directly on this background gives the "elevated" feeling without needing a shadow.
