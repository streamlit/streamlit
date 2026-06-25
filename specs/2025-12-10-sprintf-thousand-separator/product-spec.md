---
author: lukasmasuch
created: 2025-12-10
---

# Thousand separator support in sprintf format strings

## Summary

Extend Streamlit's sprintf (printf-style) format strings to support thousand separators using `,` and
`_` flags, mirroring Python's format syntax. This enables formatting like `%,d` →
`1,234,567` or `%_d` → `1_234_567` in widgets and column configurations that accept format
strings.

## Problem

Users want to display large numbers with thousand separators for better readability in
features like `st.slider`, `st.column_config.NumberColumn`, and `st.metric`. Currently, Streamlit
uses printf-style format strings (via sprintf-js), but this library doesn't support
thousand separators. Users have requested Python-like formatting where `f"{x:,}"` adds
comma separators.

**User requests:**

- [#1301](https://github.com/streamlit/streamlit/issues/1301) — Improve our format
  parameter as python format
- [#7702](https://github.com/streamlit/streamlit/issues/7702) — Change the character of
  the thousand and decimal separator in `st.data_editor` and `st.dataframe`

## Proposal

### Format Syntax

Add two new flags to printf-style format specifiers (placed after the `%` sign):

| Flag | Separator | Example Format | Example Output |
|------|-----------|----------------|----------------|
| `,` | Comma | `%,d` | `1,234,567` |
| `_` | Underscore | `%_d` | `1_234_567` |

These flags are equivalent to Python's [format specifiers for thousand separators](https://docs.python.org/3/library/string.html#format-specification-mini-language)
`:,` and `:_` (e.g., `f"{x:,}"` or `f"{x:_}"`).

The thousand separator flags work with all sprintf features (width, precision, sign, padding, etc.)
and are applied after the base formatting. The separator is inserted every 3 digits in the integer
portion of numeric output.

### Examples

```python
import streamlit as st

# Slider with thousand separators
st.slider("Revenue", 0, 10_000_000, value=1_234_567, format="$%,d")
# Displays: $1,234,567

# Metric with thousand separators
st.metric("Revenue", 1234567, format="$%,d")
# Displays: $1,234,567

# Dataframe column configuration
st.dataframe(
    df,
    column_config={
        "revenue": st.column_config.NumberColumn(format="$%,.2f"),
        "progress": st.column_config.ProgressColumn(format="%,d"),
    }
)
```

### Behavior

**Format specifier compatibility:**

The thousand separator flags (`,` and `_`) apply to numeric format specifiers `d`, `i`, `u`, `f`,
`e`, and `g`. The separator is inserted every 3 digits in the **integer portion** of the formatted output.

| Specifier | Description | Example | Output |
|-----------|-------------|---------|--------|
| `%,d` | Signed decimal integer | `%,d` with `1234567` | `1,234,567` |
| `%,i` | Signed decimal integer (alias) | `%,i` with `1234567` | `1,234,567` |
| `%,u` | Unsigned decimal integer | `%,u` with `1234567` | `1,234,567` |
| `%,f` | Floating point | `%,.2f` with `1234567.89` | `1,234,567.89` |
| `%,e` | Scientific notation | `%,e` with `1234567` | `1.234567e+6` (mantissa is < 1000) |
| `%,g` | General format | `%,g` with `1234567` | `1.23457e+6` or `1,234,567` |
| `%,o` | Octal | `%,o` with `1234567` | `4553207` (flag ignored) |
| `%,x` | Hexadecimal | `%,x` with `1234567` | `12d687` (flag ignored) |
| `%,s` | String | `%,s` with `"hello"` | `hello` (flag ignored) |

> **Note:** For `%,e` (scientific notation), the mantissa is always between 1 and 10, so separators
> have no visible effect. For `%,g`, the output format depends on the magnitude—large numbers may
> use scientific notation (no visible separators) or decimal format (separators applied).

**Flag combinations:**

- Works with sign flag: `%+,d` with `1234567` → `+1,234,567`
- Works with width: `%,15d` with `1234567` → `1,234,567` (right-aligned, space-padded)
- Works with precision: `%,.2f` with `1234.56` → `1,234.56`
- Works with zero padding: `%0,10d` with `1234` → `000001,234`
- Works with alignment: `%-,15d` with `1234567` → `1,234,567` (left-aligned)
- Works with prefixes/suffixes: `$%,d` with `1234567` → `$1,234,567`

**Custom separators via pad character:**

When using the comma flag with a custom pad character (`%'X,`), the pad character becomes the
thousand separator instead of a comma:

- `%'_,d` with `1234567` → `1_234_567` (underscore separator)
- `%'.,d` with `1234567` → `1.234.567` (period separator for European formatting)
- `%' ,d` with `1234567` → `1 234 567` (space separator)

> **Note:** The custom pad character is an already supported feature in sprintf-js.

**Unsupported specifiers:**

The `,` and `_` flags are silently ignored (not causing a syntax error) for non-decimal formats (`%o`, `%x`, `%X`, `%b`)
and non-numeric format types (`%s`, `%c`, `%t`, `%T`). The flag is captured but has no effect.

### Affected Components

This feature affects the following elements that support the `format` parameter:

- `st.column_config.NumberColumn` — `format` parameter
- `st.column_config.ProgressColumn` — `format` parameter
- `st.metric` — `format` parameter
- `st.slider` — `format` parameter

`st.number_input` is **out of scope** for the initial implementation. The underlying React component
doesn't separate display formatting from input validation only supporting very limited format options already. This is tracked separately in [#4897](https://github.com/streamlit/streamlit/issues/4897).

### Implementation Notes

The implementation vendors [sprintf-js](https://github.com/alexei/sprintf.js) as TypeScript
and extends the format parser to recognize `,` and `_` as thousand separator flags.
Separators are inserted every 3 digits in the integer portion of the number.

Thousand separator support has been a long-standing feature request for sprintf-js itself
([sprintf.js#124](https://github.com/alexei/sprintf.js/issues/124)),
but the library hasn't been maintained for over 2 years. By vendoring the library, we can
add this feature independently while also allowing us to maintain it ourselves. The implementation is only a single file with a couple hundred lines of code.

## Future Enhancement: Python Format String Support

As a potential follow-up, we could additionally support Python's native format string syntax
(`{:,d}`, `{:.2f}`, etc.) alongside sprintf. Analysis shows this is **fully backwards compatible**
since the two syntaxes use different delimiters (`%` vs `{}`).


**See:** [follow-up-python-format-spec.md](./follow-up-python-format-spec.md) for the full analysis
including syntax comparison tables, scope definition, and implementation approach.


## Checklist

| Item | ✅ or comment |
|------|---------------|
| Works on SiS, Cloud, etc? | ✅ Frontend-only change, works everywhere |
| No breaking API changes | ✅ Using `,` or `_` after `%` previously caused an error |
| No new dependencies | ✅ Vendors sprintf-js instead of npm package |
| Metrics collected | ✅ |
| Any security/legal impact? | ✅ sprintf-js is BSD-3-Clause; license included |
| Any docs changes needed? | ✅ Document `,` and `_` flags with examples |
