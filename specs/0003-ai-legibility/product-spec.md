---
author: sfc-gh-amiribel
created: 2026-01-13
status: Draft
---

# Streamlit DOM is legible to AI: readable source metadata

## Summary

This proposal adds source code metadata to Streamlit's DOM output, making it possible for AI agents and coding assistants to understand the relationship between rendered UI elements and their underlying Python source code. When enabled, each Streamlit element in the DOM will carry hashed, non-sensitive identifiers linking it to the file and line number that produced it.

## Problem

### AI agents can't understand Streamlit apps

Modern AI-powered development tools (Cursor, VS Code Copilot, Cortex Code, etc.) rely heavily on DOM inspection to help developers debug and modify their applications. When a user clicks on a UI element or asks an agent to fix something, the agent inspects the DOM to understand what's happening.

For most web frameworks (React, Vue, Next.js), there's a direct correlation between DOM structure and source code:
- Component names appear in class names or data attributes
- CSS class names often match component file names
- The DOM hierarchy mirrors the component tree

**Streamlit has a DOM legibility problem.** When an agent inspects a Streamlit app's DOM, it sees:
- Generic class names like `stButton`, `stMarkdown`, `stTextInput`
- No indication of which Python file or line created the element
- No way to distinguish between two buttons created on different lines
- Container hierarchies that don't map obviously to `st.columns()`, `st.sidebar`, etc.

This makes it nearly impossible for AI agents to:
1. Navigate from a visual bug to the code that needs fixing
2. Understand which `st.button()` call corresponds to which button on screen
3. Help users modify specific parts of their Streamlit apps
4. Provide contextual suggestions based on what the user is looking at

### Why this matters now

As AI-assisted development becomes the norm, frameworks that aren't "AI-legible" will fall behind. Developers increasingly expect to point at something in their app and have an AI understand it. Streamlit's abstraction layer—which is a strength for simplicity—becomes a weakness when AI tools can't see through it.

### Prior art

An internal prototype ("Streamlit Manager") demonstrates this is solvable:
- Monkey-patches Streamlit functions at runtime to inject source location metadata
- Adds `data-line` and `data-file` attributes to DOM elements
- Uses base64-encoded (and easily hashable) file paths to avoid leaking source code
- A VS Code extension listens for cmd+clicks in the browser and jumps to the corresponding Python line

The prototype works but requires external tooling and monkey-patching. A native solution built into Streamlit would be more robust, maintainable, and discoverable by AI tools out of the box.

Note the `key=` parameter already surfaces in DOM as `st-key-{value}`, showing this pattern has precedent.

## Proposal

### Core concept

Embed source location metadata directly in Streamlit's DOM output, enabling tools to map UI elements back to their Python source. The metadata should be:

1. **Non-sensitive**: Never expose raw file paths or source code
2. **Deterministic**: Same code always produces same identifiers
3. **Comprehensive**: Cover all element types (widgets, text, charts, containers)
4. **Discoverable**: Use standard data attributes that tools can query

### Metadata format

Each Streamlit element would include attributes like:

```html
<div class="stButton" data-st-loc="a3f2b1" data-st-line="42" data-st-func="button">
  <button>Click me</button>
</div>
```

Where:
- `data-st-loc`: Hashed identifier for the source file (stable across runs)
- `data-st-line`: Line number in the source file
- `data-st-func`: The Streamlit function that created this element

The file hash would be computed from the file path, possibly with a session/app-specific salt, ensuring:
- Same file always produces same hash within a session
- Different apps don't produce correlatable hashes
- No way to reverse-engineer file paths from hashes

### Possible implementation approaches

> **Note**: This section outlines possibilities for discussion. The implementation details are TBD and should be refined by the Streamlit engineering team.

#### Approach A: Development mode only (`--dev` flag)

```bash
streamlit run app.py --dev
```

**Pros**:
- Zero production impact
- No security concerns in deployed apps
- Clear opt-in model

**Cons**:
- AI agents won't know to enable it
- Requires user action to benefit from AI assistance
- Community Cloud apps wouldn't have it enabled

#### Approach B: Always enabled with safe hashing

Metadata is always present in the DOM, but file paths are securely hashed.

**Pros**:
- Works everywhere, including Community Cloud
- AI tools automatically benefit
- No user configuration needed

**Cons**:
- Slightly larger DOM
- Need bulletproof hashing strategy
- Line numbers still reveal some structure info

#### Approach C: Configurable via `st.set_page_config()` or config.toml

```python
st.set_page_config(dev_mode=True)
```

or in `.streamlit/config.toml`:

```toml
[development]
sourceMetadata = true
```

**Pros**:
- Flexible per-app control
- Can be enabled in Community Cloud via config
- Clear documentation path

**Cons**:
- Another config option to learn
- Apps need to opt-in

### Security considerations

This feature MUST NOT expose sensitive information. Key safeguards:

1. **File path hashing**: Use a one-way hash (SHA-256 truncated) of the file path. The hash should be:
   - Consistent within a session for mapping purposes
   - Optionally salted with an app-specific secret to prevent cross-app correlation
   - Short enough to not bloat the DOM (6-8 characters)

2. **No source content**: Never embed actual Python code or variable values

3. **Line numbers**: Line numbers are relatively low-risk since they don't reveal content, but could be:
   - Offset by a random per-session value
   - Only shown in development mode

4. **Consider SiS/Cloud**: Streamlit in Snowflake and Community Cloud have different security models. The feature should work safely in both.

### What this enables

With source metadata in the DOM, AI tools can:

1. **Click-to-source**: User clicks element in browser → agent finds exact Python line
2. **Contextual assistance**: "Fix this button" → agent knows which `st.button()` call
3. **Visual debugging**: "Why is this chart empty?" → agent inspects correct `st.plotly_chart()` call
4. **Refactoring**: "Move this to the sidebar" → agent identifies element and suggests change
5. **Testing**: Generate targeted tests for specific UI elements

### Relationship to existing features

**`key=` parameter**: Already surfaces as `st-key-{value}` in class names. This proposal extends that pattern:
- `key` remains for developer-specified identifiers
- Source metadata is automatic and comprehensive
- Both can coexist (key for app logic, source loc for tooling)

**Protobuf/WebSocket messages**: Source metadata could be added to element messages, flowing from Python to frontend naturally.

### Open questions

1. Should line numbers be exact or approximate (e.g., function start)?
2. Should container boundaries (columns, sidebar, tabs) also have metadata?
3. Should the feature be enabled by default in future Streamlit versions?
4. How should multipage apps handle file hashes (per-page vs. app-wide)?
5. Should there be an API for AI tools to request a source map?

## Checklist

| Item                         | ✅ or comment                             |
|------------------------------|-------------------------------------------|
| Works on SiS, Cloud, etc?    | Yes, with secure hashing                  |
| No breaking API changes      | ✅ Additive only                          |
| No new dependencies          | ✅                                        |
| Metrics collected            | Could track dev mode usage                |
| Any security/legal impact?   | Must ensure hashing prevents path leakage |
| Any docs changes needed?     | Dev mode documentation, AI tool guides    |
| Any other risks?             | DOM size increase (minimal)               |
