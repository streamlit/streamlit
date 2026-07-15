---
name: reviewing-pr-description
description: Evaluates a PR's title and description for readability — do they clearly and concisely convey what changed and why to a reviewer? Produces findings with concrete proposed rewrites; the caller decides whether to apply them or present them as feedback. Use when finalizing a PR or reviewing PR metadata. For code comments, docstrings, and naming, use reviewing-readability instead.
---

# Reviewing PR Description

Review a PR's **title and description** for readability: do they clearly and concisely tell a reviewer what changed and why? Focus on the prose — checking the *format* (title pattern, required template sections) is a secondary, lighter concern.

This skill only evaluates: it produces findings with concrete proposed rewrites and does **not** apply them. The caller decides whether to apply the rewrites or present them as feedback.

## Audience

The reader is a **reviewer or teammate skimming the PR to understand what changed and why**. They may not know the implementation context, and later readers will find this text via the commit log or changelog. The title and description should stand on their own.

## Principles

1. **Lead with the change and its purpose** — the first sentence should state what changed and why, not setup, process, or a description of the problem area.
2. **Explain intent, not mechanics** — say what the change enables or why it was made; don't narrate the diff step by step.
3. **Cut what the diff already shows** — omit routine, obvious changes (added tests, updated types, fixed lint). Call out only what's non-obvious or decision-worthy.
4. **Concise wins** — fewer, denser bullets beat many thin ones. If a bullet restates the title or another bullet, drop it.
5. **Explain non-obvious decisions** — deprecations, unit choices, fallback behavior, and trade-offs deserve a sentence on *why*.
6. **Avoid jargon without context** — spell out internal terms or acronyms a newcomer wouldn't know.
7. **Active voice; name the actor** — "Deprecates `use_container_width`" or "The server now rejects oversized uploads" reads more directly than passive or vague phrasing.
8. **The title stands alone** — it should convey the change on its own in a commit list or changelog, without the body.
9. **No meta-commentary** — cut "This PR...", "We have...", "I added..."; state what changed directly.

## Evaluation Process

1. **Gather** the PR title and description (`gh pr view <n> --json title,body`).
2. **For each, ask**:
   - Does the title convey the change on its own, or does it need the body to make sense?
   - Does the description lead with the main change and its purpose, or bury it under context/mechanics?
   - Does it explain *why* for non-obvious decisions, or only list *what*?
   - Is there jargon or an acronym a newcomer wouldn't understand?
   - Could it be shorter — are there obvious or duplicated points to cut?
   - Is it in passive or vague voice where naming the actor would read more directly?
   - Is there meta-commentary that adds no information?
3. **Also confirm the format** briefly (secondary): title matches `[type] Description` within ~63 chars, and the required template sections from `.github/pull_request_template.md` are present. For the full standards, see `creating-pull-requests` and `wiki/pull-requests.md`.
4. **Report** the findings per the Output Format below.

## Common Patterns to Flag

- A title that only makes sense alongside the body (e.g. "[fix] Fix the bug")
- A description that opens with context or process instead of the change itself
- Bullets that restate the diff (added tests, updated types) instead of explaining intent
- Non-obvious decisions (deprecations, fallbacks, unit choices) stated without the *why*
- Internal jargon or acronyms with no expansion
- Passive or actor-less phrasing where naming the actor reads more directly
- Meta-commentary ("This PR...", "I added...") that could be cut
- More bullets than the change warrants, or bullets that duplicate each other

## Output Format

For the title and for the description, give the issue and a concrete proposed rewrite.
