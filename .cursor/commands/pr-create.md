# Create Pull Request

**Goal:** Create a draft PR on GitHub with appropriate labels after user approval.

**Success criteria:**

- Draft PR created via `gh pr create`
- Proper labels applied (impact, change type)
- User has reviewed and approved PR content

**Workflow:**

1. Ask user to choose mode (Already Ready/Automated/Interactive)
2. Execute git workflow for chosen mode
3. Analyze changes and determine labels
4. Compose PR (see @agent-knowledge/processes/pr-creation/writing-principles.md)
5. Show PR for user approval
6. Create PR with `gh pr create`

**Critical constraints:**

- MUST wait for user approval before running `gh pr create`
- MUST follow @agent-knowledge/processes/pr-creation/writing-principles.md
- MUST show complete PR content in chat before creating

## Reference Documentation

See @agent-knowledge/processes/pr-creation/README.md for writing style, testing documentation, branch naming, and labeling guidelines.

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

# Create branch (see @agent-knowledge/processes/pr-creation/branch-naming.md for conventions)
# Replace {type} with: feature, fix, refactor, chore, or docs
# Replace {descriptive-name} with actual branch name
git checkout -b {type}/{descriptive-name}

# Commit staged changes
# Format: <verb> <what> <where> (≤50 chars) - see @agent-knowledge/processes/pr-creation/writing-principles.md
# Example below - replace with actual commit message
git commit -m "Add height parameter to plotly charts"

# Push
# {branch-name} will be auto-filled by git
git push --set-upstream origin $(git branch --show-current)
```

### Mode C: Interactive

Guide user through each command with prompts, letting them execute manually.

## Step 3: Compose and Create PR

1. **Analyze changes** to determine labels (see @agent-knowledge/processes/pr-creation/labeling-guide.md)

2. **Generate concise PR title** (`[type] description`, ≤80 chars, see @agent-knowledge/processes/pr-creation/writing-principles.md)

3. **Compose PR description:**

   - Read @.github/pull_request_template.md to understand the required sections
   - Read @agent-knowledge/processes/pr-creation/writing-principles.md for general style
   - For sections describing what changed: apply @agent-knowledge/processes/pr-creation/describe-changes-guide.md
   - For sections describing testing: apply @agent-knowledge/processes/pr-creation/testing-plan-guide.md
   - For optional sections (screenshots, issue links): include only if applicable

4. **Write PR for user review:**

   Write the complete PR details to `@work-tmp/pr_description.md` using this format:

   ```markdown
   ---
   title: [PR title from step 2]
   labels: impact:{users|internal}, change:{type}
   ---

   [PR description from step 3]
   ```

   Ask user: "I've written the PR details to `@work-tmp/pr_description.md`. You can edit the title, labels, or description directly in that file. Reply 'yes' when ready to create the PR, or provide feedback for changes."

5. **After user approval, create PR:**

   Read `@work-tmp/pr_description.md` to get the (potentially edited) title, labels, and description. Parse the frontmatter to extract values, then create a temp file with just the description body for `gh pr create`:

   ```bash
   # Parse frontmatter from the reviewed file
   title=$(grep '^title:' work-tmp/pr_description.md | sed 's/^title: //')
   labels=$(grep '^labels:' work-tmp/pr_description.md | sed 's/^labels: //' | sed 's/, /,/g')

   # Extract body (everything after the closing --- of frontmatter)
   awk '/^---$/{if(++count==2) flag=1; next} flag' work-tmp/pr_description.md > work-tmp/pr_body.md

   # Create PR using parsed values
   gh pr create \
     --title "$title" \
     --body-file work-tmp/pr_body.md \
     --base develop \
     --label "$labels" \
     --draft

   # Clean up temporary files
   rm work-tmp/pr_description.md work-tmp/pr_body.md
   ```
