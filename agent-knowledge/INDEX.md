---
last_updated: 2025-11-05
---

# Agent Knowledge Base Index

Central registry of resources available to AI agents working on Streamlit.

## Available Resources

### [Guides](references/guides/)

System overviews and comprehensive documentation (e.g., layout system, caching, state management)

### [Features](references/features/)

Feature development artifacts (specs + implementation plans) organized by area

## Contributing

**Local experimentation:** Use `*.local.md` for files or `local/` directory (automatically ignored by git)

**Adding shared resources:**

1. Create your resource with YAML frontmatter:
   ```yaml
   ---
   status: stable | experimental
   last_updated: YYYY-MM-DD
   ---
   ```
   - `status: experimental` - Workflow being developed, team feedback welcome
   - `status: stable` - Established, reviewed workflow
2. Place in the appropriate directory (guides or features organized by area)
3. Discovery is automatic via directory structure

## See Also

- [README.md](README.md) - Purpose and usage guide for this directory
- [../AGENTS.md](../AGENTS.md) - Top-level agent repo overview
