# Streamlit Spec Writing Principles

This document outlines best practices for writing product specifications for Streamlit features. These principles are derived from analyzing successful specs and ensuring consistency across feature development.

**Related documents:**

- [Product Guidelines](./product-guidelines.md) — High-level product philosophy
- [API Design Principles](./streamlit-api-principles.md) — Detailed principles for API design

**When to use this document:**

- Writing a new product spec
- Reviewing someone else's spec
- Learning how Streamlit approaches feature development
- Looking for examples of good spec patterns

---

## The 20 Principles of Spec Writing

### 1. **Problem First, Solution Second**

Never start with what you want to build. Start with why. Articulate the user pain point, show real examples, link to GitHub issues with upvote counts, and describe current workarounds. If you can't clearly explain the problem, you're not ready to spec a solution.

### 2. **Quantify Everything**

Numbers build conviction. Include: GitHub issue upvotes, current workaround adoption (search GitHub for patterns like `st.write("")`), related feature usage (e.g., "st.columns is used in 48% of apps"), and projected adoption for the new feature. Even rough estimates help prioritize.

### 3. **Show, Don't Tell**

Include screenshots, prototypes, example apps, and code snippets. A picture of the Core Metrics app using sparklines says more than paragraphs of description. Link to PRs with working prototypes when possible.

### 4. **Present Options, Not Edicts**

Good specs present 2-3 API options with clear tradeoffs. Mark your preferred option, but let reviewers see alternatives. Document why options were rejected—future readers will wonder why you didn't do it "the obvious way."

### 5. **Code Speaks Louder Than Words**

Every API proposal needs concrete code examples. Show the simplest usage, then progressive complexity. If you can't write example code that looks clean, the API design needs more work.

### 6. **Consistency Is a Feature**

Reference existing Streamlit patterns obsessively. If `st.file_uploader` has `accept_multiple_files`, your new parameter should be `accept_new_options`, not `allow_custom`. Cross-reference similar commands and explain why yours matches (or deliberately differs).

### 7. **Anticipate Edge Cases**

Good specs address: What happens with empty input? What if parameters conflict? How does this work in forms? What about session state? Document decisions for edge cases explicitly—they become the source of truth during implementation.

### 8. **Get Engineering Reality Checks**

Include eng estimates (in weeks) with confidence levels. Note technical complexities: "This requires changing protobuf serialization" or "Same pattern as X, should be straightforward." Specs without engineering input often propose impossible or expensive solutions.

### 9. **Cross-Functional Completeness**

Every spec needs a checklist: Platform parity (Cloud, SiS, Notebooks)? Metrics collection? Security/legal review? Docs requirements? Marketing potential? QA testing needs? A feature isn't done until all cross-functional needs are addressed.

### 10. **Capture the Conversation**

Document reviewer feedback with timestamps and names. Show how feedback changed the spec. Future readers need to understand not just what was decided, but why. Rejected ideas are as valuable as accepted ones.

### 11. **Start Minimal, Plan for Growth**

Propose the smallest useful API first. Document what you're explicitly NOT including and why. "We could add `sparkline_type` later" is better than shipping unnecessary complexity. Extension points matter.

### 12. **Design for Discoverability**

Consider how users will find this feature. A new `st.badge` command is more discoverable than a Markdown syntax like `:blue-badge[...]`. But sometimes both make sense—document the discoverability tradeoff explicitly.

### 13. **Separate "Eventually" from "Now"**

Good specs have two sections: "What we should have eventually" (the vision) and "What we should implement right now" (minimal scope). The theme API spec proposes exposing type+parameters in CSS/JS/Python eventually, but ships just `st.context.theme.type` now. This prevents scope creep while documenting the north star.

### 14. **Document Platform-Specific Behavior**

Every feature behaves differently across platforms. Create a platform matrix: local dev, Community Cloud, SiS, notebooks, mobile, embedded iframes. The file uploader's `webkitdirectory` doesn't work on mobile—document that. `st.context.ip_address` returns `None` on SiS—document that too.

### 15. **Anticipate the Deprecation Question**

Before proposing a new parameter, ask: "Will this deprecate anything?" Deprecations in 9% of apps (like `accept_multiple_files`) are painful. The file uploader spec explicitly chose Option 2 over Option 3 to avoid deprecation. Document this tradeoff for reviewers.

### 16. **Include Prototype Links**

Link to working prototypes wherever possible: demo apps (`https://predefined-formats-for-dataframe.streamlit.app`), PR branches, video demos. Specs with prototypes get approved faster because reviewers can experience the feature, not just imagine it.

### 17. **Define Explicit Out-of-Scope**

List what you're NOT building and why. The image cards spec explicitly excludes clickable cards ("only 3 upvotes"), background color ("complications with chart backgrounds"), and image height parameter ("adds cropping complexity"). This prevents scope creep and answers "why didn't you..."

### 18. **Consider Mobile Explicitly**

Mobile is often an afterthought but affects API design. The top navigation spec defaults to sidebar nav on mobile. The file uploader falls back to multi-file selection on mobile since `webkitdirectory` isn't supported. Document mobile behavior as a first-class concern.

### 19. **Note "Clever vs Clear" Tradeoffs**

When an API option is elegant but potentially confusing, call it out. The `key="?foo"` syntax for query param binding is clever but "might be too clever" (direct quote from feedback). Reviewers appreciate honest assessment of discoverability vs. elegance.

### 20. **Link to Existing Internal Implementation**

If code already exists (even hardcoded or internal), mention it. The non-dismissible dialog spec notes "this parameter is already implemented, just not exposed"—changing a 0.5-week estimate. The bottom container spec notes "`st._bottom` already exists." This context helps engineers estimate accurately.

---

## Spec Structure Template

A well-structured spec follows this outline:

### Header

```
Status: Draft | In Review | Done
Type: Product spec
Author: [Name]
Related projects: [Links]
```

### Reviewers Table

List required reviewers with columns for:

- Problem approval (✅/🙂/❌)
- Solution approval (✅/🙂/❌)
- Implementation approval (✅/🙂/❌/🙈)

### Summary

One sentence: what are we building?

### Problem Statement

- User pain points with concrete examples
- GitHub issues with upvote counts
- Current workarounds and their limitations
- Related user research or interviews

### Metrics Impact

- Current adoption of related features
- Projected adoption of new feature
- How this moves key metrics

### Proposed Solution

#### API

```python
# Full function signature with types
st.new_feature(
    required_param: str,
    *,  # keyword-only after this
    optional_param: str = "default",
)
```

#### Parameter Table

| Parameter | Type | Description |
|-----------|------|-------------|
| required_param | str | What this does |

#### Behavior

- What happens when the user interacts
- Edge cases and their resolution
- Integration with existing features

#### Design

- Visual mockups or screenshots
- UI/UX considerations
- Accessibility notes

#### Naming Alternatives

- List alternative names considered
- Explain why the chosen name won

#### API Options (if multiple)

**Option 1: [Name]** ✅ PREFERRED

- Pros and cons
- Code example

**Option 2: [Name]**

- Pros and cons
- Code example

### Cross-Functional Checklist

| Item | Status |
|------|--------|
| Platform parity (Cloud, SiS, Notebooks) | ✅ or notes |
| Metrics collected | ✅ or notes |
| Security and legal review | ✅ or notes |
| Docs requirements | ✅ or notes |
| Marketing potential | ✅ or notes |

### Engineering Estimate

| Engineer | Estimate | Notes |
|----------|----------|-------|
| @Name | X weeks | Confidence level and dependencies |

### Implementation

(Filled in after development)

- Wheel file link
- Demo app link
- PR links

### Feedback

Chronological list of reviewer feedback with:

- Reviewer name and date
- Their comments
- Author's response (if any)

---

## API Design Questions to Answer

When speccing a new API, explicitly address these questions:

### Naming

- [ ] Does the command name follow existing patterns? (noun for display, `_input` suffix for input widgets, verb for actions)
- [ ] Does the parameter name match existing vocabulary? (`label` not `title`, `value` not `default`)
- [ ] Are literal values lowercase? (`"primary"` not `"Primary"`)

### Signature

- [ ] Is the first parameter the primary data/content?
- [ ] Which parameters can be positional vs must be keyword-only?
- [ ] What are sensible defaults that work for 80% of cases?
- [ ] Does the parameter order match similar existing commands?

### Return Type

- [ ] What type does this return?
- [ ] When would it return `None`?
- [ ] Does the return type depend on input parameters? (May need `@overload`)

### Behavior

- [ ] What happens with empty/null input?
- [ ] How does this interact with session state?
- [ ] Does this work inside forms? Containers? Sidebar?
- [ ] What errors can occur and what do they say?

### Consistency

- [ ] Which existing command is this most similar to?
- [ ] What would a user expect based on learning that command?
- [ ] If this differs from the pattern, why?

---

## Common Spec Mistakes

### ❌ Solution-First Thinking

Bad: "Let's add `st.badge` because badges are cool."

Good: "Users building status dashboards are using complex Markdown hacks to create badges. GitHub has 45 upvotes on this. Here's what the roadmap app does today..."

### ❌ Missing Alternatives

Bad: "We should add `shortcut` parameter to buttons."

Good: "We could add shortcuts to buttons (Option 1), all focusable widgets (Option 2), or provide a general keyboard event system (Option 3). Option 1 is preferred because..."

### ❌ Vague Behavior

Bad: "The sparkline should look nice."

Good: "The sparkline uses the same Altair rendering as st.line_chart. Tooltip shows value on hover. Color matches delta color. Chart stretches to container width."

### ❌ Ignoring Existing Patterns

Bad: "New parameter: `allow_user_input=True`"

Good: "New parameter: `accept_new_options=True` (matches `accept_multiple_files` pattern in `st.file_uploader`)"

### ❌ Over-Engineering V1

Bad: "We'll add `sparkline`, `sparkline_type`, `sparkline_color`, `sparkline_min`, `sparkline_max` all in V1."

Good: "V1 adds `sparkline` parameter. Future versions could add `sparkline_type` for bar/area variants. Keeping V1 minimal to ship faster and learn from usage."

---

## Spec Review Checklist

Before requesting review, verify:

- [ ] Problem statement has concrete user examples
- [ ] GitHub issues are linked with upvote counts
- [ ] Metrics impact is quantified
- [ ] API shows full function signature with types
- [ ] At least one code example for simple usage
- [ ] Naming alternatives were considered
- [ ] Existing patterns are referenced
- [ ] Edge cases are documented
- [ ] Cross-functional checklist is complete
- [ ] Engineering estimate is included

---

## Linking Specs to Implementation

### Before Implementation

- Spec has all required approvals
- Engineering estimate is finalized
- Design assets are available
- Cross-functional needs are scheduled

### During Implementation

- Link PRs back to spec
- Update spec with implementation decisions that differed
- Add wheel file and demo app links

### After Launch

- Update spec status to "Done"
- Add actual vs estimated time
- Note any deferred items for future work

---

## Real Spec Patterns (from Streamlit specs)

### Pattern: Extending Existing Parameters

**The file uploader directory upload spec** shows how to extend an existing parameter rather than adding new ones:

```python
# Option 1: New parameter (requires handling conflicts)
accept_directory: bool = False
# Problem: What if both accept_multiple_files=True and accept_directory=True?

# Option 2: Extend existing parameter ✅ CHOSEN
accept_multiple_files: bool | Literal["directory"] = False
# Why: No conflict, no deprecation, conceptually similar (directory = multiple files)
```

### Pattern: API Options Matrix

**The query params binding spec** evaluated 4 options systematically:

| Option | API | Pros | Cons |
|--------|-----|------|------|
| 1 | `st.query_params.bind("key")` | Generic, works for any session state | Verbose for many widgets |
| 2 | `query_key="foo"` param | Explicit, clear | New param on every widget |
| 3 | `key="?foo"` | Elegant, no new params | Hard to discover, "too clever" |
| 4 | `expose_as_query_param=True` | Explicit | Boolean doesn't let you name the param |

**Winner**: Option 3 for simplicity, with acknowledgment of discoverability concerns.

### Pattern: Behavioral Edge Cases

**The non-dismissible dialog spec** documented this edge case explicitly:

> "One caveat is that users can still get rid of the dialog by pressing `R` to rerun the app. That's a potential problem... but in practice, this is a pretty unlikely scenario and you'd need to write pretty bad/unrealistic code to run into this situation."

Then showed the problematic code example and concluded: "Put a callout in the docstring and don't worry too much."

### Pattern: Return Type Consistency

**The file uploader spec** maintained return type consistency:

> "If uploading a directory is enabled, the return type should always be a list of `UploadedFile` objects, just like if `accept_multiple_files=True`."

Not a new `DirectoryUpload` type or nested dict—same type, same mental model.

### Pattern: Behavior on Unsupported Platforms

**The file uploader spec** defined graceful degradation:

> "On mobile, selecting a directory is not supported. In that case, we should fall back to a normal file upload but let the user pick multiple files."

Not an error. Not disabled. A sensible fallback.

### Pattern: Future Extensibility Without Commitment

**The image cards spec** noted future possibilities without committing:

> "**Out of scope:**
>
> - Image height: Maybe we need `image_height` (especially for different card sizes)? Leave out for now, can add later.
> - Clickable cards: Can add in the future, only 3 upvotes.
> - Background color: Complications with chart backgrounds, do later."

### Pattern: Design Decisions with Rationale

**The floating action button spec** documented naming alternatives:

| Option | Problem |
|--------|---------|
| `st.floating_action_button` | Verbose |
| `st.fab` | Not obvious |
| `st.float_button` | Could be confused with float datatype |
| `st.floating_button` ✅ | Clear, standard term |

---

## Anti-Patterns to Avoid

### ❌ Assuming Platform Uniformity

Bad: "This will work everywhere."

Good: "This requires browser APIs. On SiS, returns `None`. On mobile, falls back to X. In notebooks, Y. Document: works on Cloud, SiS limited, Notebooks untested."

### ❌ Ignoring Feedback Loops

Bad: Spec with no feedback section.

Good: Named feedback with timestamps, author responses, and indication of whether feedback was incorporated or rejected (with reason).

### ❌ Proposing Breaking Changes Casually

Bad: "We'll rename `accept_multiple_files` to `accept` and deprecate the old param."

Good: "Option 3 would deprecate `accept_multiple_files` (used in 9% of apps). With LLM coding taking a bigger role, we want to avoid deprecations. Prefer Option 2."

### ❌ Missing the "Why Not" Section

Bad: Only showing the chosen API.

Good: "We considered `st.container(header_image='...')` but image cards are common enough to warrant their own discoverable command."

### ❌ Vague Platform Support

Bad: "Works on Cloud."

Good:

| Platform | Support |
|----------|---------|
| Local | ✅ Full |
| Cloud | ✅ Full |
| SiS | ⚠️ Returns None |
| Notebooks | ✅ Full |
| Mobile | ⚠️ Fallback mode |
| Embedded | ✅ Respects embed_options |
