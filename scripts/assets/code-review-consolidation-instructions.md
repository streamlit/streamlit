## Inline Comment Triage

From `all_inline_comments.json`, triage the candidate inline comments from individual reviews:

1. **Deduplicate** — merge near-identical comments targeting the same file and line (or adjacent lines) with similar feedback. Keep the clearest wording.
2. **Rank** — order by impact and actionability. Prefer `high` severity, concrete suggestions, and security/correctness findings over style nits.
3. **Cap** — keep only the top 20 comments. Drop the rest.

Write the triaged results to `inline_comments.json` using this exact JSON structure:

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

Rules:
- `path` must be the file path relative to the repository root.
- `line` must be an integer line number in the HEAD version of the file.
- `body` must be concise, specific, and MUST use [Conventional Comments](https://conventionalcomments.org/) syntax. Prefix every body with a label such as `issue:`, `suggestion:`, `nitpick:`, `question:`, or `thought:`.
- `severity` must be one of: `high`, `medium`, `low`.
- If no good inline candidates exist after triage, write `{"comments": []}`.
