# Streamlit Product Guidelines

This document captures Streamlit's product philosophy and guiding principles. It's for PMs, designers, and engineers making decisions about what to build and how to build it.

**Related documents:**
- [API Design Principles](./streamlit-api-principles.md) — Detailed principles for designing the `st.*` API
- [Spec Writing Principles](./spec-writing-principles.md) — How to write product specifications

**When to use this document:**
- Deciding whether to build a feature
- Evaluating tradeoffs between options
- Aligning on product direction
- Onboarding new team members to Streamlit's philosophy

---

## The Four Pillars

### 🍎 Easy to Learn, Easy to Grok, Easy to Use

Streamlit should be approachable for data scientists who aren't professional developers. No frontend knowledge required. No complex app architecture to learn. Just write Python.

### 🤩 Magical for Viewers

Apps built with Streamlit should delight end users. Beautiful defaults, responsive interactions, polished UI. The viewer shouldn't know or care that the app was built with Streamlit—they should just think "this is a great app."

### 😍 Best Developer Experience

Writing Streamlit apps should feel joyful. Fast iteration, instant feedback, minimal boilerplate. The tool should get out of your way and let you focus on your data and logic.

### 🛡️ Trustworthy

Streamlit should be reliable, stable, and secure. Apps should work consistently across environments. Upgrades shouldn't break existing apps. Performance should be predictable.

---

## The Dual Nature: Useful AND Toy-Like

Streamlit must be both **useful** and **toy-like** simultaneously.

### Useful
*"I want to use this to solve my problem."*

Streamlit solves real problems: building dashboards, demoing models, exploring data, creating internal tools. It's not a toy—it's a professional tool that ships production apps.

### Toy-Like
*("Toy-like" is an actual term from gamification research!)*

- **Inviting** — You want to try it
- **Tactile** — It feels responsive and immediate
- **Exploratory** — You discover by playing

**What toy-like feels like:**
- *"I feel like I can add knobs, tweak them, all without a second thought"*
- *"I want to play with Streamlit over the weekend"*
- *"I'll just try this real quick..."* (30 minutes later, you've built an app)

**How we achieve toy-like:**
- Instant feedback (hot reload)
- No setup friction
- Small, composable pieces
- Visual results immediately
- Safe to experiment (easy to undo)

---

## Core Philosophy

### Streamlit is a Consumer Product for Developers

Developer tools are often hard to learn, clunky, overly geeky, and frustrating. Streamlit should be different:

| Traditional Dev Tools | Streamlit |
|-----------------------|-----------|
| Hard to learn | Easy to learn |
| Complex setup | Easy to get started |
| Bloated features | Minimal, focused |
| Geeky interfaces | Polished, tactile |
| Frustrating errors | Helpful guidance |

### Laser Focus on Data Apps

We don't target generic apps. We target the apps data scientists and ML engineers need to make their work impactful:

- Dashboards and reports
- Model demos and prototypes
- Data exploration tools
- Internal tools for teams

**For every feature, ask:**
1. What problem does it solve?
2. Is this a problem data apps have?
3. How common is this problem?
4. Should this be in Streamlit or a Custom Component?

### Code Feels Like Scripting

Streamlit apps should feel like natural extensions of Python scripts:

- **No frontend knowledge required** — No DOM, no CSS, no JavaScript
- **No app architecture required** — No routes, no components, no state machines
- **Linear execution** — Code runs top to bottom like a script
- **Drop-in replacement** — Convert scripts to apps with minimal changes

```python
# Script                          # Streamlit app
your_number = 10                  your_number = st.slider("Number")
with open("data.csv") as f:       f = st.file_uploader("File")
    process(f)                    if f: process(f)
```

### Apps Evolve, Not Architected

Users don't plan their entire app upfront. They start with a script, add a widget, see what happens, add another. Apps grow organically through iteration, not through upfront architecture. This is why:

- Hot reload matters (see changes instantly)
- Simple mental model matters (no hidden state machines)
- Composability matters (add pieces without refactoring)

### Create Without Waiting for Other Teams

Streamlit lets data teams ship without dependencies on:

| Team | What Streamlit Replaces |
|------|------------------------|
| Frontend team | React/Vue/Angular development |
| Design team | CSS, component styling |
| DevOps team | Deployment infrastructure |
| Security team | Auth, access control (via Cloud/SiS) |
| Tools team | Internal tooling frameworks |

This autonomy is a core value proposition. Features that require cross-team coordination (custom CSS, complex deployments) should be opt-in, not required.

### Viewer Superpowers

Streamlit apps give viewers capabilities they wouldn't have otherwise:

**Through the nature of the apps:**
- Run ML pipelines with the drag of a slider
- Explore data interactively instead of reading static reports
- Ask "what if" questions and get immediate answers

**Through built-in features:**
- View underlying data for any chart (fullscreen, download)
- Zoom, pan, and inspect visualizations
- Copy data to clipboard
- Print/export to PDF

---

## Decision Principles

### Performance & Beauty & Usability > Customization & Extensibility

We'd rather lose users because Streamlit can't do what they want than lose users because Streamlit is bad at what it does. Quality over quantity.

### Minimal but High Quality

We err on the side of minimal scope coupled with high-quality user experience. MVP does not mean janky—the first iPod had fewer features than competitors but won on polish.

### Don't Break Users

- Avoid one-way doors (decisions that can't be reversed)
- If a change breaks existing apps, communicate months in advance
- Never release a version with known regressions
- Treat regressions as P0
- **Choose designs that allow you to change your mind later**

### Turn Frustrations into Magic Moments

Think through exceptions, errors, and edge cases:
- How can we make error messages better?
- Can we propose a solution?
- Can we link to relevant docs?
- Can we prevent the error in the first place?

### Core, Cloud, and SiS Are One Product

When developing a feature:
- Will this work on all platforms?
- Is there something extra we should do on other surfaces?
- How does this interact with deployment, sharing, embedding?

---

## Quality Standards

### First-Time Experience is Sacred

- Installation should be simple (few steps, few dependencies)
- Works on Mac, Windows, Linux without pain
- Small footprint (minimal dependencies, small download)
- No complex toolchain setup

### Apps Must Work on Mobile

Streamlit apps should look good and work well on phones and tablets. Not "desktop-first with mobile as afterthought" but "responsive by default."

### Apps Must Be Fast

- Apps should react quickly to interactions
- Installation size should be small
- Memory usage should be appropriate
- Network usage should be efficient

### Community is a Feature

Streamlit's vibrant community is part of the product value:

- **Forums & Discord** — Get help, share ideas
- **Streamlit Creators** — Showcase and learn from others
- **Custom Components** — Extend functionality when needed
- **Cloud Gallery** — Discover what's possible
- **Open Source** — Contribute and influence direction

When designing features, consider: Will this strengthen community? Can the community extend this? Will this generate shareable examples?

---

## When to Build What

### When Should a Feature Be a Command vs. Config?

| Use `config.toml` for... | Use `st.*` commands for... |
|--------------------------|---------------------------|
| Settings that vary by environment | App-specific behavior |
| Settings that apply to multiple apps | One-time setup |
| Deployment configuration | Runtime decisions |
| Rarely-changed values | Dynamic values |

### When Should You Create a New Command vs. Extend an Existing One?

**Extend existing** when:
- The new capability is a natural variation of existing behavior
- Users would expect to find it on the existing command
- It doesn't complicate the existing command's signature significantly

**Create new** when:
- You're serving a distinct use case
- The existing command would become confusing
- You need a different UI paradigm entirely

### When Should You Use a Submodule vs. Flat Namespace?

Keep commands in `st.*` unless:
- It's an extension API for package authors (`st.components.v1`)
- It's used around apps, not in them (`st.testing.v1`)
- It's a large group (10+) that would pollute the namespace (`st.column_config`)

---

## The Zen of Streamlit

*Adapted from the Zen of Python*

1. **Easy beats powerful** — If it's hard to use, power doesn't matter
2. **Defaults beat options** — The right default beats a configurable mess
3. **One way beats many ways** — Consistency trumps flexibility
4. **Working beats perfect** — Ship, learn, iterate
5. **Scripts beat architectures** — Code, not frameworks
6. **Magic beats ceremony** — Automate the boring stuff
7. **Beautiful is required** — Ugly apps don't get used
8. **Fast is a feature** — Slow feels broken
9. **Errors are opportunities** — Help, don't just fail
10. **Now beats someday** — Solve real problems today

---

## Quick Reference: Feature Checklist

Before shipping a feature:

- [ ] Does it solve a real problem for data apps?
- [ ] Is it easy to learn and use?
- [ ] Does the simplest usage look clean?
- [ ] Are the defaults sensible?
- [ ] Does it work on all platforms (Cloud, SiS, Notebooks)?
- [ ] Does it work on mobile?
- [ ] Is performance acceptable?
- [ ] Are error messages helpful?
- [ ] Is the documentation clear?
- [ ] Does it follow existing patterns?
- [ ] Can we change our minds later if needed?
