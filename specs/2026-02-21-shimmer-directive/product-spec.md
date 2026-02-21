---
author: lukasmasuch
created: 2026-02-21
---

# Animated text shimmer as markdown directive

## Summary

Add a `:shimmer[text]` markdown directive that applies an animated gradient sweep effect
to text. This provides a visual indicator for loading states, progressive content reveals,
or dynamic content in AI applications. The effect works across all Streamlit surfaces that
support markdown.

## Problem

Agentic and AI-powered applications commonly show intermediate states while processing—
generating responses, streaming outputs, or waiting for tool results. A subtle animated
shimmer effect on text is a widely-adopted pattern to communicate "thinking" or "loading"
without distracting the user. Most major AI chat interfaces (ChatGPT, Claude, Gemini)
use this pattern.

**Requests:**

- [#13247](https://github.com/streamlit/streamlit/issues/13247) — Add animated text shimmer
  as markdown directive (3+ upvotes)

**Use cases:**

- **AI response streaming**: Indicate that content is being generated before full output
  arrives
- **Placeholder text**: Show "Thinking..." or "Generating..." with visual feedback
- **Progressive reveals**: Highlight newly added content with a sweeping animation
- **Status indicators**: Draw attention to dynamic state changes

**Current workarounds:**

Users implement custom CSS animations via `st.html()` or custom components, which is
verbose, error-prone, and doesn't integrate with Streamlit's markdown rendering or theming.

## Proposal

### Syntax

```markdown
:shimmer[Some text content]
```

This follows Streamlit's existing text directive syntax (like `:red[text]`, `:small[text]`,
`:help[text]`).

### API Options

**Option 1: No configuration parameters** ✅ PREFERRED

```markdown
:shimmer[Thinking...]
```

A single, opinionated animation with sensible defaults. No duration or spread parameters.

- **Pros**: Simplest API, consistent look across all apps, no decision fatigue
- **Cons**: No customization for users who want different timings

**Option 2: Directive attributes for customization**

```markdown
:shimmer[Thinking...]{duration="1.5" spread="2"}
```

Allow duration (seconds) and spread (gradient width multiplier) as optional attributes.

- **Pros**: Flexibility for advanced use cases
- **Cons**: Adds complexity, attribute syntax less discoverable, most users won't need it

**Recommendation**: Start with Option 1. The directive syntax doesn't lend itself well to
complex configuration, and a single, well-tuned animation covers 95% of use cases. We can
revisit customization later if strong demand emerges.

### Behavior

- **Animation**: A subtle gradient highlight sweeps left-to-right across the text,
  creating a "shimmer" effect
- **Loop**: Animation loops infinitely until the directive is removed from the markdown
- **Theme-aware**: The shimmer gradient uses theme colors to blend naturally with both
  light and dark modes
- **Performance**: Pure CSS animation (no JavaScript runtime), minimal rendering overhead
- **Accessibility**: Respects `prefers-reduced-motion`—shimmer is static for users who
  disable animations

### Visual Design

The shimmer effect creates a moving gradient highlight that sweeps across the text:

```
Normal text:     "Thinking..."  (static gray)
Shimmer effect:  "Thinking..."  (gradient sweeps L→R, repeating)
```

**Implementation approach:**

- Use `background-clip: text` with a transparent text color
- Animate a linear gradient moving from left to right
- Gradient includes a bright highlight band that creates the "shimmer"
- CSS keyframe animation for smooth, infinite looping

### Examples

**Basic usage in `st.markdown`:**

```python
import streamlit as st

st.markdown(":shimmer[Generating response...]")
```

**Inside chat messages:**

```python
import streamlit as st

with st.chat_message("assistant"):
    st.markdown(":shimmer[Thinking...]")

# Later, replace with actual content
with st.chat_message("assistant"):
    st.write("Here's my response!")
```

**Status indicator:**

```python
import streamlit as st

if processing:
    st.markdown(":shimmer[Processing your request...]")
else:
    st.markdown(":green[Done!]")
```

**Combined with other directives:**

```python
import streamlit as st

# Shimmer with color (color takes precedence for text color, shimmer adds animation)
st.markdown(":shimmer[:blue[Loading data...]]")

# With material icons
st.markdown(":material/hourglass_empty: :shimmer[Please wait...]")
```

### Implementation Details

**Frontend (StreamlitMarkdown.tsx):**

Add a new remark plugin `createRemarkShimmer()` that handles the `:shimmer[]` directive:

```typescript
function createRemarkShimmer(theme: EmotionTheme) {
  return () => (tree: MdastRoot) => {
    visit(tree, "textDirective", (node) => {
      if (node.name === "shimmer") {
        const data = node.data || (node.data = {})
        data.hName = "span"
        data.hProperties = {
          className: "stMarkdownShimmer",
        }
      }
    })
    return tree
  }
}
```

**Styles (styled-components.ts):**

Add shimmer animation keyframes and class:

```typescript
const shimmerAnimation = keyframes`
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
`

// Inside StyledStreamlitMarkdown:
.stMarkdownShimmer {
  background: linear-gradient(
    90deg,
    ${theme.colors.textPlaceholder} 25%,
    ${theme.colors.text} 50%,
    ${theme.colors.textPlaceholder} 75%
  );
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  animation: ${shimmerAnimation} 2s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    background: none;
    color: ${theme.colors.textPlaceholder};
  }
}
```

**Plugin order:**

The shimmer plugin should run with other directive plugins (before
`createRemarkUnsupportedDirectivesCleanup`).

### Edge Cases

- **Nested in other directives**: `:red[:shimmer[text]]` applies both shimmer animation
  and red color. The inner directive wins for text color; shimmer provides animation.
- **Inside code blocks**: Not rendered (standard markdown behavior—directives don't
  apply inside backticks)
- **Empty content**: `:shimmer[]` renders as empty span (no visual effect)
- **Multiple shimmer spans**: Each animates independently (no synchronization needed)
- **Long text**: Animation scales with text length (gradient width is percentage-based)
- **RTL text**: Animation direction remains left-to-right (follows reading direction
  of shimmer effect, not text)

## Out of Scope (Future Work)

- **Duration/spread customization**: Start simple; add parameters if demand emerges
- **Block-level shimmer container**: A `:::shimmer` block directive for multi-line
  content shimmer effects
- **Skeleton shimmer variant**: A solid rectangle shimmer (like loading placeholders)
  would be a different feature, closer to `st.skeleton`
- **Shimmer color customization**: Using theme colors ensures visual consistency

## Checklist

| Item                       | ✅ or comment                                          |
| -------------------------- | ------------------------------------------------------ |
| Works on SiS, Cloud, etc?  | ✅ Pure CSS, no server dependencies                    |
| No breaking API changes    | ✅ Additive only                                       |
| No new dependencies        | ✅ Uses existing remark-directive infrastructure       |
| Metrics collected          | ✅ Can track directive usage via existing mechanisms   |
| Any security/legal impact? | ✅ No user input execution, pure styling               |
| Any docs changes needed?   | ✅ Document `:shimmer[]` in markdown reference         |
