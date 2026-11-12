<br>

<img src="https://user-images.githubusercontent.com/7164864/217935870-c0bc60a3-6fc0-4047-b011-7b4c59488c91.png" alt="Streamlit logo" style="margin-top:50px"></img>

# Streamlit

### Agents build it. Agents use it. Your team owns it.

**Streamlit is the agent-native data app framework:** the open-source Python framework
for data apps and dashboards that coding agents build and data teams own.

[![PyPI downloads](https://img.shields.io/pypi/dm/streamlit?label=PyPI%20downloads)](https://pypi.org/project/streamlit/)
[![GitHub stars](https://img.shields.io/github/stars/streamlit/streamlit?style=flat)](https://github.com/streamlit/streamlit/stargazers)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](https://github.com/streamlit/streamlit/blob/develop/LICENSE)

Streamlit turns Python into production data apps and dashboards: forecasts and
simulations, review and approval workflows, and advanced dashboards with real logic. Apps
are plain, readable Python, with no frontend or API layer. Streamlit handles the
interface, state, caching, sign-in, and upgrades, so you maintain only your logic. Build
apps yourself, or let your coding agent build them. Every app can also be a tool that
other agents use over MCP.

**The No. 1 Python framework for data apps and dashboards.** Used by millions. Trusted by
thousands of companies, from startups to global enterprises.

## Generating an app is cheap. Owning it isn't.

Coding agents can generate any app in minutes, so generating the app is no longer the hard
part. Owning it is: the numbers have to be right, the logic has to live in the right
place, and the app has to stay secure, accessible, and maintainable as it multiplies into
hundreds. Streamlit is built for that:

- **Agents build each app in plain Python,** with a fraction of the code a custom stack
  needs: no frontend, no backend, and no API between them.
- **The people accountable for the numbers can read every line,** in the language they
  already know.
- **Agents check their own work,** keep the app running as requirements change, and use
  the finished app as a tool.
- **Streamlit owns the hard parts:** the interface, state, caching, sign-in, theming,
  performance, security, accessibility, and upgrades. Every upgrade makes all of your apps
  better at once.

## Get started

```bash
pip install streamlit
```

### Set up your coding agent

```bash
streamlit skills
```

Streamlit ships expert skills for coding agents in every release, written by the team that
builds Streamlit. This one command sets them up for Claude Code, Cortex Code, Codex,
Cursor, GitHub Copilot, and more.

- **Always current.** The skills match the installed version, so agents never write code
  for an API that has changed.
- **Expert by default.** They cover building, styling, speeding up, testing, and deploying
  apps, from layouts and theming to caching, editable tables, chat interfaces, custom
  components, and Snowflake. They also include ready-made dashboard templates.
- **Better apps with every release.** When the skills improve, every app that agents build
  or change afterward improves too.

See the [`streamlit skills` docs](https://docs.streamlit.io/develop/api-reference/cli/skills)
for global installs and non-interactive setup.

### A complete app

Here's a demand plan that computes a forecast, lets planners adjust it, and sends it for
sign-off. Save it as `streamlit_app.py`:

```python
import numpy as np
import pandas as pd
import streamlit as st

st.title("Demand plan")


@st.cache_data
def load_actuals() -> pd.DataFrame:
    # Swap in your own query, e.g. st.connection("snowflake").query("...")
    months = pd.date_range("2025-01-01", periods=12, freq="MS")
    units = 1_000 + 40 * np.arange(12) + np.random.default_rng(0).normal(0, 50, 12)
    return pd.DataFrame({"month": months, "actual": units.round()})


actuals = load_actuals()
growth = st.slider("Monthly growth (%)", -5.0, 10.0, 2.0, step=0.5)

months = pd.date_range("2026-01-01", periods=6, freq="MS")
baseline = actuals["actual"].iloc[-1] * (1 + growth / 100) ** np.arange(1, 7)
forecast = pd.DataFrame({"month": months, "forecast": baseline.round()})

# Planners adjust the forecast in place, and the chart follows
plan = st.data_editor(forecast, disabled=["month"], hide_index=True)
st.line_chart(pd.concat([actuals, plan]), x="month")

if st.button("Submit for sign-off", type="primary"):
    # Write `plan` back to your warehouse here
    st.success(f"Submitted {len(plan)} months for sign-off.")
```

Then run it:

```bash
streamlit run streamlit_app.py
```

This whole app is one file: the query, the forecast, the editable plan, and the sign-off,
with no frontend, no API, and no build step. Real apps grow into
[several pages](https://docs.streamlit.io/develop/concepts/multipage-apps) and modules, and
stay plain Python.

## What teams build

**Apps that compute.** Forecasts with what-if levers, pricing and demand simulators, churn
and risk models, and AI analysis over your data. The computation runs in Python next to
the data, and the computation and the interface are the same code.

**Apps that act.** Review and approval queues, forecast sign-offs, data-quality triage,
planning input, and approving what an AI agent proposes. Editable tables
(`st.data_editor`), forms (`st.form`), and validation let the decision happen in the same
app as the data, with writeback in the same script.

**Advanced dashboards.** KPI and operating dashboards with drill-down, cross-filtered
views over large tables, and live monitoring. Coming from a BI tool? Modernize your
dashboards, don't just copy them: rebuild the ones that matter on governed metrics, check
the numbers against the original, and add what BI couldn't hold: Python logic, writeback,
and AI.

Streamlit is also great for AI and chat apps over your data (`st.chat_input`,
`st.write_stream`), ML and model tools, and internal data tools.

## Built for the whole agent lifecycle

| Stage | What you get                                                                                                                                                                                                                                                                                          |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build | Models already know Streamlit's compact API, and the built-in skills (`streamlit skills`) keep agents on current best practices. An app is a fraction of the code of a custom stack, so it takes fewer tokens to write and has fewer places to break.                                                |
| Check | Agents drive the running app without a browser or screenshots: they set the filters and read the numbers back as data. They also leave behind headless tests ([`AppTest`](https://docs.streamlit.io/develop/concepts/app-testing)) that run in CI.                                                  |
| Own   | The query, the logic, and the number on screen sit side by side in plain Python. Upgrades improve every app at once, security fixes included, on a stable, backward-compatible API.                                                                                                                 |
| Run   | One Python process, no build step. Run it on [Snowflake](https://docs.streamlit.io/deploy/snowflake), in your own cloud, or on [Community Cloud](https://streamlit.io/cloud), with built-in sign-in ([`st.login`](https://docs.streamlit.io/develop/concepts/connections/authentication)).           |
| Use   | Turn on the agent API (`server.enableAgentApi`), and the app is also a tool other agents can call over MCP or HTTP, limited to exactly what the app shows its users. Agents read tables and charts as data, and run through the app's own caches and partial reruns. There's no second API to build. |

## Built for advanced dashboards

Streamlit solves the hard parts of demanding dashboards once in the framework, so every
app gets them for free:

| Strength          | What it means                                                                                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Large data        | Tables load rows as people scroll (`st.dataframe`). Charts receive data in an efficient columnar format. Heavy parts of the page load only when needed.                                                                    |
| Fast to load      | Page sections load in parallel (`@st.fragment(parallel=True)`). Cached data refreshes in the background (`@st.cache_data(refresh_mode="background")`). Loading skeletons (`st.skeleton`) show the layout right away.        |
| Fast to use       | Only the section that changed reruns ([`@st.fragment`](https://docs.streamlit.io/develop/concepts/architecture/fragments)). Inputs can wait until people finish choosing (`on_change="ignore"`, `st.form`), so heavy queries run once. |
| Rich interactions | Select points on a chart, or rows in a table, to cross-filter and drill down (`on_select`). Filters, tabs, and sections live in the URL (`bind="query-params"`), so every view can be shared.                               |
| Layout            | Responsive grids (`st.grid`), dialogs and side drawers (`@st.dialog`), menus, and pagination, with native Vega-Lite, Plotly, and ECharts charts (`st.echarts_chart`).                                                       |
| Operations        | Cache size budgets (`max_size`) and per-function cache metrics keep dashboards predictable in production.                                                                                                                  |

## Ready for the enterprise

**Freedom for developers. Guardrails for the enterprise.** Developers write any business
logic in plain Python, with any library, data source, or model. Security and platform
teams get one focused, consistent surface they can review once and approve for hundreds
of apps.

- **Your brand, one experience.** [Theme](https://docs.streamlit.io/develop/concepts/configuration/theming)
  Streamlit to your brand once, with your colors, fonts, chart palettes, and spacing, and
  share that theme across all your apps. Filtering, sorting, drilling down, editing, and
  navigating work the same way in every app.
- **Secure by default, maintained for you.** Static security analysis runs on every change
  and every week, and AI-driven scans regularly review the Python server and the web
  frontend. Streamlit's own dependencies, including the entire web frontend it ships, are
  checked for known vulnerabilities daily, and fixes ship in regular releases. Data access
  runs on the server, so credentials never reach the browser. See our
  [security policy](https://github.com/streamlit/streamlit/blob/develop/SECURITY.md).
- **Accessible by default.** Streamlit is built to WCAG 2.2 Level A and AA, and publishes
  an [ongoing audit](https://github.com/streamlit/streamlit/blob/develop/wiki/accessibility-wcag.md)
  of its commands and default themes, known gaps included.
- **No ceiling.** For a bespoke screen, add a
  [custom component](https://docs.streamlit.io/develop/concepts/custom-components/components-v2)
  written in React or any frontend framework. Add your own API routes, middleware, and
  startup hooks with [`st.App`](https://docs.streamlit.io/develop/api-reference/server/st.app),
  or mount the app into FastAPI or Starlette.

## When to choose something else

- **Choose a custom web stack** (such as React or Next.js with an API) when the UI itself
  is the product, the app is customer-facing at large scale, it must be mobile-first or
  work offline, or it has design requirements that Streamlit's components and theming
  can't meet, even with custom components.
- **Keep a BI tool** for drag-and-drop self-service exploration by people who don't want
  code, and for pixel-precise paginated reports. Many teams run both.
- **Ask the question in chat** when you need a one-off answer. When the answer needs to
  stay live, take new parameters, be owned and tested, or write decisions back, it becomes
  a Streamlit app.

## Best on Snowflake

Streamlit is Snowflake's native framework for data apps. Apps
[run inside Snowflake](https://docs.streamlit.io/deploy/snowflake), so your data stays on
the platform under Snowflake's access controls. Cortex Code builds apps from a request in
plain words, using Streamlit's skills. Apps query semantic views, so a dashboard shows the
same numbers as the rest of the business, and can call Cortex AI. Everything also works
with any database and any cloud.

## Resources

- Explore our [docs](https://docs.streamlit.io) to learn how Streamlit works.
- Ask questions and get help in our [community forum](https://discuss.streamlit.io).
- Read our [blog](https://blog.streamlit.io) for tips from developers and creators.
- Browse the [gallery](https://streamlit.io/gallery) for apps the community has built.
- Extend Streamlit with [custom components](https://streamlit.io/components).
- Deploy, manage, and share apps for free on [Community Cloud](https://streamlit.io/cloud).
- Help others find your app with the Streamlit GitHub badge:

```markdown
[![Streamlit App](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](URL_TO_YOUR_APP)
```

## Contribute

Thanks for your interest in helping improve Streamlit!

We have paused accepting pull requests from outside the Streamlit maintainer team. You can still
make a valuable contribution by [reporting bugs](https://github.com/streamlit/streamlit/issues/new?template=bug_report.yml),
[requesting features](https://github.com/streamlit/streamlit/issues/new?template=feature_request.yml),
[improving or upvoting existing issues](https://github.com/streamlit/streamlit/issues?q=is%3Aissue%20state%3Aopen%20sort%3Areactions-%2B1-desc),
[commenting on open specs](https://github.com/streamlit/streamlit/issues?q=state%3Aopen%20label%3Achange%3Aspec), creating
[custom components](https://docs.streamlit.io/develop/concepts/custom-components/components-v2),
and contributing to [streamlit-extras](https://github.com/arnaudmiribel/streamlit-extras).

Read our [contribution guide](https://github.com/streamlit/streamlit/blob/develop/CONTRIBUTING.md)
for details.

## License

Streamlit is completely free and open-source and licensed under the [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) license.
