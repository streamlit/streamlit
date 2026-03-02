## Documentation Review Summary

Reviewed all internal documentation files against the current codebase state.

### Issues Found and Fixed

**4 issues across 4 primary files (10 files modified including synced copies):**

1. **[VERSION_MISMATCH] `frontend/AGENTS.md:9`**
   - Changed "vitest v3" to "vitest v4"
   - Reason: vitest ^4.0.18 is specified in `frontend/package.json` and v4.0.18 is installed

2. **[INCORRECT] `AGENTS.md:61`**
   - Changed `frontend-format: Format all frontend files (eslint)` to `(prettier)`
   - Reason: `make frontend-format` runs `yarn format` which executes `prettier --write`, not eslint

3. **[INCORRECT] `lib/AGENTS.md:8`**
   - Changed "config in root `pyproject.toml`" to "config in `lib/pyproject.toml`" for pytest
   - Reason: `[tool.pytest.ini_options]` is defined in `lib/pyproject.toml`, not the root file

4. **[MISSING] `CONTRIBUTING.md` skills table**
   - Added `finalizing-pr` skill to the "AI Agent Skills and Subagents" table
   - Reason: Skill exists in `.claude/skills/finalizing-pr/SKILL.md` but was not listed

### Synced Copies Updated

The `scripts/generate_agent_rules.py` script was run to propagate changes to synced files:
- `.cursor/rules/overview.mdc` (fix #2)
- `.cursor/rules/python.mdc` (fix #3)
- `.cursor/rules/typescript.mdc` (fix #1)
- `.github/copilot-instructions.md` (fix #2)
- `.github/instructions/python.instructions.md` (fix #3)
- `.github/instructions/typescript.instructions.md` (fix #1)

### Verified (No Issues Found)

- All documented folder paths exist
- All file references in architecture docs resolve correctly
- `make help` output matches documented make commands
- `.github/workflows/AGENTS.md` workflow reference matches actual workflow files
- `.github/actions/` composite actions match documentation
- Python version range (3.10-3.14) matches `lib/pyproject.toml` classifiers
- All skill and subagent cross-references are valid
- Protobuf file references are correct
- Wiki contents table matches actual files

### Files Modified

```
AGENTS.md                                       |  2 +-
CONTRIBUTING.md                                 |  1 +
frontend/AGENTS.md                              |  2 +-
lib/AGENTS.md                                   |  2 +-
.cursor/rules/overview.mdc                      |  2 +-  (synced)
.cursor/rules/python.mdc                        |  2 +-  (synced)
.cursor/rules/typescript.mdc                    |  2 +-  (synced)
.github/copilot-instructions.md                 |  2 +-  (synced)
.github/instructions/python.instructions.md     |  2 +-  (synced)
.github/instructions/typescript.instructions.md |  2 +-  (synced)
```
