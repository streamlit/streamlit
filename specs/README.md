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

1. Copy `specs/0000-template/` to a new folder named `specs/0001-my-feature-name/`,
   e.g., `specs/0001-datetime-widget/`.
2. Fill in the [`product-spec.md`](./0000-template/product-spec.md) inside it.
3. Create a PR with the following details:
   - PR title: `[spec] My feature name`, e.g., `[spec] Datetime widget`
   - Keep the PR in Draft until it’s ready for discussion
4. When ready, mark the PR "Ready for review" on GitHub. All discussion on the spec
   should happen on the PR.
5. Merging requires at least two approvals from core maintainers.
   - If approved: Maintainers will assign the final number, rename the directory, update the Status to Approved, add the `change:spec` label, merge the PR, and link the spec in related issues. The spec is considered ready for implementation.
   - If rejected: The PR is closed with an explanation.
