# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# ruff: noqa: INP001
import os

import numpy as np
import pandas as pd

import streamlit as st

st.set_page_config(page_title="st.lens — Pro Demo")

st.title("🔍 st.lens")
st.markdown("##### AI-Augmented Data Lens — drag, ask, analyze.")

# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------

rng = np.random.default_rng(seed=42)
days = pd.date_range("2026-01-01", periods=120, freq="D")
trend = 200 + np.cumsum(rng.normal(size=120) * 1.2)
seasonal = 15 * np.sin(np.linspace(0, 6 * np.pi, 120))
noise = rng.normal(size=120) * 0.5
revenue = (trend + seasonal + noise).round(2)
units = (revenue / rng.uniform(80, 200, size=120)).round(0).astype(int)

df_sales = pd.DataFrame(
    {
        "Date": days,
        "Revenue": revenue,
        "Units Sold": units,
        "MA_14": pd.Series(revenue).rolling(14).mean().round(2),
    }
)

df_products = pd.DataFrame(
    {
        "Product": [
            "Analytics Pro",
            "DataViz Suite",
            "ML Engine",
            "Dashboard Lite",
            "Stream Connect",
        ],
        "Category": ["SaaS", "Analytics", "AI/ML", "Dashboarding", "Infrastructure"],
        "Units Sold": [1_240, 980, 730, 2_100, 1_560],
        "Revenue": [248_000, 176_400, 219_000, 105_000, 280_800],
        "Growth": [12.4, 8.7, 22.1, -3.2, 18.9],
    }
)

# ---------------------------------------------------------------------------
# AI callback
# ---------------------------------------------------------------------------


def analyze(snapshot: bytes | str, prompt: str) -> str:
    import base64

    if isinstance(snapshot, bytes):
        try:
            text = snapshot.decode("utf-8")
        except Exception:
            text = ""
    else:
        text = snapshot

    if text and not any(c in text for c in " \n|"):
        try:
            raw = base64.b64decode(text, validate=True)
            text = raw.decode("utf-8", errors="replace")
        except Exception:  # noqa: S110
            pass

    text = text[:4000] if text else prompt
    word_count = sum(c.isalnum() or c.isspace() for c in text)
    if word_count < 30:
        text = prompt

    env_key = os.environ.get("AZURE_OPENAI_API_KEY")
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    deploy = os.environ.get("DEPLOY_NAME")

    if env_key and endpoint and deploy:
        try:
            from openai import AzureOpenAI

            client = AzureOpenAI(
                api_key=env_key,
                api_version="2025-01-01-preview",
                azure_endpoint=endpoint,
            )
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are a data analyst. Answer the user's question based on the "
                        "data snapshot provided. Be concise and cite specific numbers."
                    ),
                },
                {"role": "user", "content": f"Data:\n{text}\n\nQuestion: {prompt}"},
            ]
            resp = client.chat.completions.create(
                model=deploy,
                messages=messages,  # type: ignore[arg-type]
                max_completion_tokens=500,
            )
            return resp.choices[0].message.content or "_(empty response)_"
        except Exception as e:
            return f"⚠️ AI call failed: {e}"
    return (
        f"Analysis for: **{prompt}** — Set AZURE_OPENAI_API_KEY, "
        "AZURE_OPENAI_ENDPOINT, and DEPLOY_NAME env vars for live AI."
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

tab1, tab2 = st.tabs(["📈 Revenue", "📊 Products"])

with tab1:
    st.subheader("Revenue & 14-Day Moving Average")
    st.line_chart(
        df_sales.set_index("Date")[["Revenue", "MA_14"]],
        use_container_width=True,
        height=400,
    )
    st.caption(
        "120-day simulated revenue with rolling average. "
        "Drag the lens over this chart and ask about peaks or trends."
    )

with tab2:
    st.subheader("Product Performance")

    highlight_growth = df_products["Growth"].apply(
        lambda x: (
            f":green[+{x}%]" if x > 10 else f":orange[{x}%]" if x > 0 else f":red[{x}%]"
        )
    )
    display = df_products.copy()
    display["Growth"] = highlight_growth
    display["Revenue"] = display["Revenue"].apply(lambda x: f"${x:,.0f}")

    st.dataframe(
        display,
        column_config={
            "Product": st.column_config.TextColumn("Product"),
            "Category": st.column_config.TextColumn("Category"),
            "Units Sold": st.column_config.NumberColumn("Units Sold", format="%d"),
            "Revenue": st.column_config.TextColumn("Revenue"),
            "Growth": st.column_config.TextColumn("Growth"),
        },
        use_container_width=True,
        hide_index=True,
    )

    lens_products = st.lens(
        label_visibility="collapsed",
        key="lens_products",
        target_key=None,
        on_result=analyze,
        help="Analyze the product table above.",
    )
    if lens_products:
        st.success(f"**Result:** {lens_products}")

# ---------------------------------------------------------------------------
# Footer
# ---------------------------------------------------------------------------

st.divider()
st.caption("Built with `st.lens` — experimental AI overlay · Streamlit ❄️")
