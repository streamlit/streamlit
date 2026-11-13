<br>

<img src="https://user-images.githubusercontent.com/7164864/217935870-c0bc60a3-6fc0-4047-b011-7b4c59488c91.png" alt="Streamlit logo" style="margin-top:50px"></img>

# Streamlit

### Built in Python. Made for people and agents. Owned by your team.

**Streamlit is the open-source, agent-native data app framework.** Use it for dashboards,
forecasting tools, review-and-approval workflows, and any other app built around your
data.

[![PyPI downloads](https://img.shields.io/pypi/dm/streamlit?label=PyPI%20downloads)](https://pypi.org/project/streamlit/)
[![GitHub stars](https://img.shields.io/github/stars/streamlit/streamlit?style=flat)](https://github.com/streamlit/streamlit/stargazers)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](https://github.com/streamlit/streamlit/blob/develop/LICENSE)

A Streamlit app is just Python, with no separate frontend or API layer. Streamlit is
batteries-included and takes care of the hard parts: a consistent, well-designed
interface, state, caching, sign-in, theming, and upgrades. Your team keeps only its own
logic, written in a language it already reads every day.

**The No. 1 Python framework for data apps and dashboards.**
[More than a million repositories](https://github.com/streamlit/streamlit/network/dependents)
on GitHub depend on it. Used by millions. Trusted by thousands of companies, from startups
to global enterprises.

## Get started

```bash
pip install streamlit
streamlit skills  # Set up your coding agent
```

Run [`streamlit skills`](https://docs.streamlit.io/develop/api-reference/cli/skills) in
your project folder to install our expert skills, for Claude Code and for any agent that
reads the shared `.agents` skills folder. We write them ourselves, ship them with every
release, and match them to the version you have installed. So your agent follows current
best practices for layouts, theming, dashboards, performance, testing, and Snowflake,
instead of whatever it memorized two versions ago.

Then just ask, and mention Streamlit so the agent picks up the skills: "Build a Streamlit
app that forecasts demand from `sales.csv`, with what-if levers for price and growth." In
Claude Code, you can also invoke the skill directly with `/developing-with-streamlit`.

Prefer to write it yourself? Here's a complete app: a demand forecast that planners can
adjust and send for sign-off. Save it as `streamlit_app.py` and run
`streamlit run streamlit_app.py`:

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

# Planners edit the forecast, and the chart follows
plan = st.data_editor(forecast, disabled=["month"], hide_index=True)
st.line_chart(pd.concat([actuals, plan]), x="month")

if st.button("Submit for sign-off", type="primary"):
    # Write `plan` back to your warehouse here
    st.success(f"Submitted {len(plan)} months for sign-off.")
```

## What teams build

- **[Apps that compute](https://apps-that-compute-demo.streamlit.app/):** forecasts with
  what-if levers, pricing and demand simulators, risk models, and AI analysis over your
  data.
- **[Apps that act](https://apps-that-act-demo.streamlit.app/):** review and approval
  queues, sign-offs, and planning input, with editable tables (`st.data_editor`), forms
  (`st.form`), and writeback.
- **[Advanced dashboards](https://advanced-dashboard-demo.streamlit.app/):** KPI and
  operating dashboards with drill-down and cross-filtering over large data. Coming from a
  BI tool? Move your dashboards to Streamlit, and modernize them on the way.

Each one is a live demo you can click through, and the source is in
[streamlit/demos](https://github.com/streamlit/demos). Streamlit is also great for AI and
chat apps over your data (`st.chat_input`, `st.write_stream`), ML and model tools, and
internal data tools.

## Why Streamlit

**Generating an app is cheap. Owning it isn't.** An agent can write a React frontend, a
Python backend, and the API between them in an afternoon. Then someone has to review all
three, keep them in sync, and patch them for years. With Streamlit, it's one layer of
Python, and the rest is our job.

- **Made for data.** Hand a pandas, Polars, Snowpark, or PySpark dataframe straight to a
  table or chart. Tables load rows as you scroll, so they stay fast on large data. Native
  charts cover nearly every visualization, from KPI sparklines to maps and diagrams, and
  Vega-Lite and ECharts charts switch to faster rendering on their own as the data grows.
- **Fast dashboards.** Only the part of the page that changed reruns (`@st.fragment`), and
  cached data refreshes in the background (`@st.cache_data`). Click a point on a chart or
  a row in a table to cross-filter the page (`on_select`). Filters live in the URL
  (`bind="query-params"`), so every view is shareable.
- **Free on the logic. Opinionated on the design.** Write any logic you like, with any
  Python library. The look comes from Streamlit: native charts, tables, and filters,
  styled by one [brand theme](https://docs.streamlit.io/develop/concepts/configuration/theming)
  that all your apps share. App number 200 looks like it belongs with app number one, no
  matter who, or what, built it.
- **Stable for years.** Breaking changes are extremely rare. Most apps written years ago
  still run on the latest release, and every upgrade brings them new features, speed, and
  security fixes.
- **Agents check their own work.** They drive the running app without a browser, read the
  numbers back as data, and leave tests behind for CI
  ([`AppTest`](https://docs.streamlit.io/develop/concepts/app-testing)).
- **Your apps are tools for agents, too.** Turn on the experimental agent API
  (`server.enableAgentApi`), and Claude, ChatGPT, Cursor, or any other MCP client can use
  your app with the same logic and access rules as a person in the browser. There's no
  second API to build.
- **Enterprise guardrails.** Built-in sign-in (`st.login`), security scanning on every
  change with fixes in regular releases, and accessibility built to WCAG 2.2 A and AA,
  with a [published audit](https://github.com/streamlit/streamlit/blob/develop/wiki/accessibility-wcag.md).
- **No ceiling.** Need a bespoke screen? Drop in a
  [custom component](https://docs.streamlit.io/develop/concepts/custom-components/components-v2)
  written in React or anything else. Need a webhook or your own API route? Add it with
  [`st.App`](https://docs.streamlit.io/develop/api-reference/server/st.app).
- **Runs anywhere Python runs:** your own cloud, [Community Cloud](https://streamlit.io/cloud),
  or natively [inside Snowflake](https://docs.streamlit.io/deploy/snowflake).

## Resources

- [Docs](https://docs.streamlit.io) to learn how Streamlit works
- [Community forum](https://discuss.streamlit.io) for questions and help
- [Blog](https://blog.streamlit.io) for tips from developers and creators
- [Components](https://streamlit.io/components) to extend Streamlit

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
