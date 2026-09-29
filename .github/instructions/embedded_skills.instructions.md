---
applyTo: "lib/streamlit/.agents/skills/**/*"
---

<!-- Generated from lib/streamlit/.agents/skills/AGENTS.md. Edit that file instead, then run: uv run python scripts/generate_agent_rules.py -->

# Authoring Embedded Agent Skills

Skills under `lib/streamlit/.agents/skills/` ship with the library and load from the user's installed Streamlit, so keep them current as features evolve. `developing-with-streamlit` uses `SKILL.md` for routing and `references/` for topic files. Follow these conventions when adding or editing guidance:

- **Earn prominent placement.** Add a dedicated section to an existing reference only for features that are common, easy to misuse, or likely to be missing from an agent's training data. Let niche or advanced features (for example, less relevant new parameters) be discovered through API-reference lookups by default; mention one briefly only when it fits naturally into an existing section. Create a new reference page and corresponding `SKILL.md` routing entry only when explicitly instructed by the developer.
- **Keep deprecated and removed APIs out of the skill.** Do not promote deprecated parameters, methods, or functions in references or examples. When one is removed from Streamlit, remove it from every part of the skill, including `SKILL.md`, references, examples, and templates.
- **Keep the public `st` API overview concise.** In the `Public st API` section of `references/api-reference.md`, describe each API at a high level. Do not add unnecessary implementation or usage details, and avoid calling out specific parameters.
- **Maintain public annotation types.** When Streamlit exposes a new public annotation type, update the `Public annotation types` section in `references/api-reference.md`.
- **Maintain theming guidance.** Update `references/theme.md` when a Streamlit change affects supported theme options or relevant theming guidance.
- **Maintain the Markdown quick reference.** Update the `Quick reference` table in `references/markdown.md` when Streamlit adds Markdown features.
- **Do not add version stamps.** The skill is bundled with each Streamlit release and is already versioned with the code. For compatibility lists, document exceptions instead of enumerating supported features so new additions are covered by default.
- **Keep routing and links synchronized.** When adding, moving, or removing a reference, update the corresponding `SKILL.md` routing entry and verify that every `references/*.md` link resolves. Avoid links to references that have not landed on the same branch.
- **Prefer concise guidance.** Use the smallest amount of wording that communicates the important behavior and prevents likely mistakes.
