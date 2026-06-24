---
applyTo: "lib/streamlit/.agents/skills/**/*"
---

<!-- Generated from lib/streamlit/.agents/skills/AGENTS.md. Edit that file instead, then run: uv run python scripts/generate_agent_rules.py -->

# Authoring Embedded Agent Skills

Streamlit embeds agent skills under `lib/streamlit/.agents/skills/` (e.g. `developing-with-streamlit/` — a routing `SKILL.md` plus topic reference files under `references/`). They ship with the library and are loaded from the user's installed Streamlit, so keep them up to date as new features land. When adding or editing guidance, follow these conventions:

- **Earn the section.** Add a dedicated reference section *and* a `SKILL.md` routing row only for features that are common, easy to misuse, or post-training-cutoff (so an un-guided agent would miss or misuse them). Niche or advanced features get a single sentence in an existing section, or rely on the API-reference + changelog for discovery — not a prominent new section.
- **Group references by widget semantics.** Selection widgets hold a value picked from a set; value-entry/input widgets collect a typed value; trigger widgets (`st.button`, `st.form_submit_button`, `st.menu_button`, `st.download_button`, `st.link_button`) fire once and hold no persistent value. Put each widget in the bucket that matches its semantics; don't shoehorn a trigger into selection/input.
- **Don't version-stamp.** Avoid "as of 1.x" annotations — the skill ships bundled with the Streamlit release, so it is already versioned with the code. For support/compatibility lists, state the *exceptions* ("not supported on …") rather than enumerating the supported set, so new additions are covered by default.
- **Steer to the native API and name the anti-pattern it replaces.** Prefer explicit elements over `st.write`/magic; prefer Altair over Plotly for complex charts (Altair is bundled, no extra install); match message severity to the situation (a not-yet-filled input is a neutral `st.info` prompt, not a warning).
- **Keep routing and links in sync.** When you add, move, or remove a reference, update the `SKILL.md` routing row and verify every `references/*.md` link resolves. Avoid hard links between references that live in different PR branches/stacks — they dangle until both merge.
- **Bias toward concise guidance** — the smallest wording that lands the point.
