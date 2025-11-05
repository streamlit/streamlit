# Create Pull Request

**Goal:** Create a draft PR on GitHub with appropriate labels after user approval.

**Success criteria:**

- User has confirmed security assessment (determines labeling)
- Draft PR created via `gh pr create`
- Proper labels applied (impact, change type)
- User has reviewed and approved PR content

**Workflow:**

1. Ask user to choose mode (Already Ready/Automated/Interactive)
2. Confirm security assessment completion
3. Execute git workflow for chosen mode
4. Analyze changes and determine labels
5. Compose PR (see writing-style.md)
6. Show PR for user approval
7. Create PR with `gh pr create`

**Critical constraints:**

- MUST wait for user approval before running `gh pr create`
- MUST ask about security assessment (don't assume completed)
- MUST follow writing-style.md (2-4 bullets max, omit obvious changes)
- MUST show complete PR content in chat before creating

## Reference Documentation

**Process knowledge (in agent-knowledge/):**

- [PR Labeling](../agent-knowledge/processes/pr-creation/labeling-guide.md)
- [Branch Naming](../agent-knowledge/processes/pr-creation/branch-naming.md)
- [PR Template](../agent-knowledge/processes/pr-creation/template.md)
- [Testing Plan Guide](../agent-knowledge/processes/pr-creation/testing-plan-guide.md)
- [Writing Style](../agent-knowledge/processes/pr-creation/writing-style.md) - **CRITICAL: Be concise!**

## Step 1: Choose Mode

**CRITICAL: Always ask the user first:**

> "How would you like to proceed with creating the PR?
>
> 1. **Already Ready**: I have a feature branch with all changes committed and pushed
> 2. **Automated**: Handle branch creation, committing, and pushing automatically
> 3. **Interactive**: Guide me through each step manually"

Wait for user response before proceeding.

## Step 2: Execute Git Workflow

### Mode A: Already Ready

Validate readiness:

```bash
git branch --show-current
git status
git branch -r | grep $(git branch --show-current)
```

Confirm with user, then proceed to Step 3.

### Mode B: Automated

Assumes user has already staged changes with `git add`.

```bash
# Check status and verify changes are staged
git status

# Ensure we're on develop before creating branch
git checkout develop

# Create branch (see branch-naming.md for conventions)
# Replace {type} with: feature, fix, refactor, chore, or docs
# Replace {descriptive-name} with actual branch name
git checkout -b {type}/{descriptive-name}

# Commit staged changes
# Format: <verb> <what> <where> (≤50 chars) - see writing-style.md
# Example below - replace with actual commit message
git commit -m "Add height parameter to plotly charts"

# Push
# {branch-name} will be auto-filled by git
git push --set-upstream origin $(git branch --show-current)
```

### Mode C: Interactive

Guide user through each command with prompts, letting them execute manually.

## Step 3: Compose and Create PR

1. **Confirm security assessment:**

   Ask user: "Have you completed the security assessment for these changes? (yes/no)"

   - If yes: Include `security-assessment-completed` label
   - If no: Omit `security-assessment-completed` label (can be added later)

2. **Analyze changes** to determine labels (see labeling-guide.md)

3. **Generate concise PR title** (≤80 chars, see writing-style.md)

4. **Compose PR description** using template.md (2-4 bullets max, see writing-style.md)

5. **Show PR for approval:**

   Display the composed PR in chat:

   ```markdown
   **PR Title:** {Generated title}

   **PR Description:**
   {Composed description}

   **Labels:** [security-assessment-completed,] impact:{users|internal}, change:{type}
   ```

   Ask user: "Does this PR look good? Reply 'yes' to create it, or provide feedback for changes."

6. **After user approval, create PR:**

   ```bash
   # Write approved PR description
   cat > pr_description.md << 'EOF'
   [Approved PR content]
   EOF

   # Create PR with labels
   # Replace placeholders:
   # - {Approved Title}: actual PR title
   # - {users|internal}: users (user-facing) or internal (internal-only)
   # - {type}: feature|bugfix|chore|refactor|other
   # - [security-assessment-completed,]: include only if user confirmed
   gh pr create \
     --title "{Approved Title}" \
     --body-file pr_description.md \
     --base develop \
     --label "[security-assessment-completed,]impact:{users|internal},change:{type}" \
     --draft
   ```

## See Also

- [agent-knowledge/processes/pr-creation/](../agent-knowledge/processes/pr-creation/) - Complete PR creation knowledge base
