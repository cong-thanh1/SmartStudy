# SmartStudy — Learning Signal Desk

This system is the implementation contract for the design-taste-frontend-v1
redesign. Baseline dials: design variance 8, motion 6, visual density 4.

## Direction

SmartStudy feels like a calm working desk for turning a PDF into recall. The
interface is technical without becoming a cockpit: large editorial anchors,
off-grid composition on desktop, strict single-column collapse below 768px.

## Palette

- Mineral paper `#f4f3ee`, lifted surface `#fbfaf6`, off-black `#181a18`.
- Cobalt `#3159d8` is the only product accent.
- Green, amber and red are semantic status colors only.
- No gradients, outer glows, pure black or purple/blue AI decoration.

## Type

- Geist Variable for display and body copy.
- Geist Mono Variable for counters, labels, stage markers and data.
- Headlines are left aligned, tightly tracked and deliberately limited in size.

## Geometry

- Controls use 10px corners; working panels use 16–24px corners.
- Borders and negative space establish hierarchy before shadows.
- Equal three-card marketing grids are forbidden; use split and asymmetric grids.

## Motion

- Transform and opacity only, using the project `--ease-out` curve.
- Page/list reveals cascade through CSS custom index values.
- A restrained status pulse and document ticker provide perpetual life.
- Reduced-motion mode removes loops and shortens every transition.

## States

Loading uses geometry-matched skeletons. Empty and error states explain the next
action in place. Every clickable surface has hover, focus-visible and pressed
feedback; field labels always sit above controls.

## Responsive contract

Desktop layouts can offset and overlap. Below 768px all primary grids collapse
to one column, page padding becomes 16px, navigation becomes a drawer, and no
clickable label may wrap or force horizontal overflow.

## Learning workspace contract

- Chat is the primary surface and remains bounded to the available viewport.
- Messages, summaries, tutor output and document content scroll inside their own
  panels; content never stretches the page shell vertically.
- The source document is closed by default. It opens as a bounded rail on
  desktop and a dismissible viewport drawer below 1024px.
- Selecting a citation opens the source reader automatically at the relevant
  context while keeping the composer anchored to the chat surface.
