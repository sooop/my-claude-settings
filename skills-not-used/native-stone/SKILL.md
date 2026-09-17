---
name: native-stone
description: >
  Web-app theming skill that applies the "Native Stone" design system — a muted Anthropic-brand
  orange accent over stone/slate neutrals, with Noto Sans KR, a strict no-gradient / no-card-shadow
  policy, and a fixed font scale anchored at 14 px = md. Use whenever building a React or HTML
  artifact that needs consistent, non-AI-looking styling; or when the user requests this theme
  explicitly. Also apply when the user says "theme-studio" or asks to avoid the generic purple-
  gradient AI aesthetic.
---

# Native Stone – Web-App Theme Skill

## Design Principles (hard rules — never override)

1. **No gradients.** All backgrounds and surfaces are flat solid colors.
2. **No card shadows.** Cards use a 1 px border instead of `box-shadow`.
3. **Font: Noto Sans KR only.** Load via Google Fonts `<link>` or `@import`.
4. **Font scale anchored at 14 px = md.** See `references/tokens.md` for the full scale.
5. **Accent is the dull Anthropic orange.** Never saturate or brighten it.

## Quick Apply – React (JSX artifact)

```jsx
// 1. Import the font at the top of the component tree
import { useEffect } from "react";

function FontLoader() {
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);
  return null;
}

// 2. Wrap your root with the style block — paste tokens from references/tokens.md
// 3. Apply classes/inline styles following the palette in references/tokens.md
```

See **`references/tokens.md`** for the complete color palette, font scale, spacing scale, and
ready-to-paste CSS custom-property block.

See **`references/component-patterns.md`** for card, button, input, and table patterns that
comply with the hard rules above.

## When NOT to use this skill

- The user explicitly requested a different color scheme or theme.
- The artifact is a document (docx/PDF) rather than a web app — use the docx or pdf skill instead.
