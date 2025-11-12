# Streamlit Enhancement Proposals (STEP)

This directory contains Streamlit Enhancement Proposals (STEP). STEPs are documents that describe a new feature or enhancement to Streamlit.

## When to write a STEP?

Not every change requires a STEP. However, having an approved STEP increases the likelihood that an enhancement PR gets merged. Changes that might not require a STEP (case by case):

- Non‑user‑facing features
- Bug fixes
- DevOps‑related improvements
- Small, non‑controversial user‑facing enhancements

## How to propose a STEP?

1. Create a PR that copies the `specs/0000-template/` directory to a new folder named `specs/0000-<kebab-case-slug>/`, then fill in the [`product-spec.md`](./0000-template/product-spec.md) inside it.
   - PR title: `[STEP] <short, Title Case name>`, e.g., `[STEP] Datetime widget`
   - Directory name: `0000-<kebab-case-slug>`, e.g., `0000-datetime-widget`. We will assign and rename to the correct number before merging.
   - Keep the PR in Draft until it’s ready for discussion.
2. When ready, mark the PR “Ready for review” on GitHub. The PR thread is the canonical place for discussion.
3. Approval requires at least two approvals from core maintainers.
   - If approved: Maintainers will assign the final number, rename the directory, update the Status to Approved, merge the STEP PR and link the STEP document in related issues.
   - If rejected: The PR is closed with an explanation.
   - Note: The PR might stay open for a while, e.g. if the feature depends on other enhancements.

## STEP Lifecycle

- **Draft**: PR is in draft. Authoring and early feedback.
- **Review**: PR is marked ready for review. Open for broad feedback and discussion in the PR.
- **Approved**: Approved by core maintainers and merged. Ready for implementation.
- **Implemented**: The enhancement got implemented and merged.
- **Rejected:** PR was closed with rationale.
- **Deprecated:** Previously approved STEP got deprecated and is no longer relevant.
