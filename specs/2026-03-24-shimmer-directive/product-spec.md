---
author: lukasmasuch
created: 2026-03-24
---

# `:shimmer[text]` Markdown Directive

## Summary

Add a `:shimmer[text]` markdown directive that creates an animated gradient sweep effect across
text. This provides a modern, AI-native visual pattern to communicate "thinking" or "loading"
states, available anywhere Streamlit renders markdown.

## Problem

AI-powered applications need visual feedback during processing. A subtle animated shimmer
effect on text is a widely-adopted pattern in AI interfaces (ChatGPT, Claude, Copilot) to
communicate "thinking" or "loading" without distracting the user.

Currently, achieving this effect in Streamlit requires custom CSS via `st.html()`. This approach
is cumbersome, doesn't integrate with Streamlit's theming system, and requires users to
understand CSS animations.

**User request:**

- [#13247][issue-13247] - Add animated text shimmer as markdown directive

**Use cases:**

- **AI response generation**: Show "Thinking..." with shimmer while waiting for LLM responses
- **Streaming indicators**: Display shimmer before content starts streaming
- **Progressive reveals**: Animate text as it becomes available
- **Loading states**: Indicate processing in any markdown-supporting context

[issue-13247]: https://github.com/streamlit/streamlit/issues/13247

## Proposal

### Syntax

```markdown
:shimmer[Some text content]
```

The directive follows the existing markdown directive pattern used by `:red[text]`
and other Streamlit markdown extensions.

### Usage

The shimmer directive works anywhere Streamlit renders markdown:

```python
import streamlit as st

# In st.markdown
st.markdown(":shimmer[Thinking...]")

# In st.write
st.write(":shimmer[Processing your request...]")

# In widget labels
st.button(":shimmer[Loading...]", disabled=True)

# In chat messages
with st.chat_message("assistant"):
    st.markdown(":shimmer[Generating response...]")

# Combined with other text
st.markdown("Status: :shimmer[Analyzing data...]")
```

### Behavior

**Animation:**

The shimmer effect is a smooth, continuous CSS animation where a highlight gradient sweeps
across the text from right to left. The animation:

- Loops indefinitely until the element is removed or replaced
- Uses an 8-second cycle duration for a subtle, non-distracting effect
- Applies a linear gradient that creates a subtle "shine" effect

**Theme integration:**

The shimmer gradient uses Streamlit's theme colors automatically:

- **Light theme**: Gradient from text color to a lighter highlight and back
- **Dark theme**: Gradient from text color to a brighter highlight and back

This ensures the shimmer looks appropriate in both themes without configuration.

**Accessibility:**

The animation respects the user's `prefers-reduced-motion` preference. When reduced motion
is preferred, the shimmer effect is disabled and text displays statically. This avoids
discomfort for users with vestibular disorders.

**Composition:**

The shimmer directive can be combined with other markdown directives:

```python
# Shimmer with color
st.markdown(":red[:shimmer[Error loading...]]")

# Shimmer with bold
st.markdown("**:shimmer[Important update loading...]**")

# Shimmer in a link (shimmer applies to link text)
st.markdown(":shimmer[[Click here](https://example.com)]")
```

### Design

The shimmer effect uses CSS `background-clip: text` with an animated linear gradient. A
highlight band continuously sweeps across the text from right to left, creating a subtle
"shine" effect. The gradient transitions smoothly from the base text color to a brighter
highlight and back, giving the appearance of light passing over the text.

### Examples

**Basic shimmer in chat:**

```python
import streamlit as st
import time

if prompt := st.chat_input("Ask me anything"):
    st.chat_message("user").write(prompt)

    with st.chat_message("assistant"):
        placeholder = st.empty()
        placeholder.markdown(":shimmer[Thinking...]")
        time.sleep(2)  # Simulate API call
        placeholder.markdown("Here's my response!")
```

**Shimmer with streaming:**

```python
import streamlit as st

with st.chat_message("assistant"):
    placeholder = st.empty()
    placeholder.markdown(":shimmer[Generating...]")

    # Start streaming
    response = ""
    for chunk in generate_response():
        response += chunk
        placeholder.markdown(response + ":shimmer[...]")

    # Final response without shimmer
    placeholder.markdown(response)
```

**Status indicator:**

```python
import streamlit as st

col1, col2 = st.columns(2)
with col1:
    st.markdown("**Database:** :green[Connected]")
with col2:
    st.markdown("**AI Model:** :shimmer[Loading...]")
```

## Out of Scope (Future Work)

The following features are intentionally excluded from the initial implementation:

**Customization parameters:**

The initial implementation has no configuration—a single, opinionated animation with sensible
defaults. This maximizes simplicity and ensures visual consistency across applications.
Parameters like `speed`, `intensity`, or `color` could be added later based on user feedback.

**`st.shimmer` context manager ([#14266][issue-14266]):**

A future addition could provide `st.shimmer` as a context manager similar to `st.spinner`:

```python
with st.shimmer("Thinking..."):
    result = expensive_operation()
```

This would automatically show/hide the shimmer around a code block. The markdown directive
provides the foundational animation; the context manager would be a convenience wrapper.

[issue-14266]: https://github.com/streamlit/streamlit/issues/14266

## Checklist

| Item                       | ✅ or comment                                                        |
| -------------------------- | -------------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | ✅ Yes - pure CSS animation, no server dependencies                  |
| No breaking API changes    | ✅ Yes - new directive, additive change                              |
| No new dependencies        | ✅ Yes - uses existing remark plugin infrastructure                  |
| Metrics collected          | ✅ N/A - markdown directives don't have individual metrics           |
| Any security/legal impact? | ✅ No                                                                |
| Any docs changes needed?   | ✅ Yes - add to markdown directives documentation                    |
