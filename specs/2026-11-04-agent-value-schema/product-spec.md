---
author: lukasmasuch
created: 2026-11-04
---

# Agent API value schemas: constraints, selections, and checks

## Summary

Every element an agent can set carries a `value_schema`, the JSON Schema of what a
request sends it. In the [agent API](../2026-08-28-agent-app-interface/product-spec.md)
v1 it states shape only: the JSON type, `format: date`, and a range's item count.

This spec adds three things:

- **Constraint keywords.** The schema gains the standard JSON Schema keywords for the
  constraints each widget enforces on the server once
  [server-side widget constraints](https://github.com/streamlit/streamlit/pull/17717)
  lands: `minimum`, `maximum`, `maxLength`, `maxItems`, and `pattern`. A password input
  also gets `writeOnly`.
- **Dataframe selections.** A selectable `st.dataframe` gets an object schema, so an
  agent can select rows, columns, and cells.
- **One validator.** The server checks every sent value against its schema with a single
  validator and reports every invalid value at once.

Option lists stay in `props`: no list is ever copied into a schema.

## Problem

### The schema leaves out what the server enforces

v1 left bounds out on purpose: "bounds would make the schema stricter than v1, which
resets an out-of-range number rather than refusing it." The server-side constraints spec
([#17717](https://github.com/streamlit/streamlit/pull/17717), Phase 1 in
[#17782](https://github.com/streamlit/streamlit/pull/17782)) removes that reason. Its
widgets refuse an out-of-range number, text past `max_chars`, or too many selections, and
the agent API answers `invalid_value`. Its product spec already names the payoff: "a
`value_schema` that can finally state `minimum`, `maximum`, and `maxLength` truthfully."

The constraints are already readable in `props`, but under Streamlit's parameter names. A
model can read those names; generic tooling cannot. JSON Schema validators, form
generators, [MCP elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation)
forms, and tool definitions with constrained decoding all know `maximum`, not
`max_value`. Every value such tooling gets wrong costs a refused request, and a model
spends a turn on each one.

Some facts are in no prop at all:

- `st.feedback(options="stars")` takes an index from 0 to 4, which only a client that
  knows Streamlit can work out.
- A password input's value is write-only, and only prose says so.

### The commonest drill-down cannot be driven

[Follow-up #8](../2026-08-28-agent-app-interface/product-spec.md#follow-ups) of the agent
spec puts dataframe selections first, because "select a row for
details" is how many dashboards drill down. v1 marks every selectable dataframe
`action_unsupported`, so an agent stops one step short of the detail view.

The value is the nested object `st.session_state` already holds:
`{"selection": {"rows": [...], "columns": [...], "cells": [...]}}`. Which parts are legal
depends on `selection_mode` and the row count, and no prop describes that. v1 anticipated
this case: such a value "is declared the same way", by its `value_schema`.

### Nothing checks the schema as a schema

- `_check_json_type` in `runtime/agent/widget_writes.py` is hand-written. It reads
  `value_schema.type` and a list length, ignores `items`, `minItems`, and `format`, and
  never checks a trigger's payload, such as `st.chat_input` text. It could not check a
  nested object at all.
- A refused request names only its first invalid value. A form with three wrong fields
  takes three round trips.
- v1's success criterion says a reported value matches its `value_schema`. The test that
  checks it uses a hand-written matcher that knows only `type` and `items`.

## Proposal

### What a value schema promises

**Necessary, not sufficient.** Every change the server accepts from a client matches its
element's `value_schema`. So a new value that fails the schema is always refused, and a
client can catch the mistake without a round trip.

A value that passes can still be refused, for things no schema here states:

- a label the widget's options do not contain, or a label shared by several options;
- emptying a `required` widget;
- text whose UTF-16 length exceeds `max_chars`;
- a range or a list of rows out of order.

v1's two shorthands still apply on top of the schema: `null` resets or clears a widget, and
a one-item list stands for the single value the schema names.

Five rules follow:

- **A keyword appears only where the widget's own server-side check enforces it, or
  something stricter.** A constraint that only the browser enforces never becomes a
  keyword, because the schema would then refuse values the server accepts. `validate`
  and the checks of `type="email"` are examples.
- **Reported values match.** Sending back what the snapshot reports never fails its
  schema, with one exception: a value no client sent that the widget does not reconcile
  when its constraints change, such as an author's color default with a trailing
  newline, or the selection of a keyed table whose rows shrank under it. Sending such a
  value back is still accepted, because neither check applies to an unchanged value; see
  [On the server](#on-the-server-the-schema-first-then-the-widget).
- **No list is copied.** `enum` never appears. Options stay in `props.options` and table
  columns in `data.columns`.
- **Standard keywords only.** The schemas use JSON Schema 2020-12, the dialect OpenAPI
  3.1 uses. There are no `x-` extensions and no `$data` references. Annotations that
  would repeat a prop are left out: `title` would repeat `label`, and `description` would
  repeat `help`.
- **A client may ignore a keyword it does not know.** Its check only gets looser, never
  wrong. That is why keywords can be added within `schema_version: 1`.

### Keywords per widget

Every keyword in this table depends on #17782 (Phase 1 of #17717), which makes the widget
refuse what the keyword rules out.

| Command | `value_schema` today | Adds | Taken from |
| --- | --- | --- | --- |
| `st.number_input` | `integer` or `number` | `minimum`, `maximum` | `min_value` and `max_value` when the author set them, which is also when `props` reports them |
| `st.slider` over numbers | `integer` or `number`, or a range of them | `minimum` and `maximum`, on `items` for a range | the resolved `min_value` and `max_value` |
| `st.text_input`, `st.text_area`, `st.chat_input` | `string` | `maxLength` | `max_chars`, when it is positive, since `0` means no limit |
| `st.text_input(type="password")` | `string` | `writeOnly: true` | `type` |
| `st.multiselect` | array of `string` | `maxItems` | `max_selections` |
| `st.feedback` | `integer` | `minimum: 0`, `maximum` | the highest index: one less than the number of thumbs, faces, or stars, so `1` or `4` |
| `st.pagination` | `integer` | `minimum: 1`, `maximum` | `num_pages` |
| `st.color_picker` | `string` | `pattern: "^#(?:[0-9a-fA-F]{3}){1,2}$"` | the layout the widget accepts |
| `st.dataframe` with selections | none | an object schema | `selection_mode` and the row count; see [Dataframe selections](#dataframe-selections) |

```json
{
  "type": "slider",
  "key": "discount",
  "props": {
    "label": "Discount (%)",
    "min_value": 0,
    "max_value": 50,
    "step": 5,
    "disabled": false,
    "label_visibility": "visible",
    "on_change": "rerun"
  },
  "value_schema": { "type": "integer", "minimum": 0, "maximum": 50 },
  "value": 10
}
```

A bounded widget grows by about 25 bytes. The bounds now appear in both `props` and the
schema. That copy is cheap, unlike a copy of the option list.

Left unchanged, and why:

- **Option widgets.** `st.selectbox`, `st.radio`, `st.select_slider`, `st.pills`,
  `st.segmented_control`, `st.menu_button`, and stateful `st.tabs` are constrained by
  membership in their options, which `props` already carries.
- **Date and time bounds.** `st.date_input`, `st.datetime_input`, and temporal sliders
  have bounds that are dates or times written as text. JSON Schema bounds apply only to
  numbers, and `formatMinimum` is a validator extension rather than a standard keyword.
  The bounds stay in `props`, and the widget enforces them.
- **`required`.** An untouched required widget still reports its empty value, and a
  request may send that value back. `minLength: 1` would refuse it, and text of only
  whitespace counts as empty anyway.
- **`validate`, and the checks of `type="email"` and `type="url"`.** Only the browser
  runs them. #17717 keeps them off the server because running an author's pattern on
  attacker-supplied text risks ReDoS. A `pattern` or `format` would refuse values the
  server accepts. The regex stays in `props.validate` for a client that wants to match
  the browser.
- **`step`.** Neither the browser nor the server checks a typed number against it.
  `multipleOf` also counts from zero, while a step counts from `min_value`.
- **`uniqueItems` on `st.multiselect`.** A correct browser can repeat a label: "Select
  all" over options that share a label, or a `default` that repeats one.

`maxLength` counts code points, while `max_chars` counts UTF-16 code units, as the browser
does. So text with emoji can pass `maxLength` and still be refused, which is the
"necessary, not sufficient" rule at work.

#### Where the keywords come from

**Option 1: The command passes them from its arguments** ✅ PREFERRED

```python
value_schema = agent_spec.number(
    integer=data_type == NumberInputProto.INT,
    minimum=min_value if has_user_min else None,
    maximum=max_value if has_user_max else None,
)
```

- Pros: This is the pattern every description already follows, in the same function and
  from the same arguments, on the line next to the `min_value` prop it mirrors.
- Cons: The constraint is written twice, once in the `validate` of the widget's serde (its
  serializer and deserializer) and once here, so only the test in [In CI](#in-ci) keeps
  the two in step.

**Option 2: The widget's serde builds the schema next to its `validate`**

- Pros: One definition per constraint.
- Cons: A serde checks the wire value, while the schema describes the JSON a request
  sends. The two differ for option indexes, temporal microseconds, and number inputs
  with sentinel bounds, so every serde would have to learn the agent encoding. The test
  is still needed, because `validate` and the schema could still disagree. This option
  moves the duplication without removing it.

### Temporal values

`st.time_input`, `st.datetime_input`, and time and datetime sliders hold values without an
offset. The agent API reads them in any ISO 8601 layout.

**Option 1: Plain `string`, as in v1** ✅ PREFERRED

- Pros: True for every value the server accepts, and the protocol description already
  says that times are ISO 8601 text.
- Cons: No machine-readable layout.

**Option 2: `format: time` and `format: date-time`**

- Cons: RFC 3339 requires an offset in both. A validator that asserts formats would
  refuse every reported value, and constrained decoding would force an offset onto values
  the server then refuses.

**Option 3: `time-local` and `date-time-local` from the [OpenAPI Format Registry](https://spec.openapis.org/registry/format/)**

- Pros: These formats mean exactly "RFC 3339 without the offset".
- Cons: RFC 3339 also requires seconds, while v1 reports `"09:30"` and
  `"2026-10-12T09:30"`. Adopting them means changing a pinned v1 encoding, and no
  validator or model provider recognizes them today. Revisit if tooling does.

**Option 4: `pattern`**

- Cons: The server accepts any ISO 8601 layout. A pattern would either refuse layouts the
  server accepts, or be too broad to help.

`format: date` stays. `st.date_input` requires `YYYY-MM-DD`, which is RFC 3339
`full-date`.

### Dataframe selections

An `st.dataframe` with `on_select` becomes an ordinary value element. It has
`action: "value"`, an entry in `actions` with no `label`, a `value` in the shape
`st.session_state` holds, and a `value_schema`. `props.selection_mode` stays, and the
`support` field goes away. A dataframe that also has a button column keeps
`action_unsupported`, for its selections too, until button columns can be driven.

```json
{
  "type": "dataframe",
  "key": "orders",
  "props": {
    "selection_mode": ["multi-row", "single-column"],
    "on_select": "rerun"
  },
  "data": {
    "columns": [
      { "name": "order", "type": "large_string" },
      { "name": "amount", "type": "double" }
    ],
    "row_count": 4,
    "column_count": 2,
    "complete": true,
    "preview": { "rows": [["A-1", 12.5], ["A-2", 40.0], ["A-3", 7.25], ["A-4", 18.0]] },
    "url": "../../media/9c2e41d07a6b38f5"
  },
  "value_schema": {
    "type": "object",
    "properties": {
      "selection": {
        "type": "object",
        "properties": {
          "rows": {
            "type": "array",
            "items": { "type": "integer", "minimum": 0, "maximum": 3 },
            "uniqueItems": true
          },
          "columns": {
            "type": "array",
            "items": { "type": "string" },
            "maxItems": 1
          },
          "cells": { "type": "array", "maxItems": 0 }
        },
        "additionalProperties": false
      }
    },
    "required": ["selection"],
    "additionalProperties": false
  },
  "value": { "selection": { "rows": [1], "columns": [], "cells": [] } }
}
```

A request selects rows 0 and 2:

```json
{
  "session_id": "s_7f3a",
  "widget_state": { "orders": { "selection": { "rows": [0, 2] } } }
}
```

- **The value is the session-state shape.** It is what `st.session_state["orders"]`
  holds and what assigning to it takes, so `widget_state` still reads like session state.
  `selection` is required.
- **A request replaces the whole selection**, as a browser's message does. A list left
  out is empty, so leaving out `columns` clears the selected columns.
- **Every list is declared.** A list for a mode that is not enabled is
  `{"type": "array", "maxItems": 0}`, so the reported value, which always carries all
  three lists, matches the schema.
- **Rows** are integer positions in the data the app passed, the same order
  `data.preview` lists them in, from `minimum: 0` to `maximum: row_count - 1`.
  - `single-row` and `single-row-required` add `maxItems: 1`.
  - `single-row-required` also adds `minItems: 1` when the table has rows, because the
    browser always keeps one row selected.
  - Rows go in ascending order, as the browser sends them. Another order is refused
    rather than sorted, like a reversed range, because #17782 stops adjusting sent
    values. The schema cannot state the order, so the error asks for ascending rows.
  - `uniqueItems` holds, because a row is a position.
  - A table with no rows gets `{"type": "array", "maxItems": 0}` for rows and cells, like
    a mode that is not enabled, rather than `maximum: -1`.
  - A lazily loaded table of unknown size states no `maximum`.
- **Columns** are names as `data.columns` spells them.
  - `data.columns` also lists index columns, an unnamed one as `__index_level_0__`.
    They cannot be selected, and the error for one lists the names that can.
  - Names are compared as text, as the browser sends them, so a column named `0` is
    selected as `"0"`.
  - They are not enumerated in the schema, because `data.columns` already lists them.
  - `single-column` adds `maxItems: 1`.
  - There is no `uniqueItems`. An Arrow table can repeat a column name, and selecting
    both such columns sends the name twice.
- **Cells** are `[row, column]` pairs. Each pair is
  `{"type": "array", "prefixItems": [<the row schema>, {"type": "string"}], "minItems": 2, "maxItems": 2}`,
  because `prefixItems` alone also lets a shorter or longer list pass.
  - `single-cell` adds `maxItems: 1`.
  - `multi-cell` takes any number of cells. A browser sends a dragged rectangle as the
    cells it covers, and in a sorted or reordered table that rectangle can be any set of
    rows crossed with any set of columns, so the shape is not checked.
  - There is no `uniqueItems`, for the same reason as for columns.
- **Rows, columns, and cells combine freely**, because the browser blends selections
  additively.
- **`null` resets the selection** to `selection_default`, or to no selection.

A selection schema costs about 360 bytes, or about 470 with every mode enabled, a small
part of a table node.

**This needs #17717 item 8**, the server-side check of dataframe selections. Today only
programmatic selections are validated, and that validation filters bad entries out rather
than refusing them. A client's selection reaches the app unchecked. Item 8 names only
`selection_mode` and bounds, so it has to grow to refuse everything the schema rules out:

- an unknown key;
- a list for a mode that is not enabled;
- a row out of range;
- an unknown column, or an index column;
- too many items, or a repeated row;
- empty rows in `single-row-required` mode;
- rows out of order.

It also has to compare column names as text. A browser session drops such a value, as
#17717 does with every refused value, and the agent API refuses it with `invalid_value`.

Chart selections follow the same pattern with #17717 item 12. They are harder, because a
selected point is identified by library-specific data values rather than by position; see
[Follow-ups](#follow-ups).

### Checking values

#### On the server: the schema first, then the widget

Each `widget_state` value, and each trigger's `value`, is first normalized by v1's rules:
`null`, a one-item list for a single value, and a whole float such as `1.0` read as an
integer. It is then checked against its element's `value_schema`, before it is encoded.

- **This replaces `_check_json_type`.** Nested selections get checked, and so do trigger
  payloads such as `st.chat_input` text against `maxLength`.
- **The widget's own check from #17782 runs next.** It decides everything a schema cannot:
  options, `required`, UTF-16 length, order, and labels shared by several options.
- **An unchanged value skips both checks.** #17782's widget check passes a value whose
  wire form equals the stored one, and the schema check follows the same rule. So
  sending back an unreconciled reported value is accepted and changes nothing.
- **The validator supports only the keywords the snapshot emits:** `type`, `format`,
  `minimum`, `maximum`, `maxLength`, `pattern`, `items`, `prefixItems`, `minItems`,
  `maxItems`, `uniqueItems`, `properties`, `required`, `additionalProperties`, and
  `writeOnly`. That is about 150 lines.
  - `format` is an annotation, as JSON Schema's default treats it. The widget checks the
    layout itself.
  - `pattern` is ECMA-262. The only pattern is the fixed color one, which reads the same
    in Python's `re` when matched in full.
- **The test suite holds the validator to the standard.** Its verdicts are tested against
  `jsonschema`'s Draft 2020-12 validator on a shared corpus, so it cannot drift.
  - The corpus covers where Python and JSON Schema disagree: `true` is not an integer,
    and `1` and `1.0` are equal under `uniqueItems`.
  - It pins one known difference to the ECMA-262 verdict. `jsonschema` applies `pattern`
    with `re.search`, where `$` also matches before a final newline, so it accepts
    `"#fff\n"`.

The `jsonschema` package is not used at runtime, for three reasons:

- It reaches Streamlit only through Altair, whose `jsonschema>=3.0` floor admits versions
  without Draft 2020-12.
- Its messages quote the value ("'hunter2' is too long"), while agent errors never quote
  a sent value, because it may be a password.
- A closed vocabulary does not need a general validator.

#### In the response: every invalid value at once

When a request is refused with `invalid_value`, `error.violations` lists each value that
fails, in request order. Each entry carries the element's `key`, a
[JSON Pointer](https://www.rfc-editor.org/rfc/rfc6901) `path` into the value (`""` for the
whole value), and a `message`:

```json
{
  "error": {
    "code": "invalid_value",
    "message": "'discount' takes values from 0 to 50, inclusive.",
    "violations": [
      {
        "key": "discount",
        "path": "",
        "message": "'discount' takes values from 0 to 50, inclusive."
      },
      {
        "key": "orders",
        "path": "/selection/rows/1",
        "message": "'orders' has 4 rows, numbered from 0 to 3."
      }
    ]
  }
}
```

`error.message` stays the first violation's message, so v1 clients read the same text as
before.

Addressing errors such as `unknown_key`, `not_on_page`, and `disabled_widget` still answer
on their own, and the first one wins. They mean the client is working from a stale
snapshot, and listing value errors from that snapshot would not help.

No check changes state, so checking past the first invalid value is safe: nothing runs
until every value passes.

#### On the client: any 2020-12 validator

The OpenAPI document describes `value_schema` as a `ValueSchema` component. It lists the
supported keywords and allows others, because later versions may add them. The protocol
description tells clients how to use it:

- Validate a value against its `value_schema` before sending it, and skip the check for
  `null`.
- A changed value that fails is always refused.
- A value that passes may still be refused, for the reasons the `widget_state` field
  lists.

LLM tool providers each accept a different subset of these keywords:

- Anthropic's strict mode rejects `minimum`, `maxLength`, and `maxItems`, so v1's own
  `maxItems` is already rejected there.
- Gemini drops `maxLength`.
- OpenAI's strict mode takes most of them.

A client that copies a `value_schema` into a strict tool definition has to transform it
first, as those providers' SDKs already do. Streamlit does not shape its schemas for any
one provider. The numeric bounds, `maxLength`, and `maxItems` are also the keywords MCP
elicitation's form schemas use, so a client that asks its own user to fill in a widget
can pass them through.

#### In CI

- **Reported values.** The hand-written `_matches_schema` in `widget_values_test.py` gives
  way to `jsonschema`'s Draft 2020-12 validator, which tests already use for the OpenAPI
  document. Every reported value except `null` must validate. The two unreconciled cases
  in [What a value schema promises](#what-a-value-schema-promises) are left out of that
  assertion, and a test sends each one back and expects it accepted.
- **Edges.** For each keyword a widget emits, the test sends the widget's own check a
  value just inside the bound, which must be accepted, and one just outside, which must
  be refused. Run at both edges, this catches a schema that is looser or stricter than the
  server at that edge, such as `maximum: row_count` where `row_count - 1` is meant.
- **Vocabulary.** The coverage test fails on any keyword outside the vocabulary above,
  and the snapshot-validation test checks every emitted schema against the `ValueSchema`
  component.

### Delivery

| PR | Scope | Needs |
| --- | --- | --- |
| 1 | The schema validator in place of `_check_json_type`, trigger payloads checked, `error.violations`, the `ValueSchema` component, and the CI checks. No new keywords. | #17782 merged, since it rewrites `widget_writes.py` |
| 2 | The keywords in [Keywords per widget](#keywords-per-widget), through new `agent_spec` builder parameters. | #17782, so the widgets refuse what the keywords rule out |
| 3 | Dataframe selections: the description, the codec (the value travels as JSON text in `string_value`), and the snapshot changes. The schema needs the row count, so it is built only while recording, like `data`. | #17717 item 8, in the same PR or before it |

When these land, the agent spec needs these edits:

- [Actions in v1](../2026-08-28-agent-app-interface/product-spec.md#actions-in-v1):
  - "Legal values stay in `props`. No `enum` and no bounds" keeps "no `enum`" and adds the
    standard keywords.
  - "It says what to send, not what the server refuses" becomes the "necessary, not
    sufficient" rule.
  - The JSON-type bullet points to the schema check.
- The "Unsupported things stay visible" rule: a dataframe is `action_unsupported` only
  with a button column.
- [What v1 does not support](../2026-08-28-agent-app-interface/product-spec.md#what-v1-does-not-support):
  dataframe selections leave the selections row, while chart selections, data editor
  edits, and button columns stay.
- Follow-up #8 starts with chart selections. The smaller follow-up "Values" item drops
  the `value_schema` keywords and keeps the per-key note and the large integers.
- The success criterion on reported values gains the exception for unreconciled values.

## Alternatives considered

- **`enum` from the options.** Gradio's API schema does this. It is rejected for four
  reasons:
  - It copies the largest part of many snapshots, and options are already in `props`
    under the name models know.
  - It hits provider limits: OpenAI caps an `enum` at 1,000 values.
  - It cannot say that a label shared by several options is ambiguous.
  - It is wrong for `accept_new_options`.

  A client that needs an `enum` builds it from `props.options` in one line.
- **`null` in the type, as `"type": ["integer", "null"]`.** That would make `null`
  self-describing. But it changes the `type` field from a string to a list for every
  widget, which is not additive for clients that read it. It also invites constrained
  decoding to emit `null` where a value was meant. `null` stays a protocol rule.
- **`default`, for what `null` resets to.** This would be useful after a long session.
  But it copies a value per widget, a `default` list can be long, and an agent can send
  `null` and read the result. Left as a follow-up.
- **Using `jsonschema` at runtime.** See
  [On the server](#on-the-server-the-schema-first-then-the-widget).
- **A dry-run (`validate_only`) request.** A refused request already runs nothing, so the
  real request is its own dry run for every invalid value. A dry run would add only "this
  valid request would be accepted", which no use case needs yet.
- **`$data` references from the schema into `props`.** These avoid copying, but `$data`
  is not standard JSON Schema, and most validators would ignore it.

## Follow-ups

- **Chart selections**, with #17717 item 12. Each library's state gets an object schema
  the same way:
  - Vega-Lite selections are keyed by parameter name, so their `properties` follow from
    the specification.
  - Plotly selections hold `point_indices`, plus `points`, `box`, and `lasso` entries
    whose fields depend on the trace.
  - Deck.gl selections hold per-layer `indices`.
  - ECharts selections hold series and data indexes.

  The open design question is what identifies a point: an index, which the agent can
  read from `data`, or data values, which the browser sends.
- **`st.data_editor` edits and dataframe button columns**, with #17717 items 6 and 10.
  An edit is a delta object whose cells have per-column types, and `column_config`
  carries their constraints.
- **Temporal formats**: `time-local` and `date-time-local`, if tooling adopts them and a
  later schema version reports times with seconds.
- **`default`**, if clients ask what `null` resets to.
- **A machine-readable `constraint` on each violation**, such as `maximum` or
  `max_chars`, once #17782's violation kinds settle into public names.

## Checklist

| Item | ✅ or comment |
| --- | --- |
| Works on SiS, Cloud, etc? | ✅ Server-side only, and it changes nothing for browser sessions beyond what #17717 already does. |
| No breaking API changes | ✅ No `st.*` signature changes. The changes are additive within `schema_version: 1`: new keywords in `value_schema`, `error.violations`, and a selectable dataframe that gains `action`, `value`, and `value_schema` and loses `support`. The agent spec anticipated that last one: "a later revision can accept the action and drop the field." A request v1 accepted and this spec refuses is either already refused by #17782 or out of shape for a selection, which v1 could not set. |
| No new dependencies | ✅ The validator is in-house. `jsonschema` stays test-only, where it is already used. |
| Metrics collected | No. The agent API's request counts are unchanged. |
| Any security/legal impact? | ✅ Positive. Client selections are checked on the server for the first time, through #17717 item 8. Errors never quote a sent value. A selection exposes nothing new: the browser can select any row the app shows. |
| Any docs changes needed? | The served protocol description (the `value_schema`, `widget_state`, and `invalid_value` text, plus the `ValueSchema` component), and the agent API section of the embedded skill's `references/testing.md`. |
