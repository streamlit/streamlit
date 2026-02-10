# Streamlit specs

This directory contains product and tech specs for Streamlit. Only for internal use so
far!

## When to write a spec?

Not every change requires a spec. Things that don't require a spec:

- Non‑user‑facing features
- Bug fixes
- DevOps‑related improvements
- Small, non‑controversial user‑facing enhancements

## How to create a spec?

1. Copy `specs/YYYY-MM-DD-template/` to a new folder named `specs/YYYY-MM-DD-my-feature-name/`
   (use the current date), e.g., `specs/2026-02-05-datetime-widget/`.
2. Fill in the [`product-spec.md`](./YYYY-MM-DD-template/product-spec.md) inside it.
3. Create a PR with the following details:
   - PR title: `[spec] My feature name`, e.g., `[spec] Datetime widget`
   - Keep the PR in Draft until it’s ready for discussion
4. When ready, mark the PR "Ready for review" on GitHub. All discussion on the spec
   should happen on the PR.
5. Merging requires at least two approvals from core maintainers.
   - If approved: Maintainers will add the `change:spec` label, merge the PR, and link
     the spec in related issues. The spec is considered ready for implementation.
   - If rejected: The PR is closed with an explanation.
