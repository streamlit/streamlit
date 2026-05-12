---
author: lukasmasuch
created: 2026-05-12
---

# Theme Color Transparency and Modern CSS Color Support

## Summary

This spec proposes fixes to Streamlit's frontend theme color processing to properly support
RGBA transparency in user-configured theme colors, add support for modern CSS color formats
(OKLCH, Display-P3), and prevent color mixing issues. The changes involve replacing
problematic color2k function calls with custom alpha-aware utilities.

## Problem

### 1. `transparentize()` Breaks Already-Transparent Colors

color2k's `transparentize(color, amount)` **subtracts** from alpha rather than scaling it:

```typescript
transparentize("#ff0000", 0.5)           // → rgba(255, 0, 0, 0.5) ✓ Works
transparentize("rgba(255,0,0,0.8)", 0.5) // → rgba(255, 0, 0, 0.3) (0.8 - 0.5)
transparentize("rgba(255,0,0,0.3)", 0.5) // → rgba(255, 0, 0, 0)   Completely invisible!
```

**Impact**: Users configuring `borderColor` or semantic colors (e.g., `redColor`) with
transparency get invisible or incorrectly faded derived colors.

Affected code paths:

| File | Line | Code | Issue |
|------|------|------|-------|
| `utils.ts` | 804 | `transparentize(borderColor, 0.55)` | `borderColorLight` becomes invisible if `borderColor` alpha < 0.55 |
| `utils.ts` | 263 | `transparentize(configMainColor, transparency)` | Derived backgrounds break with transparent main colors |
| `getColors.ts` | 34-38 | `transparentize(bodyText, 0.9)` etc. | Faded text variants break with transparent body text |
| `getColors.ts` | 45-46 | `transparentize(darkenedBgMix100, 0.75)` | Derived colors break if input has transparency |

### 2. No `setAlpha()` Function

color2k provides no way to set an absolute alpha value. It only has:
- `transparentize(color, amount)` — subtracts from alpha
- `opacify(color, amount)` — adds to alpha

This forces workarounds when the intent is to set a specific target alpha.

### 3. Modern CSS Color Formats

While color2k surprisingly supports parsing OKLCH, Display-P3, LCH, LAB, and HWB:

```typescript
parseToRgba("oklch(0.7 0.15 30)")      // → [237, 118, 101, 1] ✓
parseToRgba("color(display-p3 1 0 0)") // → [255, 11, 12, 1] ✓
```

The output is always converted to sRGB, losing wide-gamut information. For perceptually
uniform color operations (mixing, lightening), OKLCH is superior to RGB-based approaches.

### 4. Color Mixing Alpha Interpolation

color2k's `mix()` uses linear alpha interpolation, which can produce unexpected results:

```typescript
mix("rgba(255,0,0,0.5)", "#0000ff", 0.5) // → rgba(64, 0, 191, 0.75)
// Alpha becomes 0.75 (linear interpolation), not proper alpha blending
```

This is less critical than `transparentize()` but still incorrect for transparent colors.

## Proposal

### Option 1: Fix with Custom Utilities (Minimal Change) ✅ RECOMMENDED

Keep color2k for parsing and basic operations, but add custom alpha-aware utilities.

**New utilities in `frontend/lib/src/theme/colorUtils.ts`:**

```typescript
import { parseToRgba, toHex } from "color2k"

/**
 * Set absolute alpha value on a color.
 * Unlike transparentize which subtracts, this sets the exact alpha.
 */
export function setAlpha(color: string, alpha: number): string {
  const [r, g, b] = parseToRgba(color)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`
}

/**
 * Scale alpha by a factor (0-1). Preserves relative transparency.
 * scaleAlpha("rgba(255,0,0,0.8)", 0.5) → rgba(255,0,0,0.4)
 */
export function scaleAlpha(color: string, factor: number): string {
  const [r, g, b, a] = parseToRgba(color)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a * factor))})`
}

/**
 * Get alpha value from a color (0-1).
 */
export function getAlpha(color: string): number {
  return parseToRgba(color)[3]
}

/**
 * Proper alpha blending (Porter-Duff "over" operator).
 * Blends foreground color over background color.
 */
export function alphaBlend(foreground: string, background: string): string {
  const [fr, fg, fb, fa] = parseToRgba(foreground)
  const [br, bg, bb, ba] = parseToRgba(background)

  const ao = fa + ba * (1 - fa)
  if (ao === 0) return "rgba(0, 0, 0, 0)"

  const ro = Math.round((fa * fr + ba * br * (1 - fa)) / ao)
  const go = Math.round((fa * fg + ba * bg * (1 - fa)) / ao)
  const bo = Math.round((fa * fb + ba * bb * (1 - fa)) / ao)

  return toHex(`rgba(${ro}, ${go}, ${bo}, ${ao})`)
}
```

**Changes to existing code:**

1. **`utils.ts:804`** — Fix `borderColorLight`:
   ```typescript
   // Before
   const borderColorLight = transparentize(borderColor, 0.55)

   // After
   const borderColorLight = setAlpha(borderColor, getAlpha(borderColor) * 0.45)
   // Or simpler: target a specific light alpha
   const borderColorLight = setAlpha(borderColor, 0.35)
   ```

2. **`utils.ts:263`** — Fix `resolveBgColor`:
   ```typescript
   // Before
   return transparentize(configMainColor, transparency)

   // After
   // Set absolute target alpha (0.1 for light, 0.2 for dark)
   const targetAlpha = isLightTheme ? 0.1 : 0.2
   return setAlpha(configMainColor, targetAlpha)
   ```

3. **`getColors.ts:34-38`** — Fix faded text variants:
   ```typescript
   // Before
   const fadedText05 = transparentize(bodyText, 0.9) // Intent: 10% opacity

   // After
   const fadedText05 = setAlpha(bodyText, 0.1) // Explicit 10% opacity
   ```

**Pros:**
- Minimal dependency changes
- Low risk — focused fixes
- Maintains existing test coverage patterns
- color2k continues to handle parsing and other operations

**Cons:**
- Doesn't address perceptually uniform color mixing
- Still limited to sRGB output gamut

### Option 2: Replace color2k with culori

Switch to [culori](https://culorijs.org/) for modern color space support.

**Advantages of culori:**
- Native OKLCH support (perceptually uniform)
- Proper alpha handling semantics
- Wide gamut (Display-P3) support
- Interpolation in any color space
- Tree-shakeable

**Example migration:**

```typescript
import { parse, formatRgb, interpolate, oklch } from "culori"

// Parse any CSS color
const color = parse("oklch(0.7 0.15 30)")

// Mix in perceptually uniform space
const mixer = interpolate(["red", "blue"], "oklch")
const mixed = mixer(0.5) // Perceptually uniform midpoint

// Set alpha
const withAlpha = { ...color, alpha: 0.5 }

// Output as CSS
formatRgb(withAlpha) // "rgba(237, 118, 101, 0.5)"
```

**Cons:**
- Larger bundle size (~15KB vs color2k's ~3KB)
- Requires updating all import sites (25+ files)
- Different API patterns (object-based vs string-based)
- May introduce subtle color value changes due to different algorithms

### Option 3: Replace color2k with chroma-js

Switch to [chroma-js](https://gka.github.io/chroma.js/) — mature, actively maintained library
with proper alpha handling and perceptual color mixing.

**Maintenance status:** ✅ Active (10.6k stars, last commit Mar 2026, 2.8M weekly downloads)

**Advantages:**
- ✅ `alpha()` sets absolute alpha (directly fixes our main issue)
- ✅ Perceptually uniform mixing (LAB, LCH, OKLCH modes)
- ✅ OKLCH support built-in
- ✅ Chainable API familiar to developers
- ✅ Mature, well-documented, zero dependencies
- ✅ Preserves alpha through `darken()`/`brighten()` operations

**Example migration:**

```typescript
import chroma from "chroma-js"

// Alpha manipulation (THE FIX for our main issue)
chroma("rgba(255,0,0,0.8)").alpha(0.5).css()  // → "rgb(255 0 0 / 0.5)" ✅
chroma("rgba(255,0,0,0.3)").alpha(0.5).css()  // → "rgb(255 0 0 / 0.5)" ✅
// vs color2k transparentize which returns alpha=0 (invisible)

// Get alpha
chroma("rgba(255,0,0,0.3)").alpha()  // → 0.3

// Darken/lighten (preserves alpha)
chroma("rgba(255,0,0,0.5)").darken().css()  // → "rgb(194 0 0 / 0.5)"

// Perceptual color mixing
chroma.mix("red", "blue", 0.5, "oklch").css()  // Better midpoint than RGB

// Luminance
chroma("#ff0000").luminance()  // → 0.2126
```

**API mapping from color2k:**

| color2k | chroma-js |
|---------|-----------|
| `transparentize(c, 0.5)` | `chroma(c).alpha(targetAlpha).css()` |
| `darken(c, 0.2)` | `chroma(c).darken(1).css()` |
| `lighten(c, 0.2)` | `chroma(c).brighten(1).css()` |
| `mix(c1, c2, 0.5)` | `chroma.mix(c1, c2, 0.5, "lab").css()` |
| `getLuminance(c)` | `chroma(c).luminance()` |
| `parseToRgba(c)` | `chroma(c).rgba()` |
| `toHex(c)` | `chroma(c).hex()` |

**Cons:**
- ~13KB gzipped (4x larger than color2k's ~3KB)
- Not tree-shakeable
- Requires updating all import sites (25+ files)
- Slightly different darken/lighten scale (chroma uses 0-5 range, color2k uses 0-1)

**Supported formats:** hex, rgb, hsl, hsv, lab, lch, oklch, hsi, cmyk, named colors
**Not supported:** hwb(), color(display-p3)

### ~~Option 4: Replace color2k with colord~~ (NOT RECOMMENDED)

~~Switch to [colord](https://colord.omgovich.ru/) — lightweight alternative.~~

**⚠️ Not recommended:** Last commit August 2022 (2.5+ years stale), 36 open issues unaddressed.
Despite 17M weekly downloads (legacy dependencies), this library is effectively unmaintained.

## Recommendation

**Option 1 (Custom Utilities)** is recommended for minimal risk and fastest implementation.

**Option 3 (chroma-js)** is a strong alternative if:
- Perceptually uniform color mixing is desired (LAB/OKLCH modes)
- The 10KB bundle size increase is acceptable
- A cleaner, more intuitive API is preferred over maintaining custom utilities

| Criteria | Option 1 (Custom Utils) | Option 3 (chroma-js) |
|----------|------------------------|---------------------|
| Bundle impact | None | +10KB gzipped |
| Implementation effort | Low (add utilities) | Medium (migrate 25+ files) |
| Risk | Very low | Low |
| Fixes alpha issue | ✅ | ✅ |
| Perceptual mixing | ❌ | ✅ (LAB/OKLCH) |
| Maintenance burden | Custom code to maintain | Well-maintained library |

**Recommendation:** Start with **Option 1** to fix the immediate issue. Consider **Option 3**
as a follow-up if color quality improvements are desired or if maintaining custom utilities
becomes burdensome.

## Implementation Plan

### Phase 1: Add Custom Utilities

1. Create `frontend/lib/src/theme/colorUtils.ts` with:
   - `setAlpha(color, alpha)` — Set absolute alpha
   - `scaleAlpha(color, factor)` — Multiply alpha
   - `getAlpha(color)` — Get alpha value
   - `alphaBlend(fg, bg)` — Porter-Duff "over" blend

2. Add comprehensive tests for edge cases:
   - Opaque color input
   - Already-transparent color input
   - Fully transparent (alpha=0) input
   - Out-of-range alpha values

### Phase 2: Fix Problematic Call Sites

1. **`utils.ts`**:
   - `borderColorLight` derivation (line 804)
   - `resolveBgColor` function (line 263)

2. **`getColors.ts`**:
   - `fadedText*` derivations (lines 34-38)
   - `darkenedBgMix*` derivations (lines 45-46)

3. **Component files** using `transparentize` on potentially-transparent theme colors

### Phase 3: Add Integration Tests

1. Add E2E test with RGBA theme colors:
   ```toml
   [theme]
   primaryColor = "rgba(255, 0, 0, 0.8)"
   borderColor = "rgba(100, 100, 100, 0.5)"
   ```

2. Verify derived colors are visible and correct

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/lib/src/theme/colorUtils.ts` | New file with alpha utilities |
| `frontend/lib/src/theme/colorUtils.test.ts` | New file with tests |
| `frontend/lib/src/theme/utils.ts` | Fix `borderColorLight`, `resolveBgColor` |
| `frontend/lib/src/theme/getColors.ts` | Fix derived color calculations |
| `e2e_playwright/st_theme_rgba_test.py` | New E2E test (optional) |

## Alternatives Considered

### Keep Current Behavior with Documentation

Document that theme colors with transparency may not work correctly in derived colors.

**Rejected because:** Poor user experience; users expect CSS colors to work.

### Validate and Reject Transparent Colors

Add backend validation to reject RGBA colors in theme config.

**Rejected because:** Unnecessarily restrictive; transparency is a valid use case.

### Use CSS `color-mix()` on Frontend

Let the browser handle color mixing with native CSS `color-mix()`.

**Rejected because:** Not all derived colors can be expressed as CSS; need computed values
for JavaScript logic (e.g., chart colors, conditional styling).

## Open Questions

1. **Should we support relative color syntax?** CSS has `rgb(from red r g b / 50%)` syntax.
   This may be overkill for theme config but worth considering for future.

2. **What about OKLCH in theme config?** color2k parses it but converts to sRGB. Should we
   preserve the original format for CSS output where browsers support it?

3. **Should derived colors use perceptual blending?** Current `darken`/`lighten` use HSL which
   can produce unexpected results. OKLCH-based lightness adjustment is more uniform.
