# st.filter_bar — UI Design States

Complete inventory of every distinct UI state that needs a design spec. Organized by component, with filter type × operator combinations enumerated.

---

## Filter Types & Operators

| # | Filter Type | Trigger Condition | Operators |
|---|-------------|-------------------|-----------|
| 1 | **Multiselect** | String column of categorical values, at any cardinality | `is`, `is_not`, `is_null`, `is_not_null` |
| 2 | **Text** | String column that reads as prose (near-all-distinct, or long values) | `contains`, `not_contains`, `equals`, `not_equals`, `starts_with`, `ends_with`, `is_null`, `is_not_null` |
| 3 | **Range** | Numeric column (int/float) | `between`, `not_between`, `equals`, `not_equals`, `greater_than`, `less_than`, `is_null`, `is_not_null` |
| 4 | **Toggle** | Boolean column | `is_true`, `is_false`, `is_null` |
| 5 | **Date/Datetime** | Date or datetime column | `between`, `not_between`, `before`, `after`, `equals`, `not_equals`, `is_relative_to_today`, `is_null`, `is_not_null` |
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
| `is_relative_to_today` | is relative to today | `Created: This week` (composed from direction + unit) |

---

## A. Filter Bar Container

The top-level component. 5 distinct visual states:

| # | State | Description |
|---|-------|-------------|
| A1 | **Empty** | No filters active. Shows guidance text (`Click "Add filter" to get started`) and the "+ Add filter" button. Guidance text uses `StyledEmptyMessage` styling (subdued color, small font). |
| A2 | **Single filter** | One pill + "+ Add filter" button. |
| A3 | **Multiple filters** | 2+ pills + "Clear all" button + "+ Add filter" button. |
| A4 | **Globally disabled** | `disabled=True`. All pills and buttons are dimmed/non-interactive. |
| A5 | **Per-column disabled** | `disabled=["col1", "col2"]`. Some pills are locked (dimmed, no remove/edit), others remain interactive. Disabled columns hidden from "Add filter" picker. |

The filter bar is always expanded — there is no collapsed state in V1. See the product spec's
Out of Scope for the deferred collapsible variant.

### Container Configuration Variants

| # | Variant | Description |
|---|---------|-------------|
| A6 | **Label visible** | `label_visibility="visible"` — label text displayed above pill row. |
| A7 | **Label hidden** | `label_visibility="hidden"` — label hidden but vertical space preserved. |
| A8 | **Label collapsed** | `label_visibility="collapsed"` — label hidden, no space reserved. |
| A9 | **With help tooltip** | Label has a `?` icon that shows tooltip on hover. |
| A10 | **Fixed width** | `width=400` — container has max-width constraint. |
| A11 | **Stretch width** | Default — container fills available width. |
| A12 | **Content width** | `width="content"` — container shrinks to fit content (pills + button). |

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

Shown for categorical string columns, at any cardinality. Above the render cap the option list
is fetched when the popover opens and searched server-side, with a "Showing 100 of 3,412 — type
to search" header; below it, all options are present and search filters locally.

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

Shown for string columns that read as prose — near-all-distinct values, or long text. Not
merely high cardinality: a 3,000-value `city` column still gets the multiselect popover.

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
┌───────────────────────────────────────────────┐
│ Column Name                        [🗑 Delete] │
│ ───────────────────────────────────────────── │
│ [Operator ▾]                                  │
│                                               │
│ [Select or type a date... ▾]                  │
│       —                                       │
│ [Select or type a date... ▾]                  │
│                                               │
└───────────────────────────────────────────────┘
```

### Layout — single-value operators (`before`, `after`, `equals`)

```
┌───────────────────────────────────────────────┐
│ Column Name                        [🗑 Delete] │
│ ───────────────────────────────────────────── │
│ [Operator ▾]                                  │
│                                               │
│ [Select or type a date... ▾]                  │
│                                               │
│ ┌───────────────────────────────────────────┐ │
│ │ Aug 2026                          < >     │ │
│ │ Su  Mo  Tu  We  Th  Fr  Sa               │ │
│ │ ...calendar...                            │ │
│ └───────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

The date combobox is a combined input that supports typing a date directly or selecting
from a dropdown of relative presets (Today, Yesterday, One week ago, etc.) and "Custom
date" for calendar picking. See Section K for full preset list.

### States by Operator

| # | Operator | Inputs Shown | Pill Summary |
|---|----------|-------------|--------------|
| H1 | `between` | Two date combobox inputs (start, end) with presets | `Founded: Jan 2020 – Dec 2023` |
| H2 | `not_between` | Two date combobox inputs (start, end) with presets | `Founded: not between Jan 2020 – Dec 2023` |
| H3 | `equals` | One date combobox input with presets | `Founded: = Jan 15, 2023` |
| H4 | `not_equals` | One date combobox input with presets | `Founded: ≠ Jan 15, 2023` |
| H5 | `before` | One date combobox input with presets | `Founded: before Mar 2022` |
| H6 | `after` | One date combobox input with presets | `Founded: after Jun 2021` |
| H7 | `is_relative_to_today` | Direction dropdown + Unit dropdown + calendar preview | `Created: This week` |
| H8 | `is_null` | No inputs | `Founded: is empty` |
| H9 | `is_not_null` | No inputs | `Founded: is not empty` |

Note: Absolute operators (H1–H6) use a combobox date input that offers relative presets
(Today, Yesterday, One week ago, etc.) in a dropdown alongside "Custom date" for manual
calendar selection. See Section K for full details on both the relative operator and the
date presets UI.

### Interaction States

| # | State | Description |
|---|-------|-------------|
| H10 | **Empty** | Date combobox placeholder shown ("Select or type a date..."). |
| H11 | **Preset selected** | A relative preset (e.g., "One week ago") fills the date input. Filter will update with the current date. |
| H12 | **Custom date selected** | User picked "Custom date" and selected from the calendar. |
| H13 | **Both bounds set** | For `between`/`not_between`: both start and end dates filled. |
| H14 | **Disabled** | Inputs read-only/dimmed. |

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
| `is_relative_to_today` | is relative to today |
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

### Visual Anatomy

```
┌──────────────────────────────────────────────────────────┐
│  My Filters  ≡                                           │
│              ^^                                          │
│              filter icon                                 │
│                                                          │
│  [Industry: Tech] [Stage: Lead] [Clear all] [+ Add]      │
└──────────────────────────────────────────────────────────┘
```

The filter icon (`:material/filter_list:`) provides visual identity for the widget even
without label text.

The bar is always expanded in V1 — there is no disclosure chevron, count badge, or collapsed
state. See the product spec's Out of Scope for the deferred collapsible variant, which would
add a chevron, a count badge, and four states here.

---

## K. Relative Date Selection

For date/datetime columns, the operator dropdown includes an "is relative to today" option.
When selected, two sub-dropdowns appear for composing the relative range. This is separate
from the absolute operators (before, after, between, etc.) which show a date input with
preset suggestions.

### Operator Dropdown Structure

```
┌──────────────────────┐
│ between            ✓ │
│ not between          │
│ before               │
│ after                │
│ equals               │
│ not equals           │
│ ────────────────── │
│ is relative to today │
│ ────────────────── │
│ is empty             │
│ is not empty         │
└──────────────────────┘
```

### Layout — "is relative to today" operator

When this operator is selected, two composition dropdowns appear below the header:

```
┌─────────────────────────────────────────────┐
│ Created  [is relative to today ▾]      [🗑] │
│ ─────────────────────────────────────────── │
│                                             │
│ [This ▾]        [week ▾]                    │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Aug 2026                        < >     │ │
│ │ Su  Mo  Tu  We  Th  Fr  Sa             │ │
│ │                                         │ │
│ │ [16] [17] [18] [19] [20] [21] [22]     │ │  ← computed range highlighted
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Filter will update with the current date    │
└─────────────────────────────────────────────┘
```

### Direction Dropdown (first)

| Value | Meaning |
|-------|---------|
| **This** | Current period (this day/week/month/year) |
| **Past** | Previous period (last day/week/month/year) |
| **Next** | Next period (upcoming day/week/month/year) |

### Unit Dropdown (second)

| Value | Meaning |
|-------|---------|
| **day** | Single day |
| **week** | Full calendar week (Su–Sa) |
| **month** | Full calendar month |
| **year** | Full calendar year |

### Calendar Preview

Below the dropdowns, a calendar renders the computed date range with the matching dates
highlighted (e.g., "This week" highlights Mon–Sun of the current week, "Past month"
highlights all days of the previous month). A footer note reads:
"Filter will update with the current date".

### Layout — absolute operators with date presets

For absolute operators (before, after, equals, etc.), a combobox input appears with
preset relative suggestions:

```
┌─────────────────────────────────────────────┐
│ Created  [is before ▾]                 [🗑] │
│ ─────────────────────────────────────────── │
│                                             │
│ [Select or type a date... ▾]                │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Today                                   │ │
│ │ Tomorrow                                │ │
│ │ Yesterday                               │ │
│ │ One week ago                            │ │
│ │ One week from now                       │ │
│ │ One month ago                           │ │
│ │ One month from now                      │ │
│ │ Custom date                           ✓ │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Aug 2026                        < >     │ │
│ │ Su  Mo  Tu  We  Th  Fr  Sa             │ │
│ │ ...calendar...                          │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Date Presets (in combobox dropdown)

| Preset | Resolves To |
|--------|-------------|
| Today | Current date |
| Tomorrow | Current date + 1 day |
| Yesterday | Current date − 1 day |
| One week ago | Current date − 7 days |
| One week from now | Current date + 7 days |
| One month ago | Current date − 1 month |
| One month from now | Current date + 1 month |
| Custom date | Manual calendar selection |

### States

| # | State | Description |
|---|-------|-------------|
| K1 | **Relative operator selected** | Direction + unit dropdowns shown. Calendar highlights computed range. Pill shows composed label (e.g., `Created: This week`). |
| K2 | **Direction dropdown open** | Shows "Past", "Next", "This" options. |
| K3 | **Unit dropdown open** | Shows "day", "week", "month", "year" options. Current selection has checkmark. |
| K4 | **Absolute operator with presets** | Combobox shows preset suggestions; selecting one fills the date value. "Custom date" option opens calendar for manual selection. |
| K5 | **Pill summary (relative)** | Shows composed label: `Created: This week`, `Created: Past month`, `Created: Next year`. |
| K6 | **Disabled** | Dropdowns non-interactive, dimmed. |

### Resolution

Relative dates are resolved server-side on each script rerun — the filter state stores
the direction and unit (e.g., `{"direction": "this", "unit": "week"}`), not computed
dates. "This week" always means the current calendar week. The calendar preview and the
"Filter will update with the current date" note communicate to users that the filter is
dynamic. See tech spec "Relative Date Resolution" section for details.

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

## M. Filter Logic (Deferred)

All active filters combine with **AND**: every filter must pass for a row to be included. There
is no AND/OR control in V1, so this section specifies no states.

Within a single filter, OR is already available wherever the filter type provides it — a
multiselect matches any selected value, and `between` covers two-sided numeric and date ranges.

If cross-field OR is built later, the shape would be Notion-style nested groups behind an
explicit advanced affordance rather than a global toggle, and it would need design for the
group container, per-group logic controls, moving filters between groups, and how inter-group
logic is expressed. See the product spec's Out of Scope for its ordering against within-field
multi-condition, which is the higher-priority gap.

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
| Container (A) | 12 |
| Pill (B) | 4 + content variants |
| Column Picker (C) | 4 |
| Multiselect Popover (D) | 9 |
| Text Popover (E) | 11 |
| Range Popover (F) | 12 |
| Toggle Popover (G) | 6 |
| Date Popover (H) | 14 |
| Operator Selector (I) | 4 |
| Shared Patterns (J) | 6 |
| Relative Date Selection (K) | 6 |
| List/Tags Popover (L) | 9 (future) |
| Filter Logic (M) | 0 (deferred) |
| Time Range Popover (N) | 12 |
| **Total unique states** | **~109** |
