# Native Stone – Component Patterns

All patterns below enforce the three hard rules: no gradient, no box-shadow, border-only cards.

---

## Card

```css
.card {
  background: var(--bg-surface);       /* #FFF */
  border: 1px solid var(--border);     /* #D6D0CA — NOT box-shadow */
  border-radius: var(--radius-md);     /* 6 px */
  padding: var(--sp-6);                /* 24 px */
}
.card:hover {
  border-color: var(--border-strong);  /* subtle hover, no shadow */
}
```

---

## Button – Primary (accent)

```css
.btn-primary {
  background: var(--accent);           /* #C96B3E */
  color: #FFFFFF;
  border: none;
  border-radius: var(--radius-sm);     /* 4 px */
  padding: 8px 18px;
  font: 500 var(--text-md) var(--font);
  cursor: pointer;
}
.btn-primary:hover {
  background: var(--accent-hover);     /* #B85C34 */
}
```

## Button – Secondary (outline)

```css
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 18px;
  font: 500 var(--text-md) var(--font);
  cursor: pointer;
}
.btn-secondary:hover {
  border-color: var(--border-strong);
  background: var(--bg-muted);
}
```

## Button – Ghost (text-only)

```css
.btn-ghost {
  background: transparent;
  color: var(--accent-text);           /* orange text */
  border: none;
  padding: 6px 12px;
  font: 500 var(--text-md) var(--font);
  cursor: pointer;
}
.btn-ghost:hover {
  color: var(--accent-hover);
}
```

---

## Input / Select

```css
.input {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font: 400 var(--text-md) var(--font);
  color: var(--text-primary);
}
.input::placeholder        { color: var(--text-disabled); }
.input:focus               { outline: none; border-color: var(--accent); }
.input--error              { border-color: var(--error); }
.input--error + .label-err { color: var(--error); font-size: var(--text-sm); }
```

---

## Table

```css
.table {
  width: 100%;
  border-collapse: collapse;
  font: 400 var(--text-md) var(--font);
  color: var(--text-primary);
}
.table th {
  text-align: left;
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border-strong);
  padding: var(--sp-3) var(--sp-4);
}
.table td {
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--border);
}
.table tbody tr:nth-child(even) {
  background: var(--bg-muted);         /* #EBE7E3 stripe */
}
```

---

## Badge / Tag

```css
.badge          { display: inline-flex; align-items: center; gap: 4px;
                  border-radius: var(--radius-full); padding: 3px 10px;
                  font: 500 var(--text-sm) var(--font); }
.badge--accent  { background: var(--accent-muted);  color: var(--accent); }
.badge--success { background: var(--success-muted); color: var(--success); }
.badge--error   { background: var(--error-muted);   color: var(--error); }
.badge--info    { background: var(--info-muted);    color: var(--info); }
.badge--neutral { background: var(--bg-muted);      color: var(--text-secondary); }
```

---

## Alert / Notice

```css
.alert {
  border-left: 3px solid var(--info);   /* swap color per variant */
  background: var(--info-muted);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  padding: var(--sp-4) var(--sp-5);
  font: 400 var(--text-md) var(--font);
  color: var(--text-primary);
}
/* Variants: swap border-left color + background */
/* accent  → --accent      / --accent-muted  */
/* success → --success     / --success-muted */
/* error   → --error       / --error-muted   */
/* info    → --info        / --info-muted    */
```

---

## Nav / Sidebar Item (active state)

```css
.nav-item        { padding: 8px 14px; border-radius: var(--radius-md);
                   color: var(--text-secondary); font: 400 var(--text-md) var(--font); }
.nav-item:hover  { background: var(--bg-muted); color: var(--text-primary); }
.nav-item--active{ background: var(--accent-muted); color: var(--accent);
                   font-weight: 600; }
```

---

## Divider

```css
.divider { border: none; border-top: 1px solid var(--border); margin: var(--sp-6) 0; }
```

---

## Anti-patterns – NEVER do these

- `background: linear-gradient(...)` — any form of gradient.
- `box-shadow: ...` on a card or panel — use `border` instead.
- Loading a font other than Noto Sans KR.
- Using a font size outside the defined scale without explicit user request.
- Using a vivid / saturated orange (e.g. `#FF6600`). Stick to `--accent` / `--accent-hover`.
