---
author: lukasmasuch
created: 2025-12-10
status: Draft
depends_on: 0000-sprintf-thousand-separator
---

# Python Format String Support (Follow-up)

## Summary

Add support for Python's native format string syntax (`{:,d}`, `{:.2f}`, etc.) alongside the
existing sprintf syntax in Streamlit widgets. This gives users the option to use whichever
format syntax they're more comfortable with.

**Prerequisite:** This spec depends on the [Thousand Separator Support](./product-spec.md) spec
being implemented first (Phase 1).

## Problem

The original user request in [#1301](https://github.com/streamlit/streamlit/issues/1301) (130+ upvotes)
asked for Python-style format strings. While Phase 1 adds thousand separators to sprintf syntax
(`%,d`), some users may prefer the native Python syntax they're already familiar with (`{:,d}`).

## Proposal

### Overview

Implement auto-detection to support both sprintf (`%d`) and Python (`{:d}`) format syntaxes in
the same `format` parameter. The two syntaxes use different delimiters (`%` vs `{}`), making
them fully distinguishable without conflicts.

### Syntax Comparison

#### Core Type Specifiers

| Feature | sprintf (C-style) | Python format | Notes |
|---------|-------------------|---------------|-------|
| **Placeholder delimiter** | `%` | `{}` | Orthogonal — no conflict |
| **Integer (signed)** | `%d`, `%i` | `{:d}` | Equivalent |
| **Integer (unsigned)** | `%u` | ❌ N/A | Python uses `{:d}` for all |
| **Float (fixed)** | `%f` | `{:f}` | Equivalent |
| **Float (uppercase)** | `%F` | `{:F}` | Shows `INF`/`NAN` uppercase |
| **Scientific** | `%e`, `%E` | `{:e}`, `{:E}` | Equivalent |
| **General** | `%g`, `%G` | `{:g}`, `{:G}` | Auto float/scientific |
| **Hexadecimal** | `%x`, `%X` | `{:x}`, `{:X}` | Equivalent |
| **Octal** | `%o` | `{:o}` | Equivalent |
| **Binary** | `%b` | `{:b}` | Equivalent |
| **String** | `%s` | `{:s}` or `{}` | Equivalent |
| **Character** | `%c` | `{:c}` | From char code |
| **Percent** | ❌ N/A | `{:%}`, `{:.2%}` | Python-only: multiplies by 100 |
| **Locale-aware** | ❌ N/A | `{:n}` | Python-only: uses locale settings |

#### sprintf-Specific Types (No Python Equivalent)

| Feature | sprintf | Description |
|---------|---------|-------------|
| **JSON** | `%j` | `JSON.stringify()` output |
| **Boolean** | `%t` | `"true"` / `"false"` |
| **Type name** | `%T` | e.g., `"number"`, `"string"` |
| **valueOf** | `%v` | Calls `.valueOf()` |

#### Width, Precision, and Padding

| Feature | sprintf | Python format | Notes |
|---------|---------|---------------|-------|
| **Width** | `%10d` | `{:10d}` | Equivalent |
| **Precision** | `%.2f` | `{:.2f}` | Equivalent |
| **Zero padding** | `%010d` | `{:010d}` | Equivalent |
| **Custom fill char** | `%'*10d` | `{:*>10d}` | Different syntax |

#### Alignment

| Feature | sprintf | Python format | Notes |
|---------|---------|---------------|-------|
| **Left align** | `%-10d` | `{:<10d}` | Equivalent |
| **Right align** | `%10d` (default) | `{:>10d}` | Equivalent |
| **Center align** | ❌ N/A | `{:^10d}` | Python-only |
| **Sign-aware padding** | ❌ N/A | `{:=+10d}` | Python-only: `+    123` |

#### Sign Handling

| Feature | sprintf | Python format | Notes |
|---------|---------|---------------|-------|
| **Always show sign** | `%+d` | `{:+d}` | Equivalent |
| **Minus only** | `%d` (default) | `{:-d}` | Equivalent |
| **Space for positive** | `% d` | `{: d}` | Equivalent |
| **Negative zero → positive** | ❌ N/A | `{:z}` | Python 3.11+ only |

#### Grouping (Thousand Separators)

| Feature | sprintf | Python format | Notes |
|---------|---------|---------------|-------|
| **Comma separator** | `%,d` (Streamlit) | `{:,d}` or `{:,}` | Both supported |
| **Underscore separator** | `%_d` (Streamlit) | `{:_d}` or `{:_}` | Both supported |
| **Custom separator** | `%'.,d` → `1.234.567` | ❌ N/A | sprintf-only (via pad char) |

#### Alternate Forms

| Feature | sprintf | Python format | Notes |
|---------|---------|---------------|-------|
| **Hex prefix** | ❌ N/A | `{:#x}` → `0xff` | Python-only |
| **Octal prefix** | ❌ N/A | `{:#o}` → `0o17` | Python-only |
| **Binary prefix** | ❌ N/A | `{:#b}` → `0b1010` | Python-only |
| **Float decimal point** | ❌ N/A | `{:#.0f}` → `1.` | Forces decimal point |

#### Argument References

| Feature | sprintf | Python format | Notes |
|---------|---------|---------------|-------|
| **Positional (implicit)** | `%d %d` | `{} {}` | Equivalent |
| **Positional (explicit)** | `%1$d` (1-based) | `{0:d}` (0-based) | Different indexing |
| **Named arguments** | `%(name)s` | `{name}` | Both supported |
| **Attribute access** | `%(obj.attr)s` | `{obj.attr}` | Both supported |
| **Index access** | `%(arr[0])s` | `{arr[0]}` | Both supported |

#### Escape Sequences

| Feature | sprintf | Python format | Notes |
|---------|---------|---------------|-------|
| **Literal `%`** | `%%` | `%` (no escape needed) | Different |
| **Literal `{`** | `{` (literal) | `{{` | Different |
| **Literal `}`** | `}` (literal) | `}}` | Different |

#### Conversion Flags (Python-only)

| Feature | sprintf | Python format | Notes |
|---------|---------|---------------|-------|
| **repr()** | ❌ N/A | `{!r}` | Not relevant for numbers |
| **str()** | ❌ N/A | `{!s}` | Not relevant for numbers |
| **ascii()** | ❌ N/A | `{!a}` | Not relevant for numbers |

#### Advanced Features

| Feature | sprintf | Python format | Notes |
|---------|---------|---------------|-------|
| **Dynamic width** | ❌ N/A | `{:{width}d}` | Python-only |
| **Dynamic precision** | ❌ N/A | `{:.{prec}f}` | Python-only |
| **Expressions in format** | ❌ N/A | f-string only | Out of scope |

### Feature Support Summary

For Streamlit's use case (formatting numbers in widgets), the most relevant features are:

| Feature | sprintf | Python | Recommendation |
|---------|---------|--------|----------------|
| Basic number types | ✅ | ✅ | Support both |
| Width/precision | ✅ | ✅ | Support both |
| Thousand separators | ✅ (Phase 1) | ✅ | Support both |
| Alignment | Partial | ✅ | Python adds center |
| Percent format | ❌ | ✅ | Python advantage |
| Alternate form (`#`) | ❌ | ✅ | Python advantage |
| Custom separators | ✅ | ❌ | sprintf advantage |
| JSON/Boolean/Type | ✅ | ❌ | sprintf-only |

### Scope Definition

**✅ In Scope:**

| Feature | Example | Rationale |
|---------|---------|-----------|
| Type specifiers | `{:d}`, `{:f}`, `{:e}`, `{:g}`, `{:x}`, `{:o}`, `{:b}`, `{:s}` | Core formatting |
| Width | `{:10d}` | Common use case |
| Precision | `{:.2f}` | Common use case |
| Alignment | `{:<}`, `{:>}`, `{:^}` | Python advantage over sprintf |
| Fill character | `{:*>10}` | Useful for padding |
| Sign options | `{:+}`, `{:-}`, `{: }` | Parity with sprintf |
| Zero padding | `{:010d}` | Common use case |
| Thousand separators | `{:,}`, `{:_}` | Main feature request |
| Percent type | `{:.2%}` | Python advantage |
| Alternate form | `{:#x}` → `0xff` | Useful for hex/octal/binary |
| Simple positional | `{0}`, `{1}` | Basic argument reference |
| Escape sequences | `{{`, `}}` | Necessary for literal braces |

**❌ Out of Scope:**

| Feature | Example | Rationale |
|---------|---------|-----------|
| Named arguments | `{name}` | Adds complexity; sprintf covers this |
| Attribute/index access | `{obj.attr}`, `{arr[0]}` | Too complex for format strings |
| Dynamic width/precision | `{:{w}.{p}f}` | Requires nested argument passing |
| Conversion flags | `{!r}`, `{!s}`, `{!a}` | Not relevant for number display |
| `n` locale type | `{:n}` | Use preset `"localized"` instead |
| `z` negative zero | `{:z}` | Niche Python 3.11+ feature |
| `=` sign-aware padding | `{:=+10d}` | Rarely needed |

**Rationale:** Focus on features that add value over sprintf (center alignment, percent format,
alternate forms) while keeping implementation manageable. Complex features like named arguments
and attribute access are already well-served by sprintf's `%(name)s` syntax.

### Backwards Compatibility Analysis

**✅ Fully backwards compatible** — The two syntaxes use completely different delimiters:

- **sprintf placeholders** start with `%`
- **Python placeholders** use `{...}`

This orthogonality means both syntaxes can coexist without conflicts:

```python
# Existing sprintf (continues to work unchanged)
st.slider("Revenue", format="$%,d")        # → $1,234,567
st.slider("Price", format="%.2f€")         # → 1234.56€

# New Python-style (would also work)
st.slider("Revenue", format="${:,d}")      # → $1,234,567
st.slider("Price", format="{:.2f}€")       # → 1234.56€
```

**Edge cases and their handling:**

| Scenario | Current Result | With Python Support | Breaking? |
|----------|----------------|---------------------|-----------|
| `$%,d` with `1234567` | `$1,234,567` | `$1,234,567` (sprintf) | ✅ No |
| `${:,d}` with `1234567` | `${:,d}` (literal) | `$1,234,567` (Python) | ⚠️ Minor* |
| `%%` | `%` (escape) | `%` (sprintf escape) | ✅ No |
| `{{` / `}}` | `{{` / `}}` (literal) | `{` / `}` (Python escape) | ⚠️ Minor* |
| Literal `{` in sprintf | `{` (literal) | Detection needed | ⚠️ Edge case |

\* These edge cases would only affect users who have literal `{...}` text in their format strings
that happens to match Python format syntax. This is extremely rare since current sprintf formats
don't use curly braces meaningfully.

### Detection Strategy

Auto-detect the format type based on syntax patterns:

```typescript
function detectFormatType(format: string): "sprintf" | "python" | "preset" {
  // Check for preset formats first (plain, localized, percent, dollar, etc.)
  if (PRESET_FORMATS.includes(format)) {
    return "preset"
  }

  // Python format detection:
  // - Simple: {} or {:d} or {:.2f}
  // - Positional: {0} or {0:d}
  // - Named: {name} or {name:d}
  // But NOT sprintf named args like %(name)s
  const pythonPattern = /\{(?:[a-zA-Z_]\w*|\d+)?(?:![rsa])?(?::[^}]*)?\}/
  if (pythonPattern.test(format) && !/%\([^)]+\)/.test(format)) {
    return "python"
  }

  // Default to sprintf for % patterns or unknown formats
  return "sprintf"
}
```

**Detection rules:**

1. Preset keywords (`plain`, `localized`, `percent`, `dollar`, etc.) → use preset formatter
2. Contains `{...}` with valid Python format spec → use Python formatter
3. Contains `%...` patterns → use sprintf formatter
4. Mixed patterns → error or sprintf fallback (TBD)

### Implementation Approach

**Python Format Spec Grammar (from [PEP 3101](https://peps.python.org/pep-3101/)):**

```
replacement_field ::= "{" [field_name] ["!" conversion] [":" format_spec] "}"
field_name        ::= arg_name ("." attribute_name | "[" element_index "]")*
arg_name          ::= [identifier | digit+]
format_spec       ::= [[fill]align][sign]["z"]["#"]["0"][width][grouping]["." precision][type]
fill              ::= <any character>
align             ::= "<" | ">" | "=" | "^"
sign              ::= "+" | "-" | " "
width             ::= digit+
grouping          ::= "_" | ","
precision         ::= digit+
type              ::= "b" | "c" | "d" | "e" | "E" | "f" | "F" | "g" | "G" | "n" | "o" | "s" | "x" | "X" | "%"
```

**Simplified implementation (in-scope subset):**

```typescript
// Regex to parse Python format spec (simplified for in-scope features)
const PYTHON_FORMAT_SPEC = /^(?:(.)?([<>^]))?([+\- ])?([#])?([0])?(\d+)?([,_])?(?:\.(\d+))?([bcdoxXeEfFgGs%])?$/

interface PythonFormatSpec {
  fill?: string        // Fill character (default: space)
  align?: '<' | '>' | '^'  // Alignment
  sign?: '+' | '-' | ' '   // Sign handling
  alternate?: boolean  // # flag for 0x, 0o, 0b prefixes
  zeroPad?: boolean    // 0 flag
  width?: number       // Minimum field width
  grouping?: ',' | '_' // Thousand separator
  precision?: number   // Decimal places
  type?: string        // d, f, e, x, %, etc.
}

function parsePythonFormat(spec: string): PythonFormatSpec {
  const match = PYTHON_FORMAT_SPEC.exec(spec)
  if (!match) throw new SyntaxError(`Invalid format spec: ${spec}`)

  return {
    fill: match[1],
    align: match[2] as '<' | '>' | '^',
    sign: match[3] as '+' | '-' | ' ',
    alternate: match[4] === '#',
    zeroPad: match[5] === '0',
    width: match[6] ? parseInt(match[6], 10) : undefined,
    grouping: match[7] as ',' | '_',
    precision: match[8] ? parseInt(match[8], 10) : undefined,
    type: match[9],
  }
}
```

**Estimated implementation effort:** ~2-3 days for a senior developer, including:
- Format spec parser (~150 lines)
- Format application logic (~150 lines)
- Detection/routing logic (~50 lines)
- Comprehensive tests (~200 lines)

### Benefits

1. **Familiar to Streamlit users** — Python developers know `f"{x:,}"` syntax natively
2. **More features** — Center alignment (`{:^10}`), percent formatting (`{:.2%}`)
3. **Directly addresses [#1301](https://github.com/streamlit/streamlit/issues/1301)** — The original request was for Python format
4. **No migration required** — Existing sprintf formats continue working

### Considerations

| Aspect | Assessment |
|--------|------------|
| **Backwards compatibility** | ✅ Fully compatible (different delimiters) |
| **Implementation complexity** | Medium (~200-300 lines for Python parser) |
| **Documentation burden** | Medium (need to explain both syntaxes) |
| **User confusion** | Low (can use whichever they prefer) |
| **Maintenance** | Medium (two parsers to maintain) |

### Recommendation

1. **Ship Phase 1 first** — Get feedback on thousand separators with sprintf
2. **Evaluate demand** — See if users still want native Python syntax after Phase 1
3. **Phase 2 implementation** — Add Python parser with auto-detection if demand exists

This staged approach:
- Keeps the current scope focused
- Allows time to design detection logic properly
- Provides immediate value with thousand separators
- Leaves door open for full Python format support

## Checklist

| Item | ✅ or comment |
|------|---------------|
| Works on SiS, Cloud, etc? | ✅ Frontend-only change, works everywhere |
| No breaking API changes | ✅ Auto-detection preserves existing sprintf behavior |
| No new dependencies | ✅ Pure TypeScript implementation |
| Metrics collected | ✅ |
| Any security/legal impact? | ✅ None |
| Any docs changes needed? | ✅ Document Python format syntax alongside sprintf |
