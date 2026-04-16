## Inline Comments

In addition to the PR-level review, produce actionable inline comments targeting specific lines of code. Write them to `inline_comments.json` using this exact JSON structure:

```json
{
  "comments": [
    {
      "path": "relative/path/to/file.py",
      "line": 123,
      "body": "suggestion: Use `foo()` instead of `bar()` for thread safety.",
      "severity": "high"
    }
  ]
}
```

Rules for inline comments:
- Include only actionable, high-signal comments — skip trivial style nits that a formatter would catch.
- `path` must be the file path relative to the repository root.
- `line` must be an integer targeting an added or modified line that appears in the PR diff for that `path`. Comments are posted on the RIGHT side of the diff. Lines outside the diff will be rejected by the GitHub Reviews API (422).
- `body` must be concise, specific, and MUST use [Conventional Comments](https://conventionalcomments.org/) syntax. Prefix every body with a label such as `issue:`, `suggestion:`, `nitpick:`, `question:`, or `thought:`.
- `severity` must be one of: `high`, `medium`, `low`.
- If there are no suitable inline comments, write `{"comments": []}`.
- Do not duplicate inline comment findings in the PR-level review body (`review.md`). Each finding should appear in exactly one place: either as an inline comment (for line-specific issues) or in the summary (for high-level concerns), not both.
