# st.filter_bar — UI Design States

Complete inventory of every distinct UI state that needs a design spec. Organized by component, with filter type × operator combinations enumerated.

---

## Filter Types & Operators

| # | Filter Type | Trigger Condition | Operators |
|---|-------------|-------------------|-----------|
| 1 | **Multiselect** | String column, ≤100 unique values | `is`, `is_not`, `is_null`, `is_not_null` |
| 2 | **Text** | String column, >100 unique values | `contains`, `not_contains`, `equals`, `not_equals`, `starts_with`, `ends_with`, `is_null`, `is_not_null` |
| 3 | **Range** | Numeric column (int/float) | `between`, `not_between`, `equals`, `not_equals`, `greater_than`, `less_than`, `is_null`, `is_not_null` |
| 4 | **Toggle** | Boolean column | `is_true`, `is_false`, `is_null` |
| 5 | **Date/Datetime** | Date or datetime column | `between`, `not_between`, `before`, `after`, `equals`, `not_equals`, `today`, `past_7_days`, `past_30_days`, `past_90_days`, `this_week`, `this_month`, `this_year`, `is_null`, `is_not_null` |
| 6 | **Time** | Time column | `between`, `not_between`, `before`, `after`, `equals`, `not_equals`, `is_null`, `is_not_null` |
| 7 | **List/Tags** | Column with list-type cells _(future)_ | `contains`, `contains_all`, `does_not_contain`, `is_empty`, `is_not_empty` |

### Operator Display Labels (internal → display)

| Internal Key | Display Label | Pill Summary Example |
|---|---|---|
| `between` | between | `Revenue: 100K – 500K` |
| `not_between` | not between | `Revenue: not between 100K – 500K` |
| `equals` | = | `Revenue: = 50K` |
| `not_equals` | ≠ | `Revenue: ≠ 50K` |
| `greater_than` | > | `Revenue: > 100K` |
| `less_than` | < | `Revenue: < 500K` |
| `contains` | contains | `Product: Pro` (raw query text, truncated to 20 chars) |
| `not_contains` | not contains | `Product: Pro` (raw query text, truncated to 20 chars) |
| `starts_with` | starts with | `Product: A` (raw query text) |
| `ends_with` | ends with | `Product: Inc` (raw query text) |
| `is` | = | `Industry: Tech, Finance` |
| `is_not` | ≠ | `Industry ≠ Retail` |
| `before` | before | `Founded: before 2020` |
| `after` | after | `Founded: after 2020` |
| `is_true` | = true | `Active: True` |
| `is_false` | = false | `Active: False` |
| `is_null` | is empty | `Revenue: is empty` |
| `is_not_null` | not empty | `Revenue: is not empty` |
| `today` | today | `Founded: today` |
| `past_7_days` | past 7 days | `Founded: past 7 days` |
| `past_30_days` | past 30 days | `Founded: past 30 days` |
| `past_90_days` | past 90 days | `Founded: past 90 days` |
| `this_week` | this week | `Founded: this week` |
| `this_month` | this month | `Founded: this month` |
| `this_year` | this year | `Founded: this year` |

---

## A. Filter Bar Container

The top-level component. 6 distinct visual states:

| # | State | Description |
|---|-------|-------------|
| A1 | **Empty** | No filters active. Shows guidance text (`Click "Add filter" to get started`) and the "+ Add filter" button. Guidance text uses `StyledEmptyMessage` styling (subdued color, small font). |
| A2 | **Single filter** | One pill + "+ Add filter" button. |
| A3 | **Multiple filters** | 2+ pills + "Clear all" button + "+ Add filter" button. |
| A4 | **Collapsed** | `expanded=False`. Label + filter icon (`:material/filter_list:`) + count badge + disclosure chevron always visible. Pill row hidden. Chevron rotates to indicate expand/collapse. Badge shows active filter count when collapsed. Filter icon provides visual identity of the widget even without label text. |
| A5 | **Globally disabled** | `disabled=True`. All pills and buttons are dimmed/non-interactive. |
| A6 | **Per-column disabled** | `disabled=["col1", "col2"]`. Some pills are locked (dimmed, no remove/edit), others remain interactive. Disabled columns hidden from "Add filter" picker. |

### Container Configuration Variants

| # | Variant | Description |
|---|---------|-------------|
| A7 | **Label visible** | `label_visibility="visible"` — label text displayed above pill row. |
| A8 | **Label hidden** | `label_visibility="hidden"` — label hidden but vertical space preserved. |
| A9 | **Label collapsed** | `label_visibility="collapsed"` — label hidden, no space reserved. |
| A10 | **With help tooltip** | Label has a `?` icon that shows tooltip on hover. |
| A11 | **Fixed width** | `width=400` — container has max-width constraint. |
| A12 | **Stretch width** | Default — container fills available width. |
| A13 | **Content width** | `width="content"` — container shrinks to fit content (pills + button). |

---

## B. Filter Pill

Individual pill/chip for an active filter. 4 states × content variations:

| # | State | Visual Description |
|---|-------|-------------------|
| B1 | **Empty/just added** | Pill shows column name + "All" summary (no values yet). Primary color border/fill — all pills are always active-styled once they exist. |
| B2 | **Active with value** | Pill shows "Column: value summary". Has primary color border/fill. |
| B3 | **Open (popover shown)** | Darker background tint to indicate its popover is open. |
| B4 | **Disabled** | Dimmed opacity, cursor default, no hover effect, no remove action. |

### Pill Content Examples

| Filter Type | Example Pill Text |
|-------------|-------------------|
| Multiselect (1 value) | `Industry: Tech` |
| Multiselect (2 values) | `Industry: Tech, Finance` |
| Multiselect (3+ values) | `Industry: 4 selected` |
| Multiselect (is_not) | `Industry: ≠ Retail` |
| Text | `Product: Pro` (raw query, truncated to 20 chars) |
| Range (between) | `Revenue: 10K – 500K` |
| Range (greater_than) | `Revenue: > 100K` |
| Toggle | `Active: True` |
| Date range | `Founded: 2020-01-01 – 2023-12-31` |
| Null operator | `Revenue: is null` |

---

## C. Column Picker Popover

The menu shown when clicking "+ Add filter":

| # | State | Description |
|---|-------|-------------|
| C1 | **Standard list** | Short list of available columns, each with an icon indicating filter type (list for multiselect, text icon for text, number for range, toggle for boolean, calendar for date). |
| C2 | **With search** | When >7 columns available, search input appears at top to filter the list. |
| C3 | **Empty** | All columns already have active filters — shows "All columns have filters" message. |
| C4 | **Disabled columns hidden** | Columns in `disabled` list are not shown in picker. |

### Column Type Icons

| Filter Type | Icon |
|-------------|------|
| Multiselect | `:material/list:` |
| Text | `:material/text_fields:` |
| Range | `:material/tag:` (number/hash) |
| Toggle | `:material/toggle_on:` |
| Date Range | `:material/calendar_today:` |
| Datetime Range | `:material/schedule:` |
| Time Range | `:material/access_time:` |

---

## D. Multiselect Filter Popover

Shown for categorical string columns with ≤100 unique values.

### Layout

```
┌─────────────────────────────────┐
│ Column Name          [🗑 Delete] │
│ ─────────────────────────────── │
│ [Operator ▾]                    │
│                                 │
│ [🔍 Search options...]          │  ← (needed for long lists)
│                                 │
│ ☑ Option A                      │
│ ☐ Option B                      │
│ ☑ Option C                      │
│ ☐ Option D                      │
│ ...                             │
│ ─────────────────────────────── │
│ [Select all]        [Clear all] │
└─────────────────────────────────┘
```

### States by Operator

| # | Operator | UI Behavior |
|---|----------|-------------|
| D1 | `is` | Checkbox list — selected values are included. |
| D2 | `is not` | Checkbox list — selected values are excluded. |
| D3 | `is empty` | No checkbox list shown. Filter auto-applies (shows rows with empty/null values). |
| D4 | `is not empty` | No checkbox list shown. Filter auto-applies (shows rows with non-empty values). |

### Interaction States

| # | State | Description |
|---|-------|-------------|
| D5 | **No selection** | All unchecked. Pill shows column name only. |
| D6 | **Partial selection** | Some checked. Pill shows "Col: val1, val2" or "Col: val1 +N more". |
| D7 | **All selected** | All checked. Effectively no filter (all rows pass). |
| D8 | **Search active** | Search input has text, list is filtered to matching options. |
| D9 | **Disabled** | Checkboxes and actions are non-interactive. |

---

## E. Text Filter Popover

Shown for high-cardinality string columns (>100 unique values).

### Layout

```
┌─────────────────────────────────┐
│ Column Name          [🗑 Delete] │
│ ─────────────────────────────── │
│ [Operator ▾]                    │
│                                 │
│ [Enter text value...]           │
│                                 │
└─────────────────────────────────┘
```

### States by Operator

| # | Operator | UI Behavior |
|---|----------|-------------|
| E1 | `contains` | Text input. Matches rows where column contains the string (case-insensitive). Default operator. |
| E2 | `not_contains` | Text input. Matches rows where column does NOT contain the string (case-insensitive). |
| E3 | `equals` | Text input. Matches exact string (case-sensitive). |
| E4 | `not_equals` | Text input. Matches rows where column is NOT equal to the exact string. Display: "≠". |
| E5 | `starts_with` | Text input. Matches rows starting with string. |
| E6 | `ends_with` | Text input. Matches rows ending with string. |
| E7 | `is_null` | No text input shown. Auto-applies (shows rows with null/empty). |
| E8 | `is_not_null` | No text input shown. Auto-applies (shows rows with values). |

### Interaction States

| # | State | Description |
|---|-------|-------------|
| E9 | **Empty input** | Placeholder shown, no filtering active yet. |
| E10 | **With value** | User has typed a query. Pill shows raw query text (truncated to 20 chars), e.g., `Col: query`. |
| E11 | **Disabled** | Input is read-only/dimmed. |

---

## F. Range Filter Popover

Shown for numeric columns (int, float).

### Layout — `between` operator

```
┌─────────────────────────────────┐
│ Column Name          [🗑 Delete] │
│ ─────────────────────────────── │
│ [Operator ▾]                    │
│                                 │
│ [Min value]  —  [Max value]     │
│                                 │
└─────────────────────────────────┘
```

### Layout — single-value operators (`equals`, `greater_than`, `less_than`)

```
┌─────────────────────────────────┐
│ Column Name          [🗑 Delete] │
│ ─────────────────────────────── │
│ [Operator ▾]                    │
│                                 │
│ [Value]                         │
│                                 │
└─────────────────────────────────┘
```

### States by Operator

| # | Operator | Inputs Shown | Pill Summary |
|---|----------|-------------|--------------|
| F1 | `between` | Two inputs (min, max) | `Revenue: 100K – 500K` |
| F2 | `not_between` | Two inputs (min, max) | `Revenue: not between 100K – 500K` |
| F3 | `equals` | One input | `Revenue: = 42` |
| F4 | `not_equals` | One input | `Revenue: ≠ 42` |
| F5 | `greater_than` | One input | `Revenue: > 100K` |
| F6 | `less_than` | One input | `Revenue: < 500K` |
| F7 | `is_null` | No inputs | `Revenue: is empty` |
| F8 | `is_not_null` | No inputs | `Revenue: is not empty` |

Note: `between` and `not_between` use dual inputs (min, max). Single-value
operators (`equals`, `not_equals`, `greater_than`, `less_than`) show a single input field.

### Interaction States

| # | State | Description |
|---|-------|-------------|
| F9 | **Both empty** | Placeholder values shown, no filtering. |
| F10 | **One bound set** | Partial range (open-ended). |
| F11 | **Both bounds set** | Full range filter active. |
| F12 | **Disabled** | Inputs are read-only/dimmed. |

---

## G. Toggle Filter Popover

Shown for boolean columns.

### Layout

```
┌─────────────────────────────────┐
│ Column Name  [Operator ▾]  [🗑] │
│ ─────────────────────────────── │
│                                 │
│ ( All )  ( True )  ( False )    │  ← segmented toggle
│                                 │
└─────────────────────────────────┘
```

### Segmented Control Options

The toggle filter renders a segmented control with three options. When operators.length > 1
(e.g., `is_true`, `is_false`, `is_null`), an operator dropdown also appears in the header.

| # | Segment | Meaning | Pill Summary |
|---|---------|---------|--------------|
| G1 | **All** | No constraint (filter exists but doesn't exclude any rows) | `Active: All` |
| G2 | **True** | Show only `True` rows | `Active: True` |
| G3 | **False** | Show only `False` rows | `Active: False` |

When the `is_null` operator is selected via the operator dropdown, the segmented control
is irrelevant — the filter shows only null rows regardless of segment selection.

### Interaction States

| # | State | Description |
|---|-------|-------------|
| G4 | **"All" selected (default)** | "All" segment highlighted. Filter produces no constraint. |
| G5 | **"True" or "False" selected** | Selected segment highlighted in primary color. |
| G6 | **Disabled** | Segments non-interactive, dimmed. |

Note: The operator selector appears when the toggle has multiple operators (default:
`is_true`, `is_false`, `is_null`). Selecting "All" in the segmented control resets
the toggle value to `null` (no constraint), distinct from the `is_null` operator
(which filters to rows where the column value is null/empty).

---

## H. Date Range Filter Popover

Shown for datetime/date columns.

### Layout — `between` operator

```
┌─────────────────────────────────┐
│ Column Name          [🗑 Delete] │
│ ─────────────────────────────── │
│ [Operator ▾]                    │
│                                 │
│ [Start date]  —  [End date]     │
│                                 │
└─────────────────────────────────┘
```

### Layout — single-value operators (`before`, `after`, `equals`)

```
┌─────────────────────────────────┐
│ Column Name          [🗑 Delete] │
│ ─────────────────────────────── │
│ [Operator ▾]                    │
│                                 │
│ [Date value]                    │
│                                 │
└─────────────────────────────────┘
```

### States by Operator

| # | Operator | Inputs Shown | Pill Summary |
|---|----------|-------------|--------------|
| H1 | `between` | Two date inputs (start, end) | `Founded: Jan 2020 – Dec 2023` |
| H2 | `not_between` | Two date inputs (start, end) | `Founded: not between Jan 2020 – Dec 2023` |
| H3 | `equals` | One date input | `Founded: = Jan 15, 2023` |
| H4 | `not_equals` | One date input | `Founded: ≠ Jan 15, 2023` |
| H5 | `before` | One date input | `Founded: before Mar 2022` |
| H6 | `after` | One date input | `Founded: after Jun 2021` |
| H7 | `today` | No inputs (relative) | `Founded: today` |
| H8 | `past_7_days` | No inputs (relative) | `Founded: past 7 days` |
| H9 | `past_30_days` | No inputs (relative) | `Founded: past 30 days` |
| H10 | `past_90_days` | No inputs (relative) | `Founded: past 90 days` |
| H11 | `this_week` | No inputs (relative) | `Founded: this week` |
| H12 | `this_month` | No inputs (relative) | `Founded: this month` |
| H13 | `this_year` | No inputs (relative) | `Founded: this year` |
| H14 | `is_null` | No inputs | `Founded: is empty` |
| H15 | `is_not_null` | No inputs | `Founded: is not empty` |

### Interaction States

| # | State | Description |
|---|-------|-------------|
| H16 | **Empty** | Date input placeholders shown. |
| H17 | **Partial** | One date entered (open-ended range). |
| H18 | **Complete** | Both dates set. |
| H19 | **Disabled** | Inputs read-only/dimmed. |

---

## I. Operator Selector (Shared Component)

Used inside every filter popover to switch between operators.

| # | State | Description |
|---|-------|-------------|
| I1 | **Closed** | Small button/badge showing current operator label (e.g., "contains ▾"). |
| I2 | **Open** | Dropdown menu listing all available operators for this filter type. Current operator has a checkmark or highlight. |
| I3 | **Single operator** | Only one operator available — selector is hidden or shown as static text. |
| I4 | **Disabled** | Non-interactive, dimmed. |

### Operator Display Labels

| Raw Operator | Display Label |
|--------------|---------------|
| `is` | is |
| `is_not` | is not |
| `is_null` | is empty |
| `is_not_null` | is not empty |
| `contains` | contains |
| `not_contains` | not contains |
| `equals` | equals |
| `not_equals` | not equals |
| `starts_with` | starts with |
| `ends_with` | ends with |
| `between` | between |
| `not_between` | not between |
| `greater_than` | greater than |
| `less_than` | less than |
| `before` | before |
| `after` | after |
| `today` | today |
| `past_7_days` | past 7 days |
| `past_30_days` | past 30 days |
| `past_90_days` | past 90 days |
| `this_week` | this week |
| `this_month` | this month |
| `this_year` | this year |
| `is_true` | is true |
| `is_false` | is false |

---

## J. Shared Interaction Patterns

### Delete/Remove Filter

| # | State | Description |
|---|-------|-------------|
| J1 | **Delete button in popover** | Trash icon in header, removes filter on click. |
| J2 | **Pill remove** | Clicking a pill while disabled should have no effect. Enabled pills open the popover where delete is available. |

### Clear All

| # | State | Description |
|---|-------|-------------|
| J3 | **Visible** | Appears when 2+ filters active. Text link "Clear all". |
| J4 | **Hidden** | 0–1 filters active — button not rendered. |

### Empty States (Future)

| # | State | Description |
|---|-------|-------------|
| J5 | **No filterable columns** | DataFrame has no supported column types. Show informational message. |
| J6 | **No matching options** | Search in multiselect/column picker returns zero results. Show "No results". |

### Collapsed / Expanded (Disclosure Pattern)

The filter bar uses a disclosure (expand/collapse) pattern — NOT a replacement pattern.
The widget label, count badge, and disclosure chevron are always visible regardless of
expanded state.

| # | State | Description |
|---|-------|-------------|
| J7 | **Expanded (default)** | Label row with down-chevron (˅). Pill row visible below. Chevron acts as collapse toggle. |
| J8 | **Collapsed** | Label row with right-chevron (›) + count badge (e.g., "3" in primary-colored circle). Pill row hidden. Clicking chevron expands. |
| J9 | **Collapsed, no active filters** | Label row with right-chevron. No badge shown (0 active). |
| J10 | **Collapsed, filters active** | Label row with right-chevron + count badge. Filters still apply to data even when UI is collapsed. |

#### Visual Anatomy (Collapsed)

```
┌──────────────────────────────────────────────────────────┐
│  My Filters  ≡ [3] ›                                     │
│              ^^^ ^^^ ^                                   │
│              filter badge chevron (rotated -90°)          │
│              icon                                         │
└──────────────────────────────────────────────────────────┘
```

The filter icon (`:material/filter_list:`) is always visible and provides visual identity.
The count badge only appears when collapsed AND filters are active.

#### Visual Anatomy (Expanded)

```
┌──────────────────────────────────────────────────────────┐
│  My Filters  ≡ ˅                                         │
│              ^^ ^                                        │
│              filter chevron (0° rotation)                │
│              icon                                         │
│                                                          │
│  [AND] [Industry: Tech] [Stage: Lead] [Clear all] [+]   │
└──────────────────────────────────────────────────────────┘
```

#### Key Design Decisions

- **Badge only when collapsed**: When expanded, you see the pills directly — badge would
  be redundant.
- **Filters still apply when collapsed**: Collapsing is purely visual. The filtered
  DataFrame is still returned. This matches `st.expander` behavior (content inside exists
  regardless of visual state).
- **Programmatic control**: `expanded=False` sets the initial state. User interaction
  (clicking the chevron) overrides.

---

## K. Relative Date Operators

For date/datetime columns, relative date operators are available directly in the operator
dropdown — they are NOT a separate "mode" or sub-UI. Each relative date is a standalone
operator that requires no value inputs.

### Implementation (flat operators, not Notion-style)

Relative dates appear as individual operators in the same dropdown as `between`, `before`,
etc. When selected, no date inputs are shown (the operator alone is the full filter).

```
┌──────────────────┐
│ between        ✓ │
│ not between      │
│ before           │
│ after            │
│ equals           │
│ not equals       │
│ ─────────────── │
│ today            │
│ past 7 days      │
│ past 30 days     │
│ past 90 days     │
│ this week        │
│ this month       │
│ this year        │
│ ─────────────── │
│ is empty         │
│ is not empty     │
└──────────────────┘
```

### States

| # | State | Description |
|---|-------|-------------|
| K1 | **Relative operator selected** | No date inputs shown (operator is the full filter). Pill shows e.g., `Founded: past 7 days`. |
| K2 | **Pill summary** | Shows operator label directly: `Founded: this week`, `Founded: today`, etc. |
| K3 | **Disabled** | Operator dropdown non-interactive, dimmed. |

### Resolution

Relative dates are resolved server-side on each script rerun — the filter state stores only
the operator name (e.g., `"past_7_days"`), not computed dates. "Past 7 days" always means
the last 7 days from today. See tech spec "Relative Date Resolution" section for details.

---

## L. List/Tags Filter Popover

For columns where each cell contains a list of values (e.g., tags, labels, skills).

### Data Example

```python
df = pd.DataFrame({
    "Name": ["Alice", "Bob", "Carol"],
    "Skills": [["python", "sql"], ["rust", "go", "sql"], ["python", "typescript"]],
})
```

### Layout

```
┌───────────────────────────────────────────┐
│ Skills                         [🗑 Delete] │
│ ───────────────────────────────────────── │
│ [contains any ▾]                          │
│                                           │
│ [🔍 Search tags...]                       │
│                                           │
│ ☑ python                                  │
│ ☑ sql                                     │
│ ☐ rust                                    │
│ ☐ go                                      │
│ ☐ typescript                              │
│ ───────────────────────────────────────── │
│ [Select all]              [Clear all]     │
└───────────────────────────────────────────┘
```

### Operators

| # | Operator | Semantics | Pill Summary |
|---|----------|-----------|--------------|
| L1 | `contains_any` | Row passes if cell list contains ANY of the selected values | `Skills: python, sql` |
| L2 | `contains_all` | Row passes if cell list contains ALL of the selected values | `Skills: all of python, sql` |
| L3 | `does_not_contain` | Row passes if cell list contains NONE of the selected values | `Skills ≠ rust` |
| L4 | `is_empty` | Row passes if cell list is empty or null | `Skills: is empty` |
| L5 | `is_not_empty` | Row passes if cell list has at least one value | `Skills: is not empty` |

### How Options Are Derived

The filter flattens all list cells in the column to build the unique option set:
- `["python", "sql"] + ["rust", "go", "sql"] + ["python", "typescript"]`
- → Unique: `{python, sql, rust, go, typescript}`
- Sorted alphabetically for display

### States

| # | State | Description |
|---|-------|-------------|
| L6 | **No selection** | All unchecked. Filter not yet active. |
| L7 | **Partial selection** | Some tags checked. Pill shows selected tags. |
| L8 | **Search active** | Search input filters the tag list. |
| L9 | **Disabled** | Checkboxes and actions non-interactive. |

### Visual Distinction from Multiselect

The list/tags filter is visually similar to multiselect but differs in:
1. **Operator labels** — "contains any" / "contains all" instead of "is" / "is not"
2. **Column icon in picker** — uses `:material/sell:` (tag icon) instead of `:material/label:`
3. **Pill indicator** — could show a tag/chip icon to distinguish from flat multiselect

---

## M. AND/OR Filter Groups

By default, all active filters combine with **AND** logic (every filter must pass for a
row to be included). A toggle allows switching to **OR** logic.

### V1: Flat AND/OR Toggle (Groups-Ready State)

A single toggle button in the pill row applies the same logic to ALL filters. The state
model uses a single-group structure that can extend to multi-group without migration.

```
AND mode:
┌──────────────────────────────────────────────────────────────────┐
│ Label  ≡ ˅                                                       │
│                                                                  │
│  [AND] [Industry: Tech] [Stage: Qualified] [Clear all] [+ Add]  │
└──────────────────────────────────────────────────────────────────┘

OR mode:
┌──────────────────────────────────────────────────────────────────┐
│ Label  ≡ ˅                                                       │
│                                                                  │
│  [OR] [Industry: Tech]  or  [Stage: Lead] [Clear all] [+ Add]   │
└──────────────────────────────────────────────────────────────────┘
```

- **AND button**: Subtle border, muted text. Indicates "Match all" (default).
- **OR button**: Primary color border + background tint. Indicates "Match any".
- **"or" separators**: Italic, muted text between pills when in OR mode.
- Toggle only appears when 2+ filters are active.

#### State Model (Groups-Ready)

V1 uses a single-group model that V2 can extend to multiple groups without migration:

```json
{
  "_groups": [{"logic": "and", "columns": ["Industry", "Stage", "Revenue"]}],
  "Industry": {"type": "multiselect", "operator": "is", "values": ["Technology"]},
  "Stage": {"type": "multiselect", "operator": "is", "values": ["Lead"]},
  "Revenue": {"type": "range", "operator": "greater_than", "min": 100000}
}
```

- `_groups[0].logic`: the flat toggle sets this to `"and"` or `"or"`
- `_groups[0].columns`: ordered list of all active filter column names
- Column entries: per-filter configuration (type, operator, values)
- Keys prefixed with `_` are metadata (preserved through state reconciliation)

### States

| # | State | Description |
|---|-------|-------------|
| M1 | **AND mode (default)** | "AND" toggle button (muted). All filters must pass. No separators between pills. |
| M2 | **OR mode** | "OR" toggle button (primary color). Italic "or" separators between each pill. Row passes if ANY filter matches. |
| M3 | **Single filter** | Toggle hidden — AND/OR irrelevant with one filter. |

### V2 Extension: Grouped AND/OR (Notion-style)

The groups-ready state model enables multi-group support without migration:

```json
{
  "_groups": [
    {"logic": "or", "columns": ["Industry"]},
    {"logic": "and", "columns": ["Stage", "Revenue"]}
  ],
  "_group_logic": "and",
  "Industry": {"type": "multiselect", "operator": "is", "values": ["Tech", "Healthcare"]},
  "Stage": {"type": "multiselect", "operator": "is", "values": ["Lead"]},
  "Revenue": {"type": "range", "operator": "greater_than", "min": 100000}
}
```

V2 adds: `_group_logic` (how groups combine), multiple entries in `_groups`, and UI for
creating/managing groups (visual containers, drag-between, per-group toggles).

| Aspect | V1 (single group) | V2 (multi-group) |
|--------|-------------------|------------------|
| State model | `_groups: [{logic, columns}]` (one entry) | `_groups: [{logic, columns}, ...]` + `_group_logic` |
| UI | Single toggle button | Group containers, per-group toggles, inter-group logic |
| Migration | — | None required (additive to state model) |
| Use cases | Simple match-all / match-any | Complex: "(A OR B) AND (C AND D)" |

---

## N. Time Range Filter Popover

Shown for time-typed columns (`time_range` filter type). Uses native `<input type="time">`
controls for HH:MM selection. Does NOT support relative date operators (those apply only
to date/datetime ranges).

### Layout — `between` operator

```
┌─────────────────────────────────┐
│ Start Time       [🗑 Delete]     │
│ ─────────────────────────────── │
│ [Operator ▾]                    │
│                                 │
│ From: [HH:MM]  To: [HH:MM]     │
│                                 │
└─────────────────────────────────┘
```

### Layout — single-value operators (`equals`, `not_equals`, `before`, `after`)

```
┌─────────────────────────────────┐
│ Start Time       [🗑 Delete]     │
│ ─────────────────────────────── │
│ [Operator ▾]                    │
│                                 │
│ [HH:MM]                         │
│                                 │
└─────────────────────────────────┘
```

### States by Operator

| # | Operator | Inputs Shown | Pill Summary |
|---|----------|-------------|--------------|
| N1 | `between` | Two time inputs (from, to) | `Start: 09:00 – 17:00` |
| N2 | `not_between` | Two time inputs (from, to) | `Start: not between 09:00 – 17:00` |
| N3 | `equals` | One time input | `Start: = 12:00` |
| N4 | `not_equals` | One time input | `Start: ≠ 12:00` |
| N5 | `before` | One time input | `Start: before 09:00` |
| N6 | `after` | One time input | `Start: after 17:00` |
| N7 | `is_null` | No inputs | `Start: is empty` |
| N8 | `is_not_null` | No inputs | `Start: is not empty` |

### Interaction States

| # | State | Description |
|---|-------|-------------|
| N9 | **Empty** | Time input placeholders shown (--:--). |
| N10 | **Partial** | One time entered (open-ended range). |
| N11 | **Complete** | Both times set. |
| N12 | **Disabled** | Inputs read-only/dimmed. |

### Key Differences from Date Range (Section H)

- Uses `<input type="time">` (HH:MM picker) instead of date/calendar inputs
- No relative operators (today, past_7_days, etc.) — time filters are absolute only
- Time values are strings in "HH:MM:SS" format in state, not ISO date strings

---

## Total State Count

| Component | States |
|-----------|--------|
| Container (A) | 13 |
| Pill (B) | 4 + content variants |
| Column Picker (C) | 4 |
| Multiselect Popover (D) | 9 |
| Text Popover (E) | 11 |
| Range Popover (F) | 12 |
| Toggle Popover (G) | 6 |
| Date Popover (H) | 19 |
| Operator Selector (I) | 4 |
| Shared Patterns (J) | 10 |
| Relative Date Operators (K) | 3 |
| List/Tags Popover (L) | 9 (future) |
| AND/OR Filter Groups (M) | 3 |
| Time Range Popover (N) | 12 |
| **Total unique states** | **~119** |

---

## Demo Coverage Status

Our current demo app (`work-tmp/test_filter_bar.py`) covers:

- [x] All 5 filter types available via auto-detection (Section 1)
- [x] Developer-configured column subset (Section 2)
- [x] FilterConfig per-column overrides (Section 3)
- [x] Chart-driven filtering (Section 4)
- [x] Text filter with high cardinality (Section 5)
- [x] Operator restrictions (Section 6)
- [x] Collapsed mode with disclosure pattern (Section 7)
- [x] Per-column disabled (Section 8)
- [x] Label visibility (Section 9)
- [x] AND/OR filter logic toggle (Section 10)

**Not shown in static screenshots** (require interaction):
- Popover open states (must click to open)
- Operator dropdown open
- Pill with values (must add filter + select values)
- "Clear all" button (must have 2+ active filters)
- Search within column picker
- OR mode with "or" separators between pills
