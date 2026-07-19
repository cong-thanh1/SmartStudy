# Design — SmartStudy

A locked design system for the SmartStudy web app. Every page reads this file
before visual changes are made. Extend this system deliberately; do not invent a
theme per route.

## Genre

Modern-minimal with a technical tone. The interface is for Vietnamese students
and independent learners who want to turn a PDF into a focused study session.

## Macrostructure family

- Marketing pages: **Narrative Workflow**, using an H1 Marquee opening and an F4
  Step Sequence for the real document → understand → practise workflow.
- App pages: **Workbench**, where the working interface carries the hierarchy.
- Content pages: **Long Document** for reading, with a functional tool rail for
  chat, summaries, quizzes and tutor actions.

## Theme

- `--color-paper`: `oklch(97% 0.009 150)`
- `--color-paper-2`: `oklch(94.5% 0.012 150)`
- `--color-ink`: `oklch(20% 0.025 155)`
- `--color-ink-2`: `oklch(31% 0.024 155)`
- `--color-rule`: `oklch(82% 0.014 150)`
- `--color-accent`: `oklch(43% 0.105 155)`
- `--color-focus`: `oklch(56% 0.16 35)`

Forest green identifies active study context. Coral is a signal used only for
focus and small priority marks. Neither colour becomes a decorative wash.

## Typography

- Display: Space Grotesk Variable, weight 700, roman.
- Body: IBM Plex Sans Variable, weight 400.
- Mono/outlier: IBM Plex Mono, weight 500, for stage numbers and data only.
- Display tracking: `-0.035em`.
- Type scale anchor: `--text-display = clamp(3rem, 8vw, 5.25rem)`.

## Spacing

The 4-point named scale lives in `tokens.css`. Components use named tokens or
Tailwind's 4-point scale; raw spacing values are not introduced mid-render.

## Motion

- Easings: `--ease-out`, `--ease-in`, `--ease-in-out` from `tokens.css`.
- App motion: button press, modal crossfade, content state crossfade.
- No universal scroll reveal, parallax, hover scaling or animated gradients.
- Reduced motion: opacity-only and no longer than 150 ms.

## Microinteractions stance

- Silent success when the result is already visible.
- Hover is always paired with focus/tap behaviour.
- Focus rings appear instantly.
- Loading and errors keep their labels and accessible state.

## CTA voice

- Primary: dark ink fill, compact rectangular control, specific verb.
- Secondary: paper surface with a visible rule.
- Textual: C3 typographic link with an underline and arrow.

## Per-page allowances

- Marketing may use the product UI itself as evidence; no decorative stock art.
- App pages use no enrichment; function carries the page.
- Content pages are typography-led and keep reading measure controlled.

## What pages MUST share

- SmartStudy wordmark and the forest/coral anchor placement.
- Space Grotesk + IBM Plex Sans + IBM Plex Mono roles.
- Button geometry, focus treatment and field height.
- Warm green-tinted paper, restrained rules and low shadow use.

## What pages MAY differ on

- Density according to task: library, study workspace or assessment.
- Component arrangement inside the locked macrostructure family.
- Data/status emphasis where the state is factual.

## Exports

### tokens.css

The complete source of truth is `tokens.css` beside this file. Its portable core:

```css
@theme {
  --font-display: "Space Grotesk Variable", "Arial Narrow", sans-serif;
  --font-body: "IBM Plex Sans Variable", "Segoe UI", sans-serif;
  --font-outlier: "IBM Plex Mono", monospace;
  --color-paper: oklch(97% 0.009 150);
  --color-paper-2: oklch(94.5% 0.012 150);
  --color-paper-3: oklch(90% 0.016 150);
  --color-ink: oklch(20% 0.025 155);
  --color-ink-2: oklch(31% 0.024 155);
  --color-muted: oklch(42% 0.018 155);
  --color-rule: oklch(82% 0.014 150);
  --color-accent: oklch(43% 0.105 155);
  --color-accent-ink: oklch(97% 0.009 150);
  --color-focus: oklch(56% 0.16 35);
}
```

### Tailwind v4 `@theme`

The block above is already valid Tailwind v4. For portable spacing utilities,
mirror the locked scale as follows:

```css
@theme {
  --spacing-3xs: 0.125rem;
  --spacing-2xs: 0.25rem;
  --spacing-xs: 0.5rem;
  --spacing-sm: 0.75rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2.5rem;
  --spacing-2xl: 4rem;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1.25rem;
  --text-lg: 1.5625rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DTCG tokens.json

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(97% 0.009 150)", "$type": "color" },
    "ink": { "$value": "oklch(20% 0.025 155)", "$type": "color" },
    "accent": { "$value": "oklch(43% 0.105 155)", "$type": "color" },
    "focus": { "$value": "oklch(56% 0.16 35)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Space Grotesk Variable", "$type": "fontFamily" },
    "body": { "$value": "IBM Plex Sans Variable", "$type": "fontFamily" },
    "outlier": { "$value": "IBM Plex Mono", "$type": "fontFamily" }
  },
  "space": {
    "md": { "$value": "1rem", "$type": "dimension" },
    "lg": { "$value": "1.5rem", "$type": "dimension" },
    "xl": { "$value": "2.5rem", "$type": "dimension" }
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background: 97% 0.009 150;
  --foreground: 20% 0.025 155;
  --primary: 43% 0.105 155;
  --primary-foreground: 97% 0.009 150;
  --muted: 94.5% 0.012 150;
  --muted-foreground: 42% 0.018 155;
  --border: 82% 0.014 150;
  --input: 82% 0.014 150;
  --ring: 56% 0.16 35;
  --radius: 0.5rem;
}
```
