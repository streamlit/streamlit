---
author: lukasmasuch
created: 2026-06-29
---

# Specialized input types for `st.text_input`

## Summary

Extend the `type` parameter of `st.text_input` beyond `"default"` and `"password"` to support
common specialized types: `"email"`, `"url"`, `"phone"` (native HTML `tel`), and `"search"`. Choosing a
specialized type opts the input into the matching native HTML input type (better mobile keyboards
and browser autofill) and applies sensible, fully overridable defaults for `icon`, `placeholder`,
`validate`, and `autocomplete`. So `st.text_input("Email", type="email")` validates an email and
shows a mail icon out of the box, with no extra code.

## Problem

Today every non-password `st.text_input` is a plain text field. Anyone collecting an email, URL, or
phone number has to wire up validation, icons, placeholders, and mobile keyboard hints by hand:

```python
# Collecting an email today
email = st.text_input("Email", placeholder="you@example.com", icon=":material/mail:")
if email and not re.match(r"^[\w.+-]+@[\w-]+\.[\w.-]+$", email):
    st.error("Enter a valid email address.")
    st.stop()
```

This is verbose, only validates *after* a full rerun, and is re-implemented slightly differently in
every app. It also misses native browser affordances: mobile users don't get the email/URL/numeric
keyboards, and browser autofill can't recognize the field.

**Requests:**

- [#6704](https://github.com/streamlit/streamlit/issues/6704) - Support more specialized types for
  `st.text_input` (email, url, phone, ...) — 43 👍. The issue explicitly asks for
  `type="email"` that "validate[s] email addresses before we even rerun."
- [#8790](https://github.com/streamlit/streamlit/issues/8790) - Client-side validation via regex for
  `st.text_input` (now shipped via the companion `validate` parameter,
  [#15714](https://github.com/streamlit/streamlit/pull/15714)).
- The community `streamlit-extras` "Specialized Inputs" extra (email, URL, phone, handles) exists as
  a workaround, signaling real demand.

**Use cases:**

- Email / URL fields in contact, signup, and settings forms with instant format feedback.
- Phone number fields that bring up the numeric keypad on mobile.
- Search boxes with a clear ("×") affordance and search-optimized keyboard.
- Forms that want browser autofill (email, phone, url) to work correctly.

**Consistency gap:**

This builds directly on the `validate` parameter from
[`specs/2025-12-03-text-input-validation`](../2025-12-03-text-input-validation/product-spec.md). Its
**client-side regex** half has now shipped
([#15714](https://github.com/streamlit/streamlit/pull/15714)): `validate` accepts a JS-flavored regex
`str` or a `(regex, message)` tuple, with `validate=None` (the default) meaning *no validation*. The
server-side callable half from that spec is a deferred follow-up and is **not** available yet. That
spec already lists #6704 as motivation; specialized types are the ergonomic "front door" that makes
common validations a one-liner.

## Proposal

### API

Extend the existing `type` parameter (no new parameters):

```python
st.text_input(
    label,
    ...,
    type: Literal["default", "password", "email", "url", "phone", "search"] = "default",  # EXTENDED
)
```

Per API principle 16 ("Prefer Enums Over Booleans") and 18 ("Extend Before Inventing"), `type` is
already the right home for this — it was designed to grow. This is purely additive and backward
compatible.

### Type values

| `type` | Native HTML type | Use case |
|--------|------------------|----------|
| `"default"` | `text` | Generic single-line text (unchanged). |
| `"password"` | `password` | Masked secret entry (unchanged). |
| `"email"` | `email` | Email addresses. |
| `"url"` | `url` | Web addresses. |
| `"phone"` | `tel` | Phone numbers (numeric keypad on mobile). |
| `"search"` | `search` | Free-text search, with a clear ("×") button. |

Each specialized type:

1. **Sets the native HTML `type`** on the underlying `<input>`. This gives users the matching mobile
   keyboard (e.g. `@`/`.com` keys for email, the numeric keypad for tel) and lets browser autofill
   recognize the field — for free, with zero config.
2. **Applies overridable defaults** for `icon`, `placeholder`, `validate`, and `autocomplete` (see
   below).

#### Naming: `"phone"` (not `"tel"`)

**Decision: `"phone"`.** The public value is `"phone"`; we still render `<input type="tel">`.
`"phone"` is more human-readable for typical users (principle 8, "Semantic Names Over Geeky Names")
than the HTML abbreviation `"tel"`. (`"telephone"` was floated as a compromise, but `"phone"` is the
common term.)

#### Why only these types?

We intentionally limit the set to single-line textual values that still return `str | None` and fit
the `st.text_input` mental model. Everything else either duplicates a dedicated widget or doesn't fit:

| HTML input type | Decision | Reason |
|-----------------|----------|--------|
| `text` | Already covered | `"default"`. |
| `tel` | Exposed as `"phone"` | See naming above. |
| `number` | Exclude | `st.number_input` gives numeric parsing, min/max, step, and a numeric return type. |
| `date`, `time`, `datetime-local`, `month`, `week` | Exclude | `st.date_input` / `st.time_input` return typed Python values; routing these through `text_input` would return strings and create ambiguity. |
| `color` | Exclude | `st.color_picker` exists. |
| `file` | Exclude | `st.file_uploader` exists. |
| `range` | Exclude | `st.slider` exists. |
| `checkbox`, `radio`, `button`, `submit`, `reset`, `image`, `hidden` | Exclude | Not text fields, or conflict with existing widgets / control flow. |

### Mobile keyboard hints (`inputMode` and `enterKeyHint`)

Setting the native `type` raises a natural follow-on question — should we also set the related
`inputMode` and `enterKeyHint` attributes per type? (The underlying
[React Aria `TextField`](https://react-aria.adobe.com/TextField) forwards both as standard DOM props
on its `<input>`, so either is straightforward to set.) **Recommendation: don't set `inputMode`, and
don't auto-derive `enterKeyHint` in the MVP.**

**`inputMode` — rely on the native `type`, don't set it.** The HTML `type` already selects the
appropriate mobile virtual keyboard, so an explicit `inputMode` would be redundant and can even fight
the browser default:

| `type` | Mobile keyboard implied by the native type |
|--------|--------------------------------------------|
| `email` | text keyboard with visible `@` and `.` keys |
| `url` | text keyboard with `/` and `.com` keys |
| `tel` | numeric phone keypad |
| `search` | text keyboard (often with a "search"/"go" return key) |

This mirrors `st.number_input`, which deliberately omits `inputMode` and relies on the native
`type="number"` keyboard (per its inline note referencing #8867). `inputMode` only earns its keep
when a field stays `type="text"` but wants a *different* keyboard than the type implies (e.g.
`type="text" inputmode="numeric"` for OTP/codes) — exactly the deferred `type="otp"` case in
[Out of scope](#out-of-scope-future-work), not these types.

**`enterKeyHint` — not implied by `type`; skip in MVP.** `enterKeyHint` only controls the *label* of
the virtual keyboard's Return key (`enter`/`go`/`search`/`send`/`done`); it is **not** set by the
input `type` (the lone fuzzy exception — `type="search"` showing a "search" key — is inconsistent
across platforms). The honest hint depends on Streamlit's *Enter behavior*, not the input type:

- Inside a form where Enter submits (`allowFormEnterToSubmit`), `"send"`/`"go"` would be accurate.
- Outside a form, Enter just commits the value and reruns — there's no navigation, so the neutral
  default is the most accurate, and `"go"`/`"done"` could mislead.

Because the value is purely cosmetic and driven by form/submit context rather than the input type, we
don't auto-derive it from `type` in the MVP. The one low-risk, type-aligned tweak we include is
`enterKeyHint="search"` for `type="search"`. General `enterKeyHint` control belongs with Streamlit's
existing Enter-to-submit logic and is deferred (see [Out of scope](#out-of-scope-future-work)).

### Smart defaults

When a specialized type is selected and the user hasn't supplied a value for `icon`,
`placeholder`, `validate`, or `autocomplete`, the type fills in a sensible default. Any explicit
value the user passes overrides that default. Opt-out uses the same rule as today's
`autocomplete`: **`None` (or omission) = use the type default**, **`""` = off** — see
[Decision: "use the type default" vs. "no value"](#decision-use-the-type-default-vs-no-value).

| `type` | Default `icon` | Default validation | Default `placeholder` | Default `autocomplete` |
|--------|----------------|--------------------|-----------------------|------------------------|
| `"email"` | `:material/mail:` | Email format | `you@example.com` | `email` |
| `"url"` | `:material/link:` | URL format | `https://example.com` | `url` |
| `"phone"` | `:material/call:` | — (none; phone formats vary too widely) | `+1 234 567 8900` | `tel` |
| `"search"` | `:material/search:` | — (none) | `Search` | `off` |

Notes:

- **Icons** are illustrative; final glyphs are a design decision (e.g. `:material/alternate_email:`
  (the "@" icon) is a strong alternative for email).
- **Validation** is applied only for `email` and `url`, where a single widely-accepted notion of
  validity exists. We deliberately **do not** default-validate `phone` (no universal phone format) or
  `search` (free text). It reuses the companion `validate` feature's now-shipped frontend error UI
  and submit-blocking behavior (error on blur/Enter/submit; invalid values blocked without a rerun;
  empty values skip validation). The email/url defaults are Streamlit-maintained regexes passed
  through `validate` — see
  [Validation source](#validation-source-streamlit-regex-via-validate) below.
- **`placeholder`** examples are intentionally conservative format hints. This is the most debatable
  default (see Out of scope); it can be dropped without affecting the rest. The `phone` example above
  is US-formatted and illustrative only — final values (including a locale-neutral phone format) are
  part of the deferred placeholder-default decision.
- **`autocomplete`** maps to the standard HTML autocomplete tokens so browser autofill works. This
  extends the existing behavior where `type="password"` already defaults `autocomplete` to
  `"new-password"`. `search` defaults to `"off"` so private search terms don't leak into the
  browser's shared autofill history; pass `autocomplete=""` if you prefer plain-text behavior.

#### Validation source: Streamlit regex via `validate`

**Decision: Streamlit-maintained regex through the shipped `validate` channel.** The type default
is literally a `validate=(EMAIL_REGEX, "...")` / `validate=(URL_REGEX, "...")` value — one
validation channel, inspectable and overridable like any other `validate`, with **no new frontend
work** (the merged `validate` feature, [#15714](https://github.com/streamlit/streamlit/pull/15714),
already is a regex channel). A user-supplied `validate` *replaces* the type default (single channel;
the user's rule must be a complete check).

**Email strictness:** require a dotted domain (accept `user@host.tld`, reject intranet-style
`user@host`). That matches the emails almost all Streamlit apps collect (contact, signup, settings).
Apps that need to allow bare hosts can pass their own `validate` (or `validate=""` to turn the
default off). Exact regexes are an implementation detail to finalize during build.

**URL flexibility:** require a dotted host but make the `http(s)://` scheme **optional**, so both
`example.com` and `https://example.com` pass (the scheme is commonly omitted when typing a URL);
obvious non-URLs (plain words, values with spaces) are still rejected. The check is intentionally
permissive — it only needs to catch clear mistakes, not enforce RFC-strict URLs — and apps wanting
stricter rules (e.g. requiring `https://`) can pass their own `validate` (or `validate=""` to turn
the default off).

We considered browser-native `ValidityState.typeMismatch` instead: zero regex maintenance and exact
native `type` semantics, but it would require a *second* frontend validation channel (shipped
`validate` only knows regex) and a two-stage composition model with user `validate`. Rejected in
favor of the single-channel regex approach above.

#### Default precedence

For each enhanced property, the resolved value is: **user value → type default → existing default**.
A real user value always wins; otherwise the type default (from the table) applies; `"default"` and
`"password"` define no enhanced defaults, so they're unchanged.

#### Decision: "use the type default" vs. "no value"

When a type defines a default (e.g. `email` → mail icon), a user needs three distinct intents per
parameter: **(1)** use the type's default, **(2)** use my explicit value, **(3)** force it *off*
(keep `type="email"` for the keyboard/autofill, but no icon / no auto-validation).

**Decision: `None` = derive, `""` = off.** Extends the rule `text_input` *already* uses for
`autocomplete` (`autocomplete=None` derives from the type; `autocomplete=""` opts out) to
`icon` / `placeholder` / `validate`:

| Intent | Encoding |
|--------|----------|
| Use the type default | `None` or omit the argument |
| Use my value | Pass an explicit non-empty value |
| Force off | Pass `""` (`icon=""`, `placeholder=""`, `validate=""`) |

This keeps `None` ≡ omission (no Python surprise), is backward compatible for plain
`default`/`password` inputs (no type default → `None` still means "nothing"), and for `placeholder`
`""` already renders as "no placeholder" today. Minor: `icon=""` currently raises, so map it to
"no icon" before validation.

**`validate` nuance:** the shipped `validate` feature
([#15714](https://github.com/streamlit/streamlit/pull/15714)) already treats both `validate=None`
and `validate=""` as no validation. For specialized types we redefine **`validate=None` → use the
type default** while **`validate=""` stays "off"**. For `type="default"` / `"password"` (no type
default), `None` continues to mean no validation. Never ship a type-derived default users can't
turn off.

### Examples

**Email with zero config** (icon, placeholder, and default email-format validation automatic):

```python
import streamlit as st

email = st.text_input("Email", type="email")
if email:
    # The default email validation is client-side and can be bypassed. Run any
    # security-relevant email checks on the server (in your app code) as well.
    st.success(f"We'll reach you at {email}")
```

**URL and phone in a form:**

```python
import streamlit as st

with st.form("contact"):
    website = st.text_input("Website", type="url")
    phone = st.text_input("Phone", type="phone")
    submitted = st.form_submit_button("Save")

if submitted:
    st.write({"website": website, "phone": phone})
```

**Search box:**

```python
import streamlit as st

query = st.text_input("Search products", type="search")
results = search(query) if query else []
st.write(results)
```

**Overriding the defaults** (type sets the keyboard + autofill; the rest is custom):

```python
import streamlit as st

# Keep email semantics but use a custom icon, placeholder, and message
email = st.text_input(
    "Work email",
    type="email",
    icon=":material/work:",
    placeholder="name@company.com",
    validate=(r"^[\w.+-]+@company\.com$", "Use your @company.com address."),
)
```

### Edge cases

- **Backward compatibility:** existing `type="default"` / `type="password"` behavior is byte-for-byte
  unchanged. Passing an unknown string still raises `StreamlitAPIException` listing the valid types
  (principle 23, "Fail Fast, Fail Helpfully").
- **`type="password"` defaults:** unchanged — no icon, no default validation, `autocomplete`
  remains `"new-password"`. We do not retrofit password defaults in this spec.
- **Native vs. Streamlit validation:** the native HTML `type` (e.g. `email`) can trigger the
  browser's own `:invalid` state. Error *display* comes entirely from the `validate` regex
  mechanism (Streamlit forms don't perform native form submits), so the frontend suppresses the
  browser's native constraint-validation styling to avoid double error UI. The user sees exactly one
  error treatment.
- **Search clear button:** the `search` type shows a clear ("×") button while the field holds a
  value; clicking it empties the field and commits the change. The browser's native search-clear
  control is hidden and replaced with a Streamlit-styled button (reusing the clear-button styling
  from other input widgets) so it matches the rest of the UI.
- **Empty values:** consistent with the shipped `validate` feature, empty strings / `None` skip
  validation, so an optional `type="email"` field doesn't error until the user types something.
- **`bind="query-params"`:** allowed for `email`, `url`, `phone`, and `search` (only `password` is
  blocked, unchanged). The `search` type pairs naturally with query-param binding for shareable
  search URLs.
- **Relationship to the merged `validate` feature:** the client-side regex `validate` parameter has
  now shipped ([#15714](https://github.com/streamlit/streamlit/pull/15714)), so the email/url default
  validation is implemented as a regex default value. Users turn a type's default validation *off*
  with `validate=""` (see
  [opt-out decision](#decision-use-the-type-default-vs-no-value)).

### Out of scope (future work)

- **Other HTML input types** (`number`, `date`, `time`, `color`, `file`, `range`, ...): excluded for
  the reasons in [Why only these types?](#why-only-these-types) — they belong to dedicated widgets
  (principle 20, "One Use Case, One Command").
- **`type="otp"` for one-time codes:** appealing but not an HTML input type — it would map to
  `type="text"` + `autocomplete="one-time-code"` + `inputmode="numeric"`. Worth considering as a
  follow-up if there's demand, since it doesn't fit the "native type" mental model of this spec.
- **General `enterKeyHint` / custom mobile keyboard hints:** beyond an optional `enterKeyHint="search"`
  for `type="search"`, setting or exposing `enterKeyHint` should align with Streamlit's Enter-to-submit
  behavior (see [Mobile keyboard hints](#mobile-keyboard-hints-inputmode-and-enterkeyhint)) rather than
  the input type, so it's deferred.
- **Default `placeholder` values:** lowest-confidence default; we may ship types + icon + validation
  + autocomplete first and add placeholder defaults later based on feedback.
- **`st.text_area` / `st.column_config.TextColumn` types:** the multi-line and table-cell variants
  could gain a subset (e.g. `url`, `email`) later; not in this spec.
- **Per-type prefix/suffix adornments** (e.g. `https://` prefix), as offered by the community extra
  — separate, larger feature.
- **Locale-aware phone validation/formatting**, plus `required`, `multiple`, and raw HTML attributes
  (`pattern`, `minlength`): out of scope. Empty values keep bypassing validation (per the `validate`
  spec); all types continue to return `str | None`.
- **Server-side enforcement of the default validation:** the type-derived email/url validation is
  client-side only (like the underlying `validate` feature) and can be bypassed. Enforcing it — and
  other client-side widget constraints — on the server is tracked separately in
  [#16203](https://github.com/streamlit/streamlit/issues/16203); until it lands, security-relevant
  checks must live in the user's own app code.

## References

- [Issue #6704](https://github.com/streamlit/streamlit/issues/6704) — original request.
- [Text input validation spec](../2025-12-03-text-input-validation/product-spec.md) — the `validate`
  feature this builds on. Its client-side regex half shipped in
  [#15714](https://github.com/streamlit/streamlit/pull/15714) (server-side callables deferred).
- [Issue #16203](https://github.com/streamlit/streamlit/issues/16203) — server-side validation of
  client-side widget constraints; the tracking issue for enforcing the default email/url validation
  (and other client-side constraints) on the server.
- [MDN: HTML5 input types](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/HTML5_input_types)
  and the [WHATWG `input` element](https://html.spec.whatwg.org/multipage/input.html).
- [React Aria `TextField`](https://react-aria.adobe.com/TextField) — the underlying component; its
  `Input` forwards `type`, `inputMode`, and `enterKeyHint` as standard DOM props.
- [MDN: `inputmode`](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inputmode)
  and [MDN: `enterkeyhint`](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/enterkeyhint).

## Checklist

| Item                         | ✅ or comment          |
|------------------------------|------------------------|
| Works on SiS, Cloud, etc?    | ✅ Pure frontend rendering + existing widget plumbing |
| No breaking API changes      | ✅ Additive `type` values; existing values unchanged |
| No new dependencies          | ✅                      |
| Metrics collected            | `gather_metrics("text_input")` records that `type` is passed but not its literal value (string args log only `len:`); capturing per-type adoption needs explicit value tracking added during implementation |
| Any security/legal impact?   | The default email/url validation is **client-side regex** (via the now-merged `validate` feature, [#15714](https://github.com/streamlit/streamlit/pull/15714)) and can be bypassed. Server-side enforcement of client-side constraints (including this validation) is a deferred follow-up tracked in [#16203](https://github.com/streamlit/streamlit/issues/16203), so no default should be treated as a security boundary — security-relevant checks must be performed in the user's own app code on the server after submit (matching the `validate` docstring's own note) |
| Any docs changes needed?     | Yes — document the new `type` values and their smart defaults in the `st.text_input` reference |
