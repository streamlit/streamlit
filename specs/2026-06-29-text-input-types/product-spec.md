---
author: lukasmasuch
created: 2026-06-29
---

# Specialized input types for `st.text_input`

## Summary

Extend the `type` parameter of `st.text_input` beyond `"default"` and `"password"` to support
common semantic HTML input types: `"email"`, `"url"`, `"tel"`, and `"search"`. Choosing a
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
  `st.text_input` (addressed by the companion `validate` spec).
- The community `streamlit-extras` "Specialized Inputs" extra (email, URL, phone, handles) exists as
  a workaround, signaling real demand.

**Use cases:**

- Email / URL fields in contact, signup, and settings forms with instant format feedback.
- Phone number fields that bring up the numeric keypad on mobile.
- Search boxes with the native "clear" affordance and search-optimized keyboard.
- Forms that want browser autofill (email, tel, url) to work correctly.

**Consistency gap:**

This builds directly on the `validate` parameter from
[`specs/2025-12-03-text-input-validation`](../2025-12-03-text-input-validation/product-spec.md)
(the spec is merged; the feature isn't implemented yet). That spec already lists #6704 as
motivation; specialized types are the ergonomic "front door" that makes common validations a
one-liner.

## Proposal

### API

Extend the existing `type` parameter (no new parameters):

```python
st.text_input(
    label,
    ...,
    type: Literal["default", "password", "email", "url", "tel", "search"] = "default",  # EXTENDED
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
| `"tel"` | `tel` | Phone numbers (numeric keypad on mobile). |
| `"search"` | `search` | Free-text search, with the browser's native clear button. |

Each specialized type:

1. **Sets the native HTML `type`** on the underlying `<input>`. This gives users the matching mobile
   keyboard (e.g. `@`/`.com` keys for email, the numeric keypad for tel) and lets browser autofill
   recognize the field — for free, with zero config.
2. **Applies overridable defaults** for `icon`, `placeholder`, `validate`, and `autocomplete` (see
   below).

#### Naming `tel` vs `phone`

The issue says "phone", but the value maps to HTML's `type="tel"`. This is the single most
contentious decision in the spec, and it's a genuine toss-up — whichever we pick, we render
`<input type="tel">` and ship only one public name.

**Option A — `"tel"`** ✅ PREFERRED (slight)
- Pros: Matches the HTML standard exactly (principle 5, "Consistency Over Novelty"); mirrors
  `"email"`/`"url"`/`"search"`, which all match HTML 1:1 — using one "friendly" name among four
  standard ones is itself inconsistent. Notably, the API-design guide's own example for this exact
  pattern reaches for `st.text_input("Phone", type="tel")` (principle 16), a small signal that
  maintainers find `tel` natural here.
- Cons: A mild abbreviation; less obvious to non-web developers (principle 8 favors semantic names).

**Option B — `"phone"`**
- Pros: More human-readable for typical users (principle 8, "Semantic Names Over Geeky Names"); the
  label most app authors would reach for. This is what the alternative (codex) draft of this spec
  recommends.
- Cons: Diverges from the underlying HTML attribute and from the other three values.

We lean to **`"tel"`** for internal consistency, but `"phone"` is a fully defensible choice and the
better fit for principle 8 — flagging this explicitly for reviewer sign-off rather than treating it
as settled.

#### Why only these types?

We intentionally limit the set to single-line textual values that still return `str | None` and fit
the `st.text_input` mental model. Everything else either duplicates a dedicated widget or doesn't fit:

| HTML input type | Decision | Reason |
|-----------------|----------|--------|
| `text` | Already covered | `"default"`. |
| `tel` | Exposed as `"tel"`/`"phone"` | See naming above. |
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
don't auto-derive it from `type` in the MVP. The one low-risk, type-aligned tweak we may include is
`enterKeyHint="search"` for `type="search"`. General `enterKeyHint` control belongs with Streamlit's
existing Enter-to-submit logic and is deferred (see [Out of scope](#out-of-scope-future-work)).

### Smart defaults

When a specialized type is selected and the user hasn't supplied a value for `icon`,
`placeholder`, `validate`, or `autocomplete`, the type fills in a sensible default. Any explicit
value the user passes overrides that default — how an *omitted* argument, `None`, and an empty
value (`""`) are distinguished (use-the-default vs. opt-out) is the subject of
[Decision: "use the type default" vs. "no value"](#decision-use-the-type-default-vs-no-value)
below.

| `type` | Default `icon` | Default validation | Default `placeholder` | Default `autocomplete` |
|--------|----------------|--------------------|-----------------------|------------------------|
| `"email"` | `:material/mail:` | Email format | `you@example.com` | `email` |
| `"url"` | `:material/link:` | URL format | `https://example.com` | `url` |
| `"tel"` | `:material/call:` | — (none; phone formats vary too widely) | `+1 234 567 8900` | `tel` |
| `"search"` | `:material/search:` | — (none) | `Search` | `off` |

Notes:

- **Icons** are illustrative; final glyphs are a design decision (e.g. `:material/alternate_email:`
  (the "@" icon) is a strong alternative for email).
- **Validation** is applied only for `email` and `url`, where a single widely-accepted notion of
  validity exists. We deliberately **do not** default-validate `tel` (no universal phone format) or
  `search` (free text). It reuses the companion `validate` feature's frontend error UI and
  submit-blocking behavior (instant, pre-rerun feedback; error on blur/Enter/submit; empty values
  skip validation). The *source* of the email/url check is a design decision — see
  [Validation source](#validation-source-native-validity-vs-regex) below.
- **`placeholder`** examples are intentionally conservative format hints. This is the most debatable
  default (see Out of scope); it can be dropped without affecting the rest. The `tel` example above
  is US-formatted and illustrative only — final values (including a locale-neutral phone format) are
  part of the deferred placeholder-default decision.
- **`autocomplete`** maps to the standard HTML autocomplete tokens so browser autofill works. This
  extends the existing behavior where `type="password"` already defaults `autocomplete` to
  `"new-password"`. `search` defaults to `"off"` so private search terms don't leak into the
  browser's shared autofill history; pass `autocomplete=""` if you prefer plain-text behavior.

#### Validation source: native validity vs. regex

For `email`/`url`, there are two ways to implement the default check. This affects how it composes
with a user-supplied `validate`, so it's worth deciding deliberately:

**Option A — Streamlit-maintained regex** ✅ PREFERRED
- The type default is literally a `validate=(EMAIL_REGEX, "...")` value, reusing the `validate`
  channel end-to-end.
- Pros: one validation channel; the effective rule is inspectable and overridable like any other
  `validate`; nothing new to build on the frontend; stricter than the browser (can require a dotted
  domain).
- Cons: Streamlit owns and must maintain the regexes, which are famously easy to get subtly wrong
  (over-strict regexes reject valid addresses; over-loose ones admit junk). The exact regexes are an
  implementation detail to finalize during build.

**Option B — Browser-native validity** (the codex draft's recommendation)
- Use the browser's `ValidityState.typeMismatch` on the native `<input type="email"/"url">`, surfaced
  through the same error UI.
- Pros: zero regex maintenance; exactly matches native `type` semantics and stays correct as
  browsers evolve.
- Cons: requires a *second* validation channel in the frontend (the `validate` feature only knows
  regex/callable), and native email validity is lenient (e.g. `a@b` passes — no TLD required), which
  can surprise developers expecting "real" email validation.

**Composition with user `validate`** — the two options imply different behavior, so we should pick
consciously:
- With Option A, a user-supplied `validate` *replaces* the type default (single channel; the user's
  rule must be a complete check). Simpler mental model.
- With Option B, the native type check and the user's `validate` *layer*: native format runs first,
  then the user rule adds app-specific constraints (e.g. a corporate domain) without re-stating the
  base format. More ergonomic, but it's a two-stage model users must understand.

We recommend **Option A** for MVP: it keeps a single, inspectable validation channel and ships as a
pure default value the moment `validate` lands. If reviewers prefer to avoid maintaining regexes, the
native-validity + layering model (Option B) is a clean alternative — just a larger frontend change.

#### Default precedence

For each enhanced property, the resolved value is: **user value → type default → existing default**.
A real user value always wins; otherwise the type default (from the table) applies; `"default"` and
`"password"` define no enhanced defaults, so they're unchanged.

The one genuinely open design question — and worth a deliberate decision — is the next subsection.

#### Decision: "use the type default" vs. "no value"

When a type defines a default (e.g. `email` → mail icon), a user needs three distinct intents per
parameter: **(1)** use the type's default, **(2)** use my explicit value, **(3)** force it *off*
(keep `type="email"` for the keyboard/autofill, but no icon / no auto-validation). The hard part is
distinguishing (1) from (3), since neither is a "real" value. Three ways to encode this:

**Option A — Internal sentinel (`_UNSET`)**
- Param default becomes an internal `_UNSET`; **omission → type default**, explicit **`None` → off**,
  any value → use it.
- Pros: `None` keeps its conventional Streamlit meaning ("none of this"); one uniform rule across all
  params; `validate=None` to disable reads perfectly.
- Cons: makes `text_input(...)` and `text_input(..., icon=None)` behave *differently*, which is
  surprising in Python where callers treat omission and `=None` as equivalent (borderline "clever but
  too clever", principle 35); needs sentinel plumbing; not an established pattern in our public API.

**Option B — `None` = use default, `""` (empty) = off** ✅ leaning
- **`None` (or omission) → type default**; an **empty value (`icon=""`, `placeholder=""`,
  `validate=""`) → off**; any real value → use it.
- Pros: this is **exactly how `text_input.autocomplete` already works today** —
  `autocomplete=None` derives from the type (`"new-password"` for password) and `autocomplete=""`
  opts out. Generalizing that single existing rule to `icon`/`placeholder`/`validate` is the most
  consistent choice and removes the omit-vs-`None` trap (`None` ≡ omission). For `placeholder`, `""`
  already renders as "no placeholder" today, so it's zero surprise. Backward compatible (plain
  `default`/`password` inputs have no type default, so `None` still means "nothing").
- Cons: `""` is less self-documenting as "off" than `None`; and for `validate` an empty string isn't a
  natural rule — we'd define `validate==""` to mean "disabled" explicitly in the backend (rather than
  "a regex that matches everything"), and document it. **Crucially, this collides with the merged
  validation spec, which already defines `validate=None` as *no validation*.** Option B would have to
  redefine `validate=None` as "use the type default" — reversing an already-specced meaning — which is
  exactly why the `autocomplete` precedent doesn't transfer cleanly to `validate`: `autocomplete=None`
  means "derive", but `validate=None` already means "off". So `validate` is the one param where Option
  B fights an existing definition. Minor: `icon=""` currently raises, so we'd map it to "no icon"
  before validation.

**Option C — `None` = use default, no opt-out**
- Simplest, but you can't remove a type's icon or auto-validation. Rejected — don't ship
  type-derived defaults users can't turn off.

**Recommendation: Option B.** It extends the rule `text_input` *already* uses for `autocomplete`
(`None` = derive, `""` = off) to the other type-derived params instead of inventing a new mechanism,
and it avoids the surprising "omission ≠ `None`" behavior of the sentinel. The main rough edge is
`validate`: the merged validation spec already defines `validate=None` as "no validation", so Option
B would have to flip that to "use the type default" and use `validate=""` for "off" — a redefinition
reviewers may dislike. If so, **Option A (sentinel)** is the clean fallback, and notably it keeps
`validate=None` meaning "off" (consistent with the validation spec), at the cost of the omit-vs-`None`
subtlety. (My previous draft leaned sentinel; the `autocomplete` precedent changed my mind — but with
this `validate` collision it is genuinely a coin-flip, so I'm flagging it for sign-off.)

Either way, the **guiding principle holds**: never ship a type-derived default that users can't turn
off. If neither opt-out mechanism is in scope for the MVP, ship only the non-visual defaults (native
type, `autocomplete`, validation) first and add `icon`/`placeholder` defaults once opt-out exists.

### Examples

**Email with zero config** (icon, placeholder, and validation all automatic):

```python
import streamlit as st

email = st.text_input("Email", type="email")
if email:
    st.success(f"We'll reach you at {email}")
```

**URL and phone in a form:**

```python
import streamlit as st

with st.form("contact"):
    website = st.text_input("Website", type="url")
    phone = st.text_input("Phone", type="tel")
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
  browser's own `:invalid` state. Under Option A (regex), Streamlit forms don't perform native form
  submits, so error *display* comes entirely from the `validate` mechanism and we must suppress the
  native constraint-validation styling to avoid double error UI. Under Option B, native validity *is*
  the source but is still surfaced through Streamlit's error UI. Either way, the user sees exactly one
  error treatment; the frontend suppresses the browser's native constraint-validation styling.
- **Empty values:** consistent with the `validate` spec, empty strings / `None` skip validation, so
  an optional `type="email"` field doesn't error until the user types something.
- **`bind="query-params"`:** allowed for `email`, `url`, `tel`, and `search` (only `password` is
  blocked, unchanged). The `search` type pairs naturally with query-param binding for shareable
  search URLs.
- **Shipping before `validate` lands:** the `validate` parameter is specced but not yet implemented.
  The type values, native HTML type, icon, placeholder, and autocomplete defaults can ship
  independently; the `validate` defaults (including any default email/url validation) are layered on
  only once `validate` is available — until then no default validation ships.

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

## Open questions

1. **`tel` vs `phone`** for the public value name (see [naming](#naming-tel-vs-phone)). Needs a
   reviewer decision.
2. **Validation source** for `email`/`url`: Streamlit-maintained regex (single channel, overridable)
   vs. browser-native validity (no regex maintenance, but lenient and a second channel). Recommended:
   regex; see [Validation source](#validation-source-native-validity-vs-regex).
3. **Opt-out encoding** for type-derived defaults (see
   [the decision section](#decision-use-the-type-default-vs-no-value)): `None` = derive + `""` = off
   (Option B, generalizes today's `autocomplete` behavior) vs. an internal sentinel (Option A).
   Recommended: Option B. Needs a reviewer call.
4. **`email` strictness**: accept lenient browser-style addresses (e.g. intranet `user@host`), or a
   stricter dotted-domain regex? Either way, custom `validate` covers app-specific rules.

## References

- [Issue #6704](https://github.com/streamlit/streamlit/issues/6704) — original request.
- [Text input validation spec](../2025-12-03-text-input-validation/product-spec.md) — the `validate`
  feature this builds on.
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
| Any security/legal impact?   | Client-side default validation can be bypassed, so security-relevant checks must use server-side `validate` callables (inherited from the `validate` spec). Default email/url validation only ships once `validate` is available, so there's no window where this guidance points to a missing feature |
| Any docs changes needed?     | Yes — document the new `type` values and their smart defaults in the `st.text_input` reference |
