---
name: ABA Shield CRM
description: Clinical pipeline management for ABA therapy centers
colors:
  teal-action: "#0D9488"
  teal-deep: "#0F766E"
  teal-bright: "#2DD4BF"
  navy-shell: "#0B1220"
  navy-border: "#1E293B"
  warm-canvas: "#F8F7F4"
  surface-white: "#FFFFFF"
  surface-raised: "#FAFAF8"
  surface-muted: "#F5F5F4"
  stone-border: "#E7E5E0"
  stone-divider: "#F1F0ED"
  ink-primary: "#0F172A"
  ink-secondary: "#334155"
  ink-tertiary: "#64748B"
  ink-muted: "#94A3B8"
  status-urgent: "#EF4444"
  status-warning: "#D97706"
  status-success: "#059669"
  status-info: "#1D4ED8"
typography:
  display:
    fontFamily: "Syne, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Syne, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.01em"
  mono:
    fontFamily: "DM Mono, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  full: "9999px"
  xl: "12px"
  lg: "8px"
  md: "6px"
  sm: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.teal-action}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.xl}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.teal-deep}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.xl}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  chip-active:
    backgroundColor: "{colors.teal-action}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.lg}"
    padding: "4px 12px"
  chip-inactive:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.lg}"
    padding: "4px 12px"
  input:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.xl}"
    padding: "8px 12px"
---

# Design System: ABA Shield CRM

## 1. Overview

**Creative North Star: "The Confident Clinician"**

ABA Shield presents itself the way a skilled clinician presents in a care setting: measured, authoritative, and focused. Every visual decision reflects the practitioner using the tool — someone who commands their workflow without drama, reads status at a glance, and trusts the system to get out of the way. The interface doesn't perform competence; it enables it.

The visual language is restrained teal-on-warm-white. A single action color (teal) carries all interactive weight; the warm off-white canvas (`#F8F7F4`) prevents the sterility of pure white without introducing warmth that might feel frivolous in a clinical context. Information density is moderate — enough to support quick scanning, not enough to overwhelm between sessions.

This system explicitly rejects the dense gray aesthetic of legacy EHR software (Epic, Centricity), the pastel-gradient friendliness of consumer wellness apps, and the metric-card-on-dark-background pattern common to startup dashboards. The comparison is not a peer software product — it's a well-organized clinical binder in experienced hands.

**Key Characteristics:**
- Warm off-white canvas, not clinical white
- Single teal action color, used sparingly — its presence is the signal
- Two-font hierarchy: Syne for display authority, DM Sans for clarity
- Monospace DM Mono for technical data (cert numbers, timestamps, IDs)
- Flat surfaces by default; borders and subtle shadows define depth
- Status via color + icon pair — never color alone
- Cards are structural, not decorative

## 2. Colors: The Teal-and-Warm-Stone Palette

A restrained palette built around a single clinical teal. Warmth is introduced through the canvas and stone neutrals; coolness through the teal action and navy shell.

### Primary
- **Teal Action** (`#0D9488`): The single interactive color. Used on primary buttons, active chip states, focus rings, progress indicators, and any element demanding immediate attention. Its rarity is the system's pulse — when teal appears, something can be acted on.
- **Teal Deep** (`#0F766E`): Hover and pressed states for primary teal elements. Never used at rest.
- **Teal Bright** (`#2DD4BF`): Brand-level only — the "Shield" wordmark in the nav. Not used on interactive controls.

### Secondary
- **Navy Shell** (`#0B1220`): Exclusive to the top navigation bar background. Not used inside the app surface.
- **Navy Border** (`#1E293B`): Dividers and secondary borders within the nav shell.

### Neutral
- **Warm Canvas** (`#F8F7F4`): The app background. Slightly warm, never pure white. Prevents the sterility of `#fff` while staying clinical.
- **Surface White** (`#FFFFFF`): Cards, panels, modals — elevated above the canvas.
- **Surface Raised** (`#FAFAF8`): Subtle alternate row backgrounds, unread notification rows. One step above the canvas.
- **Surface Muted** (`#F5F5F4`): Ghost button backgrounds, input fills at rest, tag backgrounds.
- **Stone Border** (`#E7E5E0`): Card borders, dividers between panels. Warm gray, not blue-shifted.
- **Stone Divider** (`#F1F0ED`): Hairline dividers between list rows. Nearly invisible; presence is structural.
- **Ink Primary** (`#0F172A`): Headings, primary body text. Tinted toward navy — never pure black.
- **Ink Secondary** (`#334155`): Secondary text, button labels.
- **Ink Tertiary** (`#64748B`): Supporting labels, captions.
- **Ink Muted** (`#94A3B8`): Placeholder text, timestamps, disabled states.

### Status (always paired with an icon — never color alone)
- **Urgent** (`#EF4444`): Overdue authorizations, denied stages, expired certifications.
- **Warning** (`#D97706`): Reauthorization approaching, certifications expiring within 60 days.
- **Success** (`#059669`): Active status, completed checklist items, authorized stage.
- **Info** (`#1D4ED8`): RBT role indicator, informational badges.

**The One Voice Rule.** Teal appears on ≤10% of any given screen. Buttons, focus states, active chips — that is the full license. If teal appears on more than one or two elements at the same visible moment, audit and remove.

**The Status Pair Rule.** Every status indicator pairs color with an icon or text label. A red badge alone is inaccessible and ambiguous; a red badge labeled "Expired" is neither.

## 3. Typography

**Display Font:** Syne (bold, 700), sans-serif
**Body Font:** DM Sans, sans-serif
**Technical Font:** DM Mono, monospace

**Character:** Syne brings geometric authority to headings without the coldness of purely mechanical grotesques. DM Sans is a humanist sans that keeps the body readable and slightly warm. DM Mono is reserved strictly for data that should *feel* like data — cert numbers, IDs, timestamps — and its presence signals "copy this" or "this is a code-like value."

### Hierarchy
- **Display** (Syne, 700, 26px, -0.01em tracking): Page-level titles only — "Pipeline", "Staff", "Clients". One per route.
- **Headline** (Syne, 700, 20px): Panel headings, modal titles, large numeric stats.
- **Title** (DM Sans, 600, 15px): Card headers, section labels within panels, confirmation dialogs.
- **Body** (DM Sans, 400, 14px): Primary reading text throughout the app. Client names, note content, descriptions.
- **Label** (DM Sans, 600, 12px): Chips, badges, uppercase section dividers. When used as uppercase section labels, apply `tracking-widest` (0.1em+).
- **Mono** (DM Mono, 400, 11px): Certification numbers, member IDs, ISO timestamps, phone numbers formatted as codes.

**The Mono Contract.** DM Mono appears only on values the user might need to copy exactly (cert numbers, member IDs, timestamps). It is never used for UI labels, headings, or descriptive text. Violating this collapses the signal.

## 4. Elevation

ABA Shield uses a flat-first, border-defined elevation model. Surfaces do not float — they sit. Depth is communicated through background color steps and border presence, not drop shadows.

Shadow is a state signal, not a structural one: it appears only on hover (cards gaining a whisper of presence) or on modal overlays (which float above the canvas and require the distinction).

### Shadow Vocabulary
- **Hover whisper** (`box-shadow: 0 1px 4px rgba(0,0,0,0.06)`): Subtle lift applied to cards on hover. Not visible at rest.
- **Card raised** (`box-shadow: 0 2px 8px rgba(0,0,0,0.08)`): Expanded or selected card state. The staff card uses this when expanded.
- **Modal overlay** (`box-shadow: 0 25px 50px rgba(0,0,0,0.25)`): Panels and modals that float above the full canvas.

**The Flat-By-Default Rule.** Surfaces are flat at rest. A card with `border: 1px solid #E7E5E0` and `background: #fff` is already elevated above the `#F8F7F4` canvas — no shadow needed. Add shadow only when state (hover, open, focus) requires acknowledging a change.

## 5. Components

### Buttons
Confident shape, single action color. No gradients, no outlines on the primary.
- **Shape:** Gently rounded (12px radius on primary, 8px on secondary/ghost)
- **Primary:** Teal Action background (`#0D9488`), white text, `px-4 py-2`, `text-sm font-semibold`. Hover: opacity 90% or Teal Deep.
- **Ghost / Secondary:** Stone-muted background (`#F5F5F4`), ink-secondary text, stone border. Used for cancel, edit, and non-destructive secondary actions.
- **Disabled:** 40% opacity on the primary color. No separate disabled color.
- **Focus:** `ring-2 ring-teal-100` with `border-teal-400` — visible, not aggressive.

### Chips (Filter / Tab)
- **Active:** Teal Action fill, white text, no border. The active chip is the loudest element in the bar.
- **Inactive:** White background, stone border (`#E7E5E0`), ink-secondary text. On hover: teal border, teal text.
- **Tab variant (role tabs):** Stone-100 background container; active tab lifts to white with subtle shadow — no color fill.

### Cards / Containers
The structural unit of the interface. Used for client records, staff cards, and panels.
- **Corner Style:** Gently rounded (12px, `rounded-xl`)
- **Background:** Surface White (`#FFFFFF`) on Warm Canvas (`#F8F7F4`)
- **Border:** 1px stone border (`#E7E5E0`) at rest; teal-200 border when expanded or selected
- **Shadow:** Hover whisper only — flat at rest
- **Internal Padding:** `px-4 py-3` (compact rows) or `px-5 py-4` (panel headers)

### Inputs / Fields
- **Style:** White background, stone border (`border-stone-200`), 12px radius
- **Focus:** Teal border (`border-teal-400`) + teal ring (`ring-2 ring-teal-100`). Consistent across all inputs, textareas, selects.
- **Placeholder:** Ink Muted (`#94A3B8`)
- **Disabled / Read-only:** Stone-muted background, reduced opacity text

### Navigation
- **Background:** Navy Shell (`#0B1220`) — exclusive to the nav bar
- **Active nav item:** Teal-tinted background (`rgba(13,148,136,0.25)`), teal border, white text
- **Inactive nav item:** Ink-muted text (`#94A3B8`), white on hover, whisper hover background
- **Typography:** DM Sans, 14px, medium weight

### Stage Stepper (Signature Component)
The horizontal pill-based progress tracker in Client Detail. Completed stages are teal-filled; the current stage has a ring; future stages are muted.
- Completed pills: Teal Action background, white text, cursor-pointer, ring on hover/select
- Current pill: Teal-tinted border + ring
- Future pills: Stone border, ink-muted text, not interactive
- Selected past-stage pill: `ring-2 ring-teal-400 ring-offset-1` — distinct from current stage

### Status Badges
Inline pill badges for cert status, authorization state, and role indicators. Always pair with text label; never rely on color alone.
- Radius: `rounded` (4-6px) for inline badges; `rounded-full` for dot indicators only
- Padding: `px-1.5 py-0.5`, `text-[10px]`, `font-semibold`

## 6. Do's and Don'ts

### Do:
- **Do** keep teal to ≤10% of any screen. Its scarcity is its meaning.
- **Do** pair every status color with a text label or icon. Red alone is inaccessible.
- **Do** use DM Mono exclusively for values the user might copy (cert numbers, IDs, timestamps).
- **Do** use Syne only for display-level headings (page titles, headline stats). Body copy stays in DM Sans.
- **Do** apply `focus:border-teal-400 focus:ring-2 focus:ring-teal-100` consistently across every interactive input.
- **Do** use the warm canvas (`#F8F7F4`) as the app background — never pure white as the page background.
- **Do** pair shadow with state change. A card at rest has no shadow; a card on hover has a whisper.

### Don't:
- **Don't** use legacy EHR aesthetics: dense gray layouts, form-heavy screens, flat blue borders, small gray text on gray backgrounds. ABA Shield should feel modern without abandoning clinical seriousness.
- **Don't** use gradient text (`background-clip: text`). Status and emphasis are expressed through weight, size, and solid color.
- **Don't** use `border-left` greater than 1px as a colored accent stripe on cards or list items. Use full borders, background tints, or leading icons instead.
- **Don't** use a colored sidebar accent (left-border stripe) to convey urgency on notification rows. Use border-left: 3px is already in the codebase — hold that line and don't widen it further; or migrate to a background tint.
- **Don't** use dark mode for aesthetic reasons. The current light-on-warm-white surface IS the correct choice for a clinical desktop tool. A dark mode would require an explicit design brief.
- **Don't** use consumer health aesthetics: pastel gradients, rounded blob shapes, candy-colored chips.
- **Don't** invent a new accent color. Teal is the only action color. Secondary status colors (red, amber, green) are state-only — they never appear on interactive controls.
- **Don't** add a second display font. Syne + DM Sans + DM Mono is the full typographic system.
