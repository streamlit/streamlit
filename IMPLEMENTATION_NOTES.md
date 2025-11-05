# Custom LaTeX Delimiters Implementation

## Issue
[#9272](https://github.com/streamlit/streamlit/issues/9272) - Support custom LaTeX delimiters

## Problem Statement
OpenAI/ChatGPT and other LLM APIs return LaTeX using delimiters `\(` `\)` for inline math and `\[` `\]` for block math. Streamlit only supports `$` and `$$`, requiring users to manually replace delimiters, which doesn't work well with streaming responses.

## Solution Overview
Add a `latex_delimiters` parameter to `st.markdown()` and `st.caption()` that allows custom LaTeX delimiter configuration.

## Changes Made

### 1. Protocol Buffer (✅ COMPLETE)
**File:** `proto/streamlit/proto/Markdown.proto`

Added:
```protobuf
message LaTeXDelimiters {
  string inline_open = 1;   // e.g., "$" or "\\("
  string inline_close = 2;  // e.g., "$" or "\\)"
  string block_open = 3;    // e.g., "$$" or "\\["
  string block_close = 4;   // e.g., "$$" or "\\]"
}

LaTeXDelimiters latex_delimiters = 6;
```

### 2. Python Backend (✅ COMPLETE)
**File:** `lib/streamlit/elements/markdown.py`

#### Added parameter to `markdown()`:
```python
def markdown(
    self,
    body: SupportsStr,
    unsafe_allow_html: bool = False,
    *,
    help: str | None = None,
    width: Width = "stretch",
    latex_delimiters: tuple[tuple[str, str], tuple[str, str]] | None = None,
) -> DeltaGenerator:
```

#### Added parameter to `caption()`:
```python
def caption(
    self,
    body: SupportsStr,
    unsafe_allow_html: bool = False,
    *,
    help: str | None = None,
    width: Width = "stretch",
    latex_delimiters: tuple[tuple[str, str], tuple[str, str]] | None = None,
) -> DeltaGenerator:
```

#### Implementation logic:
```python
if latex_delimiters is not None:
    inline_delims, block_delims = latex_delimiters
    markdown_proto.latex_delimiters.inline_open = inline_delims[0]
    markdown_proto.latex_delimiters.inline_close = inline_delims[1]
    markdown_proto.latex_delimiters.block_open = block_delims[0]
    markdown_proto.latex_delimiters.block_close = block_delims[1]
```

### 3. Frontend (⏳ TODO)
**File:** `frontend/lib/src/components/shared/StreamlitMarkdown/StreamlitMarkdown.tsx`

#### Required changes:
1. Extract `latex_delimiters` from Markdown protobuf message
2. Configure `remarkMathPlugin` with custom delimiters
3. Map protobuf format to remark-math plugin format

#### remark-math configuration:
```typescript
// Current (hardcoded):
const plugins = [
  remarkMathPlugin,  // Uses default $ and $$ delimiters
  // ...
];

// Needed (dynamic):
const mathPluginConfig = latexDelimiters ? {
  // Configure based on protobuf delimiters
  singleDollarTextMath: latexDelimiters.inlineOpen === '$',
  // Additional configuration for \( and \[ delimiters
} : undefined;

const plugins = [
  [remarkMathPlugin, mathPluginConfig],
  // ...
];
```

### 4. Write Integration (⏳ TODO)
**File:** `lib/streamlit/elements/write.py`

The `st.write()` and `st.write_stream()` functions should propagate `latex_delimiters` when they call `markdown()` internally.

## Next Steps

### Step 1: Install Protocol Buffer Compiler
```bash
# On Windows (via scoop or chocolatey):
scoop install protobuf
# OR
choco install protobuf

# Verify installation:
protoc --version  # Should be >= 3.20
```

### Step 2: Rebuild Protocol Buffers
```bash
cd /c/Users/sayda/streamlit
make protobuf
```

This will generate:
- `lib/streamlit/proto/Markdown_pb2.py` (Python bindings)
- `lib/streamlit/proto/Markdown_pb2.pyi` (Type stubs)
- Frontend protobuf files

### Step 3: Implement Frontend Changes
Modify `frontend/lib/src/components/shared/StreamlitMarkdown/StreamlitMarkdown.tsx`:
1. Import and use the LaTeXDelimiters from protobuf
2. Configure remarkMathPlugin dynamically
3. Test rendering with both default and custom delimiters

### Step 4: Update st.write() and st.write_stream()
Add latex_delimiters parameter and pass it through to markdown() calls.

### Step 5: Write Tests
Create unit tests in:
- `lib/tests/streamlit/elements/markdown_test.py` (Python)
- Frontend test files (TypeScript)

Test cases:
- Default behavior (backward compatibility)
- OpenAI format: `((r"\(", r"\)"), (r"\[", r"\]"))`
- Mixed content (markdown + LaTeX)
- Invalid delimiter configurations

### Step 6: Create Example App
Create `examples/latex_delimiters_demo.py` showing:
- Integration with OpenAI API
- Streaming responses with custom delimiters
- Comparison of default vs custom delimiters

### Step 7: Documentation
- Update API reference for st.markdown()
- Update API reference for st.caption()
- Add example to docstrings
- Update changelog

### Step 8: Submit PR
- Run tests: `make pytest`
- Run linters: `make lint`
- Push to fork
- Create pull request with:
  - Clear description
  - Link to issue #9272
  - Screenshots/GIFs showing the feature
  - Test results

## Testing Instructions

Once protobufs are rebuilt, run the test script:
```bash
streamlit run test_latex_delimiters.py
```

## Usage Examples

### Basic Usage
```python
import streamlit as st

# Default delimiters ($ and $$)
st.markdown("Inline: $x^2$ and block: $$y = mx + b$$")

# OpenAI/ChatGPT delimiters
st.markdown(
    "Inline: \\(x^2\\) and block: \\[y = mx + b\\]",
    latex_delimiters=((r"\(", r"\)"), (r"\[", r"\]"))
)
```

### With OpenAI API
```python
import streamlit as st
from openai import OpenAI

client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Explain Einstein's equation"}],
    stream=True
)

# Stream with custom delimiters
for chunk in response:
    content = chunk.choices[0].delta.content
    if content:
        st.write_stream(
            content,
            latex_delimiters=((r"\(", r"\)"), (r"\[", r"\]"))
        )
```

## Backward Compatibility
✅ Fully backward compatible - `latex_delimiters=None` (default) uses existing behavior.

## Performance Impact
Minimal - delimiter configuration only happens when markdown is rendered.

## Security Considerations
LaTeX rendering is handled by KaTeX, which is already sanitized. Custom delimiters don't introduce new security vectors.

## Related Issues
- #9272 - Original feature request
- Similar feature in Gradio: `latex_delimiter` parameter

## Commit
- SHA: 0da501a0f
- Branch: feature/custom-latex-delimiters
- Files changed: 2 (Markdown.proto, markdown.py)
