# Native Stone – Design Tokens

## Color Palette

### Neutrals (stone / slate family)

| Token            | Hex       | Role                                      |
|------------------|-----------|-------------------------------------------|
| `bg-page`        | `#F4F1EE` | Page / outermost background               |
| `bg-surface`     | `#FFFFFF` | Card / panel surface                      |
| `bg-muted`       | `#EBE7E3` | Muted section fill, table row stripe      |
| `border`         | `#D6D0CA` | Default border (cards, dividers)          |
| `border-strong`  | `#B8B0A7` | Emphasis border                           |
| `text-primary`   | `#2E3A40` | Body text, headings                       |
| `text-secondary` | `#64747B` | Sub-labels, captions                      |
| `text-disabled`  | `#9C9589` | Disabled / placeholder text               |
| `stone-400`      | `#A8A09A` | Decorative neutral mid-tone               |
| `slate-600`      | `#64747B` | Icon fill, secondary UI chrome            |

### Accent (dull Anthropic orange)

| Token              | Hex       | Role                                    |
|--------------------|-----------|-----------------------------------------|
| `accent`           | `#C96B3E` | Primary CTA button bg, active indicator |
| `accent-hover`     | `#B85C34` | Hover state of accent elements          |
| `accent-muted`     | `#F0DDD3` | Light tint for accent badges / alerts   |
| `accent-text`      | `#C96B3E` | Accent-colored text (links on light bg) |

### Semantic

| Token            | Hex       | Role                    |
|------------------|-----------|-------------------------|
| `success`        | `#5A8A6A` | Success state           |
| `success-muted`  | `#E6F0EA` | Success background      |
| `warning`        | `#C96B3E` | Warning (re-uses accent)|
| `warning-muted`  | `#F0DDD3` | Warning background      |
| `error`          | `#B04A3A` | Error / destructive     |
| `error-muted`    | `#F5E4E1` | Error background        |
| `info`           | `#4A7C9C` | Info state              |
| `info-muted`     | `#E1EBF0` | Info background         |

---

## Font Scale (14 px = md)

| Token  | Size   | Weight use                         |
|--------|--------|------------------------------------|
| `xs`   | 10 px  | Fine labels, legal                 |
| `sm`   | 12 px  | Captions, table headers            |
| `md`   | 14 px  | **Default body text**              |
| `lg`   | 16 px  | Sub-headings, emphasized body      |
| `xl`   | 18 px  | Section headings                   |
| `2xl`  | 22 px  | Page sub-titles                    |
| `3xl`  | 26 px  | Page titles                        |

Font weights available: 300 (light), 400 (regular), 500 (medium), 600 (semi-bold), 700 (bold).

Heading hierarchy recommendation: h1 → 3xl/700, h2 → 2xl/600, h3 → xl/600, h4 → lg/600.

---

## Spacing Scale

| Token  | Value  |
|--------|--------|
| `1`    | 4 px   |
| `2`    | 8 px   |
| `3`    | 12 px  |
| `4`    | 16 px  |
| `5`    | 20 px  |
| `6`    | 24 px  |
| `8`    | 32 px  |
| `10`   | 40 px  |
| `12`   | 48 px  |

---

## Border Radius

| Token   | Value  | Use                          |
|---------|--------|------------------------------|
| `sm`    | 4 px   | Inputs, small buttons        |
| `md`    | 6 px   | Cards, default panels        |
| `lg`    | 8 px   | Modals, larger containers    |
| `full`  | 9999px | Pills, avatar circles        |

---

## Ready-to-Paste CSS Custom Properties

Paste this `<style>` block into the `<head>` of any HTML artifact, or inside a `<style>` tag
at the top of a React component:

```css
:root {
  /* --- Font --- */
  --font: 'Noto Sans KR', sans-serif;

  /* --- Font Scale --- */
  --text-xs:  10px;
  --text-sm:  12px;
  --text-md:  14px;
  --text-lg:  16px;
  --text-xl:  18px;
  --text-2xl: 22px;
  --text-3xl: 26px;

  /* --- Neutrals --- */
  --bg-page:        #F4F1EE;
  --bg-surface:     #FFFFFF;
  --bg-muted:       #EBE7E3;
  --border:         #D6D0CA;
  --border-strong:  #B8B0A7;
  --text-primary:   #2E3A40;
  --text-secondary: #64747B;
  --text-disabled:  #9C9589;
  --stone-400:      #A8A09A;
  --slate-600:      #64747B;

  /* --- Accent (dull orange) --- */
  --accent:         #C96B3E;
  --accent-hover:   #B85C34;
  --accent-muted:   #F0DDD3;
  --accent-text:    #C96B3E;

  /* --- Semantic --- */
  --success:        #5A8A6A;
  --success-muted:  #E6F0EA;
  --error:          #B04A3A;
  --error-muted:    #F5E4E1;
  --info:           #4A7C9C;
  --info-muted:     #E1EBF0;

  /* --- Spacing --- */
  --sp-1: 4px;  --sp-2: 8px;   --sp-3: 12px;  --sp-4: 16px;
  --sp-5: 20px; --sp-6: 24px;  --sp-8: 32px;  --sp-10: 40px;
  --sp-12: 48px;

  /* --- Border Radius --- */
  --radius-sm:   4px;
  --radius-md:   6px;
  --radius-lg:   8px;
  --radius-full: 9999px;
}
```
