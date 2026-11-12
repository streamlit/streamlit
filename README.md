<br>

<img src="https://user-images.githubusercontent.com/7164864/217935870-c0bc60a3-6fc0-4047-b011-7b4c59488c91.png" alt="Streamlit logo" style="margin-top:50px"></img>

# Streamlit

### Agents build it. Agents use it. Your team owns it.

**Streamlit is the agent-native data app framework:** the open-source Python framework
for data apps and dashboards that coding agents build and data teams own.

[![PyPI downloads](https://img.shields.io/pypi/dm/streamlit?label=PyPI%20downloads)](https://pypi.org/project/streamlit/)
[![GitHub stars](https://img.shields.io/github/stars/streamlit/streamlit?style=flat)](https://github.com/streamlit/streamlit/stargazers)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](https://github.com/streamlit/streamlit/blob/develop/LICENSE)

Apps are plain, readable Python, with no frontend or API layer. Streamlit handles the
interface, state, caching, sign-in, theming, and upgrades, so your team maintains only its
logic and can review every number in the language it already knows.

**The No. 1 Python framework for data apps and dashboards.** Used by millions. Trusted by
thousands of companies, from startups to global enterprises.

## Get started

```bash
pip install streamlit
streamlit skills  # Set up your coding agent
```

[`streamlit skills`](https://docs.streamlit.io/develop/api-reference/cli/skills) sets up
Claude Code, Cortex Code, Codex, Cursor, GitHub Copilot, and other agents with expert
skills written by the Streamlit team. The skills ship with every release and match your
installed version, so agents follow current best practices for layouts, theming,
dashboards, performance, testing, and Snowflake.

Or write an app yourself. Save this as `streamlit_app.py` and run
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

# Planners adjust the forecast in place, and the chart follows
plan = st.data_editor(forecast, disabled=["month"], hide_index=True)
st.line_chart(pd.concat([actuals, plan]), x="month")

if st.button("Submit for sign-off", type="primary"):
    # Write `plan` back to your warehouse here
    st.success(f"Submitted {len(plan)} months for sign-off.")
```

## What teams build

- **Apps that compute:** forecasts with what-if levers, pricing and demand simulators,
  risk models, and AI analysis over your data.
- **Apps that act:** review and approval queues, sign-offs, and planning input, with
  editable tables (`st.data_editor`), forms (`st.form`), and writeback.
- **Advanced dashboards:** KPI and operating dashboards with drill-down and
  cross-filtering over large data.

## Why Streamlit

Generating an app is cheap. Owning it isn't.

- **Less code to own.** One layer of Python replaces a frontend, a backend, and the API
  between them, so there's less to generate, review, and keep in sync.
- **Agents check their own work.** They drive the running app without a browser, and leave
  headless tests behind ([`AppTest`](https://docs.streamlit.io/develop/concepts/app-testing)).
- **Apps are tools for agents.** Turn on the agent API (`server.enableAgentApi`), and other
  agents can call the app over MCP or HTTP, with the same logic and access rules as the
  browser.
- **Dashboard performance built in.** Tables that load rows as you scroll, partial and
  parallel reruns (`@st.fragment`), background cache refresh (`@st.cache_data`),
  cross-filtering selections (`on_select`), and views shared by URL
  (`bind="query-params"`).
- **Enterprise guardrails.** Built-in sign-in (`st.login`), one brand theme across apps,
  continuous security scanning with fixes in regular releases, and accessibility built to
  [WCAG 2.2 A and AA](https://github.com/streamlit/streamlit/blob/develop/wiki/accessibility-wcag.md).
- **No ceiling.** Add [custom components](https://docs.streamlit.io/develop/concepts/custom-components/components-v2)
  in React or any frontend framework, and your own API routes and middleware with
  [`st.App`](https://docs.streamlit.io/develop/api-reference/server/st.app).
- **Runs anywhere Python runs,** in your own cloud, on
  [Community Cloud](https://streamlit.io/cloud), and natively
  [inside Snowflake](https://docs.streamlit.io/deploy/snowflake).

## Resources

- [Docs](https://docs.streamlit.io) to learn how Streamlit works
- [Community forum](https://discuss.streamlit.io) for questions and help
- [Blog](https://blog.streamlit.io) for tips from developers and creators
- [Gallery](https://streamlit.io/gallery) for apps the community has built
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
