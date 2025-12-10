---
author: lukasmasuch
created: 2025-12-10
status: Draft
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
  parameter as python format (130+ upvotes)
- [#7702](https://github.com/streamlit/streamlit/issues/7702) — Change the character of
  the thousand and decimal separator in `st.data_editor` and `st.dataframe` (54+ upvotes)

## Proposal

### Format Syntax

Add two new flags to printf-style format specifiers (placed after the `%` sign):

| Flag | Separator | Example Format | Example Output |
|------|-----------|----------------|----------------|
| `,` | Comma | `%,d` | `1,234,567` |
| `_` | Underscore | `%_d` | `1_234_567` |

The flags work with numeric format types: `d`, `i`, `f` and with all other sprintf features.

These flags are equivalent to Python's [format specifiers for thousand separators](https://www.w3schools.com/python/python_string_formatting.asp)
`:,` and `:_` (e.g., `f"{x:,}"` or `f"{x:_}"`).

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

**Supported format types:**

- `%,d` / `%_d` — Integer with separators
- `%,i` / `%_i` — Integer with separators (alias)
- `%,f` / `%_f` — Float with separators (e.g., `%,.2f`)

**Flag combinations:**

- Works with sign flag: `%+,d` → `+1,234,567`
- Works with width: `%,15d` → `1,234,567`
- Works with precision: `%,.2f` → `1,234.56`
- Works with zero padding: `%0,10d` → `001,234,567`
- Works with suffixes: `%,d%%` → `1,234,567%`
- Works with prefixes: `USD %,d` → `USD 1,234,567`

**Non-numeric types:**

The `,` and `_` flags are silently ignored for non-numeric format types (`%s`, `%x`, etc.).

### Affected Components

This feature affects the following elements that support the `format` parameter:

- `st.column_config.NumberColumn` — `format` parameter
- `st.column_config.ProgressColumn` — `format` parameter
- `st.metric` — `format` parameter
- `st.slider` — `format` parameter

The `format` for `st.number_input` is already very limited, so we might not be able to support this in the initial implementation.

### Implementation Notes

The implementation vendors [sprintf-js](https://github.com/alexei/sprintf.js) as TypeScript
and extends the format parser to recognize `,` and `_` as thousand separator flags.
Separators are inserted every 3 digits in the integer portion of the number.

Thousand separator support has been a long-standing feature request for sprintf-js itself
([sprintf.js#124](https://github.com/alexei/sprintf.js/issues/124), 30+ upvotes since 2017),
but the library hasn't been maintained for over 2 years. By vendoring the library, we can
add this feature independently while also allowing us to maintain it ourselves. The implementation is only a single file with a couple hundred lines of code.

## Checklist

- [x] Will this work on all deployment platforms (e.g. [Streamlit Community Cloud](https://streamlit.io/cloud), [Streamlit in Snowflake](https://www.snowflake.com/en/product/features/streamlit-in-snowflake/), [Hugging Face Spaces](https://huggingface.co/spaces))?
- [x] No breaking API changes?
  - Using `,` or `_` after `%` previously caused an error, so existing format strings are unaffected
- [x] No new dependencies?
  - Vendors sprintf-js instead of using npm package; reduces external dependencies
- [x] Metrics collected?
- [x] Any security or legal implications?
  - sprintf-js is BSD-3-Clause licensed; license file included in vendor directory
- [x] Anything to keep in mind for docs?
  - Document new `,` and `_` flags in a dedicated format string documentation
  - Show examples for common use cases (currency, large numbers)
- [x] Any other risks?
