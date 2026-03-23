---
name: writing-spec
description: Writes product and tech specs for new Streamlit features. Use when designing new API commands, widgets, or significant changes that need team review before implementation.
---

# Writing product or tech specs

Create specs in the `specs/` directory following the instructions in `specs/AGENTS.md`. Use the user's instructions as the basis for the spec.

Quick start:

```bash
cp -r specs/YYYY-MM-DD-template specs/$(date +%Y-%m-%d)-feature-name
```

Then fill in `product-spec.md` and/or `tech-spec.md` per the template and guidelines.
