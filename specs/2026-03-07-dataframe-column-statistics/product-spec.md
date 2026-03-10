---
author: lukasmasuch
created: 2026-03-07
---

# Column Statistics in Dataframe Column Menu

## Summary

Add a "Summary Statistics" submenu item to the dataframe column menu that displays on-demand
column statistics including a small distribution chart and key metrics. Statistics are computed
lazily when hovering over the menu item, cached until the underlying data changes, and support
multiple data types starting with numeric and text columns.

![Column statistics prototype from PR #11323](https://github.com/user-attachments/assets/b0887533-7458-4b6c-9dbb-55cf89ed3a89)

## Problem

Users working with dataframes often need to quickly understand the distribution and summary
statistics of individual columns. Currently, they must write additional code to compute these
metrics or use external tools, breaking their analysis flow.

**Requests:**

- [#13148](https://github.com/streamlit/streamlit/issues/13148) — Show column statistics in
  `st.dataframe`

**Use cases:**

- Data exploration: Quickly understand column distributions without writing code
- Data quality checks: Identify outliers, missing values, and unexpected patterns
- Feature engineering: Understand value ranges before normalization or binning
- Debugging: Verify data transformations produced expected results

**Current workarounds:**

- Write `df.describe()` or `df[col].value_counts()` alongside the dataframe
- Use pandas profiling or external tools
- Hover over individual cells (no aggregate view)

## Proposal

### Design

Add a "Summary Statistics" menu item to the existing column menu that opens a submenu on hover
(following the same pattern as the "Format" submenu). The submenu displays:

1. **Distribution chart** — A small Vega-Lite chart showing value distribution
2. **Summary metrics** — Key statistics appropriate for the column's data type

```
┌─────────────────────────────────┐
│ ▼ Column Name                   │
├─────────────────────────────────┤
│ ↑ Sort ascending                │
│ ↓ Sort descending               │
├─────────────────────────────────┤
│ # Format                      ▸ │
│ 📊 Summary Statistics         ▸ │◀── NEW: Opens statistics submenu
├─────────────────────────────────┤
│ ◎ Autosize                      │
│ 📌 Pin column                   │
│ 👁 Hide column                  │
└─────────────────────────────────┘

         ┌───────────────────────────────────┐
         │  ▁▂▅▇█▇▅▃▂▁  (histogram)          │
         │                                   │
         │  Count        1,234               │
         │  Sum          45,678              │
         │  Mean         37.02               │
         │  Median       35.00               │
         │  Std Dev      12.34               │
         │  Min          0                   │
         │  Max          100                 │
         └───────────────────────────────────┘
```

### Supported Data Types

#### Numeric Columns (number, progress)

**Chart:** Histogram showing value distribution (10-20 bins)

**Metrics:**

| Metric   | Description                      |
| -------- | -------------------------------- |
| Count    | Number of non-null values        |
| Sum      | Sum of all values                |
| Mean     | Arithmetic mean                  |
| Median   | Middle value (50th percentile)   |
| Std Dev  | Standard deviation               |
| Min      | Minimum value                    |
| Max      | Maximum value                    |

#### Text Columns (text, selectbox, link)

**Chart:** Horizontal bar chart showing top 5 most frequent values

**Metrics:**

| Metric        | Description                         |
| ------------- | ----------------------------------- |
| Count         | Number of non-null values           |
| Empty         | Number of empty/null values         |
| Unique        | Number of distinct values           |
| Frequency     | Most common value's frequency (%)   |

```
┌───────────────────────────────────────┐
│  "Active"    ████████████  (45%)      │
│  "Pending"   ████████      (30%)      │
│  "Closed"    ████          (15%)      │
│  "Draft"     ██            (7%)       │
│  "Other"     █             (3%)       │
│                                       │
│  Count       1,234                    │
│  Empty       12                       │
│  Unique      5                        │
│  Frequency   45%                      │
└───────────────────────────────────────┘
```

#### DateTime Columns (datetime, date, time)

**Chart:** Histogram showing temporal distribution

**Metrics:**

| Metric   | Description                    |
| -------- | ------------------------------ |
| Count    | Number of non-null values      |
| Mean     | Average date/time              |
| Median   | Middle date/time               |
| Min      | Earliest date/time             |
| Max      | Latest date/time               |
| Range    | Time span (e.g., "3 months")   |

#### Boolean Columns (checkbox)

**Chart:** Horizontal bar chart showing true/false distribution

**Metrics:**

| Metric   | Description                    |
| -------- | ------------------------------ |
| Count    | Number of non-null values      |
| True     | Count and percentage of true   |
| False    | Count and percentage of false  |

#### Future Extensions (Out of Scope)

The following column types can be supported in future iterations:

- **List columns:** Count statistics, average list length
- **JSON columns:** Key frequency analysis

### Behavior

#### Lazy Loading

1. Statistics are **not computed** until the user hovers over "Summary Statistics"
2. While computing, show a skeleton/loading state in the submenu
3. Once computed, cache the results for this column

#### Caching

- Cache statistics per column until:
  - The dataframe data changes (detected via data hash/reference)
  - The column configuration changes
- Cache is frontend-only (no backend roundtrip needed)

#### Chart Rendering

- Use Vega-Lite for charts (same as `st.metric` sparklines)
- Chart dimensions: ~200px width × ~80px height (fits in submenu)
- Use Streamlit theme colors for consistency

### Edge Cases

| Case | Behavior |
| ---- | -------- |
| Empty column | Show "No data" message instead of statistics |
| All null values | Show count of nulls, no chart |
| Single value | Show the value, simplified chart |
| Very large datasets (>100k rows) | Compute on sample, show "Based on sample" note |
| Mixed types in column | Use the dominant type for statistics |
| Overflow (very long values) | Truncate with ellipsis in display |

### Performance Considerations

- **Lazy computation:** Only compute when menu is opened
- **Memoization:** Cache results until data changes
- **Sampling:** For datasets >100k rows, compute on a representative sample
- **No backend roundtrip:** All computation happens in the frontend

## Alternatives Considered

### Option 1: Backend Computation ❌

Compute statistics on the Python backend and send via protobuf.

**Pros:**
- Access to full pandas/numpy statistical functions
- Handles very large datasets better

**Cons:**
- Requires backend roundtrip on every hover
- Adds network latency
- More complex caching (need to invalidate on data changes)
- Increases protobuf message size

**Why not selected:** Frontend computation is sufficient for display purposes and provides
instant response without network latency.

### Option 2: Always-Visible Statistics Panel ❌

Show statistics in a dedicated panel below or beside the dataframe.

**Pros:**
- Always visible, no interaction required
- Could show multiple columns at once

**Cons:**
- Takes up screen real estate
- Computes statistics for all columns upfront
- Different UX pattern from existing column menu

**Why not selected:** The column menu approach is consistent with existing patterns (Format
submenu) and computes on-demand rather than upfront.

### Option 3: Tooltip on Column Header ❌

Show statistics in a tooltip when hovering the column header.

**Pros:**
- Quick access
- Simpler implementation

**Cons:**
- Limited space for charts and metrics
- Conflicts with existing header interactions
- Can't accommodate rich visualizations

**Why not selected:** The submenu approach provides more space for charts and detailed
metrics while maintaining consistency with the existing menu pattern.

## Out of Scope (Future Work)

- **Copy statistics to clipboard** — Add a copy button to export statistics
- **Custom percentiles** — Allow users to configure which percentiles to show
- **Statistical tests** — Normality tests, correlation with other columns
- **Export chart** — Download the distribution chart as an image
- **Backend computation option** — For very large datasets or complex statistics
- **List/JSON column support** — Specialized statistics for complex types

## Checklist

| Item                       | ✅ or comment                                                |
| -------------------------- | ------------------------------------------------------------ |
| Works on SiS, Cloud, etc?  | ✅ Yes — frontend-only, no special requirements              |
| No breaking API changes    | ✅ Yes — purely additive feature in UI                       |
| No new dependencies        | ✅ Yes — uses existing Vega-Lite already in bundle           |
| Metrics collected          | ✅ Yes — track menu opens and column type usage              |
| Any security/legal impact? | ✅ No — only displays data already visible in the dataframe  |
| Any docs changes needed?   | ✅ Yes — document feature in dataframe configuration guide   |

## References

- **Prototype PR:** [#11323](https://github.com/streamlit/streamlit/pull/11323)
- **GitHub Issue:** [#13148](https://github.com/streamlit/streamlit/issues/13148)
- **Related implementation:** `frontend/lib/src/components/elements/Metric/Metric.tsx` (Vega-Lite usage)
- **Existing menu pattern:** `frontend/lib/src/components/widgets/DataFrame/menus/FormattingMenu.tsx`
