# Add support for custom LaTeX delimiters in st.markdown()

Closes #9272

## Summary

This PR adds a new `latex_delimiters` parameter to `st.markdown()` and `st.caption()` that allows users to specify custom LaTeX delimiter pairs. This is particularly useful when displaying content from APIs like OpenAI/ChatGPT that use `\(` `\)` for inline math and `\[` `\]` for block math instead of Streamlit's default `$` and `$$`.

## Motivation

When working with OpenAI's chat completions API (or similar services), responses often contain LaTeX formatted with `\(` `\)` and `\[` `\]` delimiters. Currently, users need to manually replace these delimiters with `$` and `$$` before passing the text to `st.markdown()`. This approach has limitations:

1. Doesn't work well with streaming responses
2. Requires error-prone string manipulation
3. Adds unnecessary preprocessing code

## Changes

### Backend (Python)
- Modified `proto/streamlit/proto/Markdown.proto` to add `LaTeXDelimiters` message
- Updated `lib/streamlit/elements/markdown.py`:
  - Added `latex_delimiters` parameter to `markdown()` and `caption()` functions
  - Parameter accepts tuple of tuples: `((inline_open, inline_close), (block_open, block_close))`
  - Populated protobuf message when delimiters are provided

### Frontend (TypeScript)
- Updated `frontend/lib/src/components/elements/Markdown/Markdown.tsx` to extract and pass delimiters
- Modified `frontend/lib/src/components/shared/StreamlitMarkdown/StreamlitMarkdown.tsx`:
  - Added `latexDelimiters` to Props and RenderedMarkdownProps interfaces
  - Implemented delimiter transformation in `processedSource` useMemo
  - Converts custom delimiters to standard `$` and `$$` before rendering

## Usage Example

```python
import streamlit as st

# For OpenAI/ChatGPT responses
st.markdown(
    r"The equation \( E = mc^2 \) represents energy-mass equivalence.",
    latex_delimiters=((r"\(", r"\)"), (r"\[", r"\]"))
)

# Works with streaming too
response_text = ""
for chunk in openai_stream:
    response_text += chunk
    st.markdown(
        response_text,
        latex_delimiters=((r"\(", r"\)"), (r"\[", r"\]"))
    )
```

## Testing

- [x] Backend Python API implemented
- [x] Frontend TypeScript implementation complete
- [x] Delimiter transformation logic handles regex escaping
- [ ] Manual testing pending (requires full build)

## Notes

- The implementation converts custom delimiters to standard format before passing to KaTeX
- Regex special characters are properly escaped
- Backward compatible - existing code without `latex_delimiters` works unchanged
