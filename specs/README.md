# Streamlit specs

This directory contains product and tech specs for Streamlit. Only for internal use so
far!

## When to write a spec?

Not every change requires a spec. Things that don't require a spec:

- Bug fixes
- DevOps‑related improvements
- Small, non‑controversial user‑facing enhancements

Write a **product spec** when:

- Proposing a new user‑facing feature or significant API change
- The _what_ and _why_ need alignment before implementation begins
- Design mockups or UX decisions need sign‑off

Write a **tech spec** when:

- The feature is non‑user‑facing but architecturally significant
- The _how_ needs alignment before implementation begins (e.g. proto design, state
  management approach, frontend/backend split)
- Multiple implementation paths exist with meaningful trade‑offs to document

A single spec directory can contain both a `product-spec.md` and a `tech-spec.md` if the
feature warrants both.

## Product spec vs. tech spec

- **`product-spec.md`** — focuses on _what_ and _why_: user-facing problem, proposed API,
  design mockups, and behaviour.
- **`tech-spec.md`** — focuses on _how_: internal architecture, proto changes, frontend/backend
  design, state management, and alternatives considered.

Both formats share the same directory naming convention and PR process.

## How to create a spec?

1. Copy `specs/YYYY-MM-DD-template/` to a new folder named `specs/YYYY-MM-DD-my-feature-name/`
   (use the current date), e.g., `specs/2026-02-05-datetime-widget/`.
2. Fill in either [`product-spec.md`](./YYYY-MM-DD-template/product-spec.md) or
   [`tech-spec.md`](./YYYY-MM-DD-template/tech-spec.md) inside it.
3. Create a PR with the following details:
   - PR title: `[spec] My feature name`, e.g., `[spec] Datetime widget`
   - Keep the PR in Draft until it’s ready for discussion
4. When ready, mark the PR "Ready for review" on GitHub. All discussion on the spec
   should happen on the PR.
5. Merging requires at least two approvals from core maintainers.
   - If approved: Maintainers will add the `change:spec` label, merge the PR, and link
     the spec in related issues. The spec is considered ready for implementation.
   - If rejected: The PR is closed with an explanation.
