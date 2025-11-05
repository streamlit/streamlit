# Frontend Implementation for Custom LaTeX Delimiters

## Current Status: Analysis Complete ✓

### Files Identified

1. **Markdown Wrapper**
   - File: `frontend/lib/src/components/elements/Markdown/Markdown.tsx`
   - Role: Receives protobuf element, extracts properties, passes to StreamlitMarkdown
   - Change needed: Extract `latexDelimiters` from element and pass to StreamlitMarkdown

2. **StreamlitMarkdown Component**
   - File: `frontend/lib/src/components/shared/StreamlitMarkdown/StreamlitMarkdown.tsx`
   - Role: Main rendering component that uses ReactMarkdown with plugins
   - Changes needed:
     a) Add `latexDelimiters` to Props interface
     b) Pass to RenderedMarkdown
     c) Add to RenderedMarkdownProps
     d) Configure remarkMathPlugin dynamically

### Implementation Plan

#### Step 1: Define TypeScript Interface (if protobuf not generated)
```typescript
interface LaTeXDelimiters {
  inlineOpen?: string;
  inlineClose?: string;
  blockOpen?: string;
  blockClose?: string;
}
```

#### Step 2: Update Props Interface
Location: Line ~82
```typescript
export interface Props {
  source: string
  allowHTML: boolean
  style?: CSSProperties
  isCaption?: boolean
  isLabel?: boolean
  boldLabel?: boolean
  largerLabel?: boolean
  disableLinks?: boolean
  isToast?: boolean
  inheritFont?: boolean
  latexDelimiters?: LaTeXDelimiters  // ADD THIS
}
```

#### Step 3: Update RenderedMarkdownProps
Location: Line ~315
```typescript
export interface RenderedMarkdownProps {
  source: string
  allowHTML: boolean
  overrideComponents?: Components
  isLabel?: boolean
  disableLinks?: boolean
  latexDelimiters?: LaTeXDelimiters  // ADD THIS
}
```

#### Step 4: Configure remarkMathPlugin
Location: Line ~659-666

Replace:
```typescript
const BASE_REMARK_PLUGINS = [
  remarkMathPlugin,
  remarkEmoji,
  remarkGfm,
  remarkDirective,
  createRemarkStreamlitLogo(),
  createRemarkTypographicalSymbols(),
]
```

With dynamic configuration in RenderedMarkdown:
```typescript
const remarkPlugins = useMemo(
  () => {
    const plugins: PluggableList = [];
    
    // Configure math plugin based on latexDelimiters
    if (latexDelimiters) {
      // Custom delimiters provided
      plugins.push([
        remarkMathPlugin,
        {
          // remark-math options for custom delimiters
          // Note: remark-math v6 has limited delimiter config
          // May need preprocessing or custom plugin
        }
      ]);
    } else {
      // Default behavior
      plugins.push(remarkMathPlugin);
    }
    
    plugins.push(
      remarkEmoji,
      remarkGfm,
      remarkDirective,
      createRemarkColoringAndSmall(theme, colorMapping),
      createRemarkMaterialIcons(theme)
    );
    
    return plugins;
  },
  [theme, colorMapping, latexDelimiters]
);
```

#### Step 5: Update StreamlitMarkdown Component
Location: Line ~810
```typescript
const StreamlitMarkdown: FC<Props> = ({
  source,
  allowHTML,
  style,
  isCaption,
  isLabel,
  boldLabel,
  largerLabel,
  disableLinks,
  isToast,
  inheritFont,
  latexDelimiters,  // ADD THIS
}) => {
  // ...
  return (
    <StyledStreamlitMarkdown ...>
      <RenderedMarkdown
        source={source}
        allowHTML={allowHTML}
        isLabel={isLabel}
        disableLinks={disableLinks}
        latexDelimiters={latexDelimiters}  // ADD THIS
      />
    </StyledStreamlitMarkdown>
  )
}
```

#### Step 6: Update Markdown.tsx Wrapper
Location: `frontend/lib/src/components/elements/Markdown/Markdown.tsx`

Change line ~45:
```typescript
const { allowHtml, body, elementType, help, isCaption, latexDelimiters } = element
```

Change line ~52-56:
```typescript
const markdown = (
  <StreamlitMarkdown
    isCaption={isCaption}
    source={body}
    allowHTML={allowHtml}
    latexDelimiters={latexDelimiters}
  />
)
```

### Challenge: remark-math Delimiter Configuration

**Issue:** remark-math v6 doesn't directly support custom delimiters like `\(` `\)` `\[` `\]`.

**Solutions:**
1. **Preprocessing:** Transform custom delimiters to $ and $$ before passing to remark-math
2. **Custom Plugin:** Create a remark plugin that handles custom delimiters
3. **Fork remark-math:** Extend with delimiter configuration
4. **Use Different Library:** Switch to a LaTeX parser with delimiter support

**Recommended:** Preprocessing approach (simplest and most compatible)

```typescript
const processedSource = useMemo(() => {
  let processed = source.replaceAll(":material/", ":material_");
  
  if (latexDelimiters) {
    const { inlineOpen, inlineClose, blockOpen, blockClose } = latexDelimiters;
    
    // Replace custom inline delimiters with $
    if (inlineOpen && inlineClose) {
      processed = processed.replace(
        new RegExp(`${escapeRegex(inlineOpen)}(.*?)${escapeRegex(inlineClose)}`, 'g'),
        '$$$1$$'
      );
    }
    
    // Replace custom block delimiters with $$
    if (blockOpen && blockClose) {
      processed = processed.replace(
        new RegExp(`${escapeRegex(blockOpen)}(.*?)${escapeRegex(blockClose)}`, 'gs'),
        '$$$$\n$1\n$$$$'
      );
    }
  }
  
  return processed;
}, [source, latexDelimiters]);
```

### Testing Strategy

1. **Unit Tests:** Add tests for delimiter transformation
2. **Integration Tests:** Test with ReactMarkdown rendering
3. **Visual Tests:** Compare rendering with different delimiters
4. **Edge Cases:**
   - Escaped delimiters
   - Nested delimiters
   - Mixed delimiters in same document
   - Empty delimiters

### Files to Modify

- ✅ `proto/streamlit/proto/Markdown.proto` (DONE)
- ✅ `lib/streamlit/elements/markdown.py` (DONE)
- ⏳ `frontend/lib/src/components/elements/Markdown/Markdown.tsx`
- ⏳ `frontend/lib/src/components/shared/StreamlitMarkdown/StreamlitMarkdown.tsx`
- ⏳ Add utility function for regex escaping
- ⏳ Add unit tests

### Next Commands

```bash
# Modify frontend files
# Run frontend tests
cd frontend && npm test

# Build frontend
npm run build

# Test full stack
streamlit run test_latex_delimiters.py
```

---
**Status:** Backend 100% ✓ | Frontend Analysis 100% ✓ | Frontend Implementation 0% ⏳
**Last Updated:** November 5, 2025
