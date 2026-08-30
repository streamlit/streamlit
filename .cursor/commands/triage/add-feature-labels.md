# Add Feature Labels

## Mission

Add `feature:*` or `area:*` labels to Streamlit issues.

**Type:** Pure command - can run standalone or as part of the orchestrated pipeline.

**Rule:** Every issue must have at least one `feature:*` OR `area:*` label.

**Note:** Labels can be added directly by agents (easily reversible). Document reasoning for later review. Never add comments without approval.

## Prerequisites

- Issue analyzed (can run at any point after `analyze-issue.md`)
- GitHub CLI installed and authenticated

## Workflow

### Step 1: Find Issues Without Feature or Area Labels

Use GitHub CLI to fetch issues that lack both `feature:*` and `area:*` labels:

```bash
# Get recently created issues without feature or area labels
gh issue list --repo streamlit/streamlit \
  --state open \
  --limit 50 \
  --json number,title,body,labels \
  --jq '.[] | select(.labels | map(select(.name | startswith("feature:") or startswith("area:"))) | length == 0) | {number, title, labels: [.labels[].name]}'
```

Or focus on specific type/status:

```bash
# Get bugs without feature or area labels
gh issue list --repo streamlit/streamlit \
  --label "type:bug" \
  --state open \
  --limit 30 \
  --json number,title,body,labels \
  --jq '.[] | select(.labels | map(select(.name | startswith("feature:") or startswith("area:"))) | length == 0)'
```

### Step 2: Analyze Each Issue

**For each issue, review ALL information:**

1. **Title:** Component names, keywords
2. **Body:** Description, code examples, affected features
3. **Comments:** Users often mention related features or additional affected components
4. **Related issues:** Links to similar problems

**Fetch complete issue details:**

```bash
gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit --json number,title,body,comments
```

**Important:** Don't rush. Read everything to ensure you find all affected components.

### Step 3: Match to Existing Labels

**Get ALL available labels:**

```bash
# Get all feature labels
gh label list --repo streamlit/streamlit --limit 500 | grep "^feature:"

# Get all area labels
gh label list --repo streamlit/streamlit --limit 500 | grep "^area:"
```

**Matching process:**

1. **First, find exact matches from existing labels:**

   - Issue mentions `st.dataframe` → check if `feature:st.dataframe` exists
   - Issue mentions `st.pyplot` in comments → check if `feature:st.pyplot` exists
   - Add ALL relevant existing labels

2. **If component-specific labels exist, use them** (preferred over area labels)

3. **If no specific feature label, use area labels:**

   - Performance → `area:performance`
   - Deployment → `area:deployment`
   - Platform/dependencies → `area:dependencies`

4. **If no existing label fits well:**
   - Note it for potential new label creation
   - Use closest existing label for now

**Examples:**

| Issue Content                                | Labels                                               |
| -------------------------------------------- | ---------------------------------------------------- |
| "st.dataframe doesn't show floats correctly" | `feature:st.dataframe`                               |
| "Button in sidebar doesn't work"             | `feature:st.button`, `feature:st.sidebar`            |
| "Fragment with container causes duplication" | `feature:st.fragment`, `feature:st.container`        |
| "Cache not invalidating properly"            | `feature:st.cache_data`, `feature:st.cache_resource` |
| "File uploader memory leak"                  | `feature:st.file_uploader`, `area:performance`       |
| "App won't start on Windows"                 | `area:deployment`                                    |
| "Slow rendering with large dataset"          | `area:performance`                                   |
| "Screen reader can't access widgets"         | `area:accessibility`                                 |
| "Dataframe export performance issue"         | `feature:st.dataframe`, `area:performance`           |

### Step 4: Apply Labels

Apply labels directly (they can be easily corrected if needed):

**Single label:**

```bash
gh issue edit <ISSUE_NUMBER> --repo streamlit/streamlit --add-label "feature:st.dataframe"
```

**Multiple labels:**

```bash
gh issue edit <ISSUE_NUMBER> --repo streamlit/streamlit \
  --add-label "feature:st.button" \
  --add-label "feature:st.sidebar"
```

**Verify:**

```bash
gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit --json labels --jq '.labels[].name'
```

## Output Summary

For each issue labeled:

```markdown
## Labels Added for Issue #<ISSUE_NUMBER>

**Issue:** <Title>
**Labels Added:** `feature:<name>`, `area:<name>`

**Reasoning:** <Why these labels were chosen>

**GitHub Issue:** [#<ISSUE_NUMBER>](https://github.com/streamlit/streamlit/issues/<ISSUE_NUMBER>)
```

## Rules

**Do:**

- Read full issue including ALL comments (don't just scan title)
- Review ALL available labels (use limit 500 to see all labels)
- Add all relevant labels found
- Use exact API names (`st.data_editor` not `st.dataeditor`)
- Document reasoning for team review
- Suggest new labels if needed (but don't create them)

**Don't:**

- Rush or skip comments
- Limit label search too low (missing labels)
- Guess when unclear - note uncertainty
- Remove existing labels (only add)
- Create new labels yourself (suggest for team review)
- Post comments to issues (requires approval - see other commands)

## Common Patterns

- "st.selectbox returns None" → `feature:st.selectbox`
- "Columns in sidebar misaligned" → `feature:st.columns`, `feature:st.sidebar`
- "st.dataframe formatting wrong" → `feature:st.dataframe`
- "session_state clears" → `feature:st.session_state`
- "Fragment + container bug" → `feature:st.fragment`, `feature:st.container`
- "App won't deploy" → `area:deployment`
- "Slow performance" → `area:performance` (+ specific feature if applicable)

## Edge Cases

### Issue: Component mentioned but not the problem

```
Issue: "When using st.write after st.dataframe, the page crashes"
Analysis: The crash is about st.write, not st.dataframe
Labels: feature:st.write (st.dataframe is incidental context)
```

### Issue: Generic/infrastructure problem

```
Issue: "App won't start on Windows"
Analysis: Not a specific component issue
Labels: Use area label like area:deployment or area:platform
Note: Every issue needs at least one feature or area label
```

### Issue: Feature request for new component

```
Issue: "Add st.timeline component"
Analysis: Requesting new feature, no existing component
Labels: type:enhancement + area:new-feature (or similar area label)
Note: No specific feature label exists, so use appropriate area label
```

## Troubleshooting

### Issue: No matching feature label exists

**Do:**

- Use an `area:*` label instead (every issue must have feature OR area label)
- Check if there's a broader category label
- Note it for potential label creation

**Don't:**

- Skip labeling entirely (violates the "at least one label" rule)
- Create labels yourself without approval
- Use incorrect labels as substitutes

## Success Criteria

- [ ] Analyzed complete issue (title, body, all comments)
- [ ] Reviewed all available labels
- [ ] Found all relevant existing labels
- [ ] Applied appropriate labels
- [ ] Verified labels were applied correctly
- [ ] Documented reasoning for team review
- [ ] Issue has at least one `feature:*` or `area:*` label (required)

## Notes

- **Every issue MUST have at least one `feature:*` or `area:*` label** (repository rule)
- **Labels can be added directly** - document reasoning for team review
- **Use limit 500** when fetching labels to see all available labels
- Prefer `feature:*` for components; use `area:*` for broader issues
- **Never post comments** without approval (see other commands)

**Next:** Complete (or run `prioritize-bug.md` in parallel for confirmed bugs)
