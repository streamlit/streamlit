# Gather Issues Needing Triage

## Mission

Identify and list all Streamlit issues labeled with `status:needs-triage`.

**Type:** Pure command - can run standalone or as part of the orchestrated pipeline.

## Prerequisites

- GitHub CLI (`gh`) is installed and authenticated
- Access to `streamlit/streamlit` repository

## Workflow

### Step 1: Fetch Issues Needing Triage

Use GitHub CLI to fetch issues with the `status:needs-triage` label:

```bash
gh issue list --repo streamlit/streamlit --label "status:needs-triage" --limit 20 --json number,title,body,labels,url,createdAt,author
```

### Step 2: Review and List Issues

For each issue returned, note:

- Issue number
- Title
- Creation date
- Reporter

**Simple rule:** All issues with `status:needs-triage` need to be processed.

### Step 3: Prioritize (Optional)

If many issues, consider prioritizing by:

- Age (older issues first)
- Reporter engagement (issues with updates)
- Apparent severity from title

## Output Format

Provide a summary of issues found:

```markdown
## Issues Needing Triage: YYYY-MM-DD

**Total Issues:** <count>

| #        | Title   | Created | Reporter    |
| -------- | ------- | ------- | ----------- |
| <NUMBER> | <Title> | <Date>  | @<username> |
| <NUMBER> | <Title> | <Date>  | @<username> |
| <NUMBER> | <Title> | <Date>  | @<username> |

**Next Steps:**

- Use `analyze-issue.md` to analyze each issue
- Start with oldest or highest-priority issues
```

## GitHub CLI Quick Reference

**Reference:** For complete gh CLI commands and patterns, see `agent-knowledge/workflows/issue-management/github-cli.md`

**Essential commands:**

```bash
# List issues with specific label
gh issue list --repo streamlit/streamlit --label "status:needs-triage" --limit 20 --json number,title,body,labels,url,createdAt,author

# Get detailed issue info
gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit --json number,title,body,comments,labels,createdAt,author

# Get issue author for tagging
gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit --json author --jq '.author.login'
```

## Notes

- This command only identifies issues - it does not modify anything
- Detailed filtering and assessment happens in `analyze-issue.md`
- If using the orchestrated pipeline, update rotation journal after this step

**Next:** `analyze-issue.md` for each issue identified
