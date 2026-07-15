---
name: reviewing-readability
description: Evaluates comments, docstrings, and naming in code for readability by a developer new to the codebase — is the documentation clear and concise, and is non-obvious logic documented? Produces findings with concrete proposed rewrites (or additions where documentation is missing); the caller decides whether to apply them or present them as feedback. Use when reviewing a PR, branch, or set of changes for comment quality, naming clarity, or documentation readability. For a PR's title and description, use reviewing-pr-description instead.
---

# Reviewing Readability

Review all comments, docstrings, and names (functions, classes, variables, tests) in the target code for clarity and conciseness, and flag non-obvious logic or unclear function purpose that lacks documentation.

This skill only evaluates: it produces findings with concrete proposed rewrites and does **not** apply them. The caller decides whether to apply the rewrites or present them as feedback.

## Audience

The reader is a **developer unfamiliar with the implementation context** who is trying to understand the logic in the location they are currently reading. They have general Python/TypeScript expertise but don't know the history of why things were built this way.

## Principles

1. **Explain intent, not mechanics** — don't restate what the code does; explain *why* or *what would go wrong without it*.
2. **Lead with the main idea** — the first sentence should state the rule or intent; put mechanics, edge cases, and exceptions after. A comment can be concise and accurate yet still bury the point by opening with the mechanics.
3. **Concise wins** — shorter comments are easier to understand. If a 4-line comment can be 2 lines, make it 2.
4. **Use a list for multiple cases** — when a comment enumerates several conditions, outcomes, or steps, a bulleted list (`-`) is usually easier to scan than the same content packed into prose. Lead with a one-line summary, then list the cases.
5. **Avoid jargon without context** — if a term is project-specific (e.g. "delta path", "fragment path", "DG"), either define it briefly or use a more descriptive phrase.
6. **Names should stand alone** — a test name or function name should communicate what it does without needing to read the docstring.
7. **Comment non-obvious logic, not the obvious** — skip comments that restate the code (`# increment counter`), but flag genuinely complex or non-obvious logic that has *no* explanatory comment. Likewise, flag a function whose purpose isn't clear from its name and signature and that lacks a brief docstring; leave self-explanatory functions undocumented.
8. **Comments that say "unreachable" or "no-op" should explain why** — the reader needs to know why the case can't happen or why no action is needed.
9. **Prefer active voice; name the actor** — passive constructions ("the id is assigned", "completions that are reported") force the reader to infer who does what. Say who acts on what ("the runner assigns a new id", "the frontend reports completions"). This is easy to miss because passive prose can still be accurate and concise — check for it explicitly.

## Evaluation Process

1. **Collect** all comments, docstrings, class names, function/method names, and test names in the target scope.
2. **For each item, ask**:
   - Would a newcomer understand this on first read?
   - Is there jargon that isn't defined nearby?
   - Could it be shorter without losing meaning?
   - Does it explain the "why" or just the "what"?
   - Does the first sentence state the main idea, or does it bury it under mechanics?
   - If it enumerates several cases, would a bulleted list scan better than prose?
   - Is it in passive voice? Would naming the actor and switching to active voice read more directly?
   - For names: does it communicate the purpose without reading the body?
3. **Also scan for missing documentation**: is there complex or non-obvious logic with no explanatory comment, or a function whose purpose isn't clear from its signature and that has no docstring? Any comment or docstring you propose adding must itself follow the principles above — lead with the intent, stay concise, use active voice, and don't narrate the obvious.
4. **Report** the findings per the Output Format below.

## How much to flag

Readability fixes are cheap — a comment reword or a rename takes seconds, so don't spend effort ranking findings by importance or deciding what's "worth it."

- **Flag everything that makes the code clearer or more concise.** The only thing you skip is a change where it's genuinely ambiguous whether it improves readability (a lateral rewrite that's just a matter of taste). If a change is a clear improvement, include it no matter how small.
- **Don't categorize by priority or severity.** Leave alone only what's already clear and concise.
- **Mark minor items with a `[nit]` prefix** to soften the feedback and signal it's low-stakes and optional — but still include it. `[nit]` is how you communicate "this is minor," *not* a reason to drop the item. Reserve un-prefixed feedback for things that are actually misleading or confusing (e.g. a comment that describes deleted behavior).

## Output Format

Produce findings, grouped by file. For each item, give the location (file and line or symbol), the issue, and a concrete proposed rewrite (or, for missing documentation, the comment/docstring to add). Prefix minor/optional items with `[nit]`.

## Common Patterns to Flag

- Complex or non-obvious logic with no explanatory comment
- A function whose purpose isn't clear from its name and signature and that lacks a brief docstring
- Comments that open with mechanics or edge cases instead of leading with the main point
- Comments that explain the implementation history instead of current behavior
- Docstrings that list every parameter's type when the signature already has type annotations
- Test names that use internal abbreviations (e.g. `test_dg_inside_fp` instead of `test_write_within_fragment_scope`)
- "Pass through" / "falls through" without saying what happens instead
- Passive voice that hides the actor (e.g. "a new id is received", "completions that are reported") where active voice would read more directly
- Multi-line comments where one line would suffice
- Several conditions/outcomes packed into prose that would scan better as a bulleted list
- Comments that were correct when written but now describe deleted/changed behavior
- Reference comments (spec, RFC, issue number) that aren't needed to understand the code, or that point somewhere a reader can't reach (dead links, private/internal tickets or docs) — flag them, proposing to drop the unneeded ones and repoint the rest to a public GitHub issue or an in-repo spec

## What NOT to Change

- Type annotations (those aren't documentation)
- Inline comments that mark a subtle correctness constraint (e.g. ordering dependencies)
- Reference comments (spec, RFC, issue number) that a reader needs to understand the code **and** point somewhere accessible (a public GitHub issue or an in-repo spec) — keep the identifier intact rather than trimming or vague-ifying it
- Legal headers
