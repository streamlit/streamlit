# Prioritize Bug

## Mission

Assign P0-P4 priority labels to confirmed bugs based on impact and severity criteria.

**Type:** Pure command - can run standalone or as part of the orchestrated pipeline.

**Note:** Agents can apply priority labels directly and document reasoning for team review. Labels are easily reversible if adjustments are needed.

## Prerequisites

- Issue confirmed via `confirm-bug.md`
- Issue has `status:confirmed` and `type:bug` labels
- Missing `priority:P{0,1,2,3,4}` label

**Expected State:** Every confirmed bug MUST have a priority label.

## Workflow

### Step 1: Identify Target Issues

Search for confirmed bugs without priority labels:

```bash
gh issue list --repo streamlit/streamlit \
  --label "status:confirmed" \
  --label "type:bug" \
  --state open \
  --json number,title,labels \
  --jq '.[] | select(.labels | map(select(.name | startswith("priority:"))) | length == 0)'
```

### Step 2: Analyze Each Issue

For each identified issue, evaluate:

1. **Impact Scope:** How many users are affected? (all users, most users, many users, specific users)
2. **Severity:** What is broken? (core functionality, feature, edge case)
3. **Workarounds:** Can users accomplish their goal another way?
4. **User Journey:** Does it affect a primary Streamlit user journey?
5. **Regression:** Is this a recent regression or long-standing issue?
6. **Dependencies:** Does it relate to key dependencies in the test matrix?

**Fetch complete issue details:**

```bash
gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit --json number,title,body,comments,labels,author,url
```

### Step 3: Apply Priority Criteria

Use these definitions to determine priority. **Note:** "users" means either "developers" or "viewers".

#### Priority P0 - Critical

**Criteria:**

- Primary Streamlit user journey is effectively broken for nearly all users:
  - Install/upgrade Streamlit (pip, conda, pipenv, poetry)
  - Running `streamlit run` or `streamlit hello`
  - Auto-rerun on file changes
  - Any non-experimental `st.*` command
  - Custom component authoring/usage
  - Core hosting platforms (Community Cloud, SiS)
  - Docker deployment
- High-risk security or compliance issue (even if not user-visible)

**Action Required:** Must be addressed ASAP with a hotfix

#### Priority P1 - High

**Criteria:**

- Blocks most users from doing something WITHOUT a workaround
- New or high-profile feature visibly broken in common scenarios
- Causes major incident with hosting partners (Community Cloud/SiS)
- Non-blocking but noticeable regression (>5% of users notice) including:
  - Performance regression
  - Visual/design issues
  - Breaking changes to backwards compatibility

**Action Required:** If pre-release, blocks release. If post-release, fix within 2 weeks or assess hotfix.

#### Priority P2 - Medium

**Criteria:**

- Blocks many users BUT a workaround exists
- Visible breakage in `experimental_*` features
- Blocks many users with key dependencies (per Test Matrix)
- Less noticeable regression (visual, design, performance)
- Confusing behavior affecting user experience

**Action Required:** If regression with straightforward fix, target next release. Otherwise, assess case-by-case.

#### Priority P3/P4 - Low

**Criteria:**

- Blocks users only in specific situations (e.g., specific external dependencies)
- Small stylistic changes
- Very specific scenarios, difficult to reproduce
- **P3 vs P4:** Use upvotes/comments in GitHub to distinguish; high engagement may warrant P2

**Action Required:** Fix opportunistically or accept community contributions. Not prioritized for core engineers.

#### Won't Fix

**Criteria:**

- Caused by explicitly unsupported scenarios (old browser/Python versions)
- Low visibility backwards compatibility break in rare edge cases that benefits majority

**Action Required:** Close with explanation; no engineering time allocated.

### Step 4: Apply Priority Labels

Apply priority labels directly (they can be easily adjusted if needed):

```bash
gh issue edit <ISSUE_NUMBER> --repo streamlit/streamlit --add-label "priority:P2"
```

## Output Summary

For each bug prioritized:

```markdown
## Priority Assignment for Issue #<ISSUE_NUMBER>

**Issue:** <Title>
**Priority Assigned:** P<N>

**Rationale:**

- Impact: <Severity and scope>
- Workaround: [Yes/No - brief description if yes]
- Affected users: <Who is impacted>

**Key Factors:**

- <Factor 1>
- <Factor 2>

**GitHub Issue:** [#<ISSUE_NUMBER>](https://github.com/streamlit/streamlit/issues/<ISSUE_NUMBER>)
```

## Edge Cases and Considerations

- **Ambiguous Impact:** If user impact is unclear, default to lower priority and flag for team discussion
- **Multiple Bugs in One Issue:** Assess based on highest-severity bug
- **Duplicate Issues:** Cross-reference to ensure consistent prioritization
- **Community Input:** Consider upvotes and comment activity as signals of user impact
- **Recent vs Old Bugs:** Recent regressions typically warrant higher priority
- **Experimental Features:** Bugs in experimental features typically max out at P2 unless affecting stability

## Success Criteria

✅ All confirmed bugs analyzed with clear rationale
✅ Priority labels applied based on criteria
✅ Reasoning documented for team review
✅ Team can review and adjust priorities as needed

## Notes

- Labels can be easily adjusted if team disagrees with priority assignment
- Never post comments without approval (see other commands)
- Document reasoning clearly so team can understand your assessment

**Next:** `add-feature-labels.md` (can run in parallel)
