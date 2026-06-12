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

st.set_page_config(
    page_title="st.lens Demo",
)
st.title("st.lens Demo")


rng = np.random.default_rng(seed=42)
days = pd.date_range("2026-01-01", periods=90, freq="D")
trend = 100 + np.cumsum(rng.normal(size=90) * 0.8)
noise = rng.normal(size=90) * 0.3
values = (trend + noise).round(2)

df = pd.DataFrame(
    {
        "Date": days,
        "Value": values,
        "Avg": pd.Series(values).rolling(7).mean().round(2),
    }
)

products = pd.DataFrame(
    {
        "Product": ["Alpha", "Beta", "Gamma", "Delta"],
        "Sales": [1240, 980, 730, 2100],
        "Revenue": [248000, 176400, 219000, 105000],
        "Growth": [12.4, 8.7, 22.1, -3.2],
    }
)


def analyze(snapshot: str, prompt: str) -> str:
    text = snapshot[:4000] if snapshot else prompt

    api_key = os.environ.get("AZURE_OPENAI_API_KEY")
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    deploy = os.environ.get("DEPLOY_NAME")

    if api_key and endpoint and deploy:
        try:
            from openai import AzureOpenAI

            client = AzureOpenAI(
                api_key=api_key,
                api_version="2025-01-01-preview",
                azure_endpoint=endpoint,
            )
            resp = client.chat.completions.create(
                model=deploy,
                messages=[
                    {
                        "role": "system",
                        "content": "Answer the user's question based on the data provided.",
                    },
                    {"role": "user", "content": f"Data:\n{text}\n\nQuestion: {prompt}"},
                ],
                max_completion_tokens=500,
            )
            return resp.choices[0].message.content or "(empty)"
        except Exception as e:
            return f"Error: {e}"

    return f"Analysis: {prompt} (set AZURE env vars for live AI)"


if "lens_key" not in st.session_state:
    st.session_state.lens_key = 0


col1, col2 = st.columns([3, 1])

with col2:
    st.subheader("Controls")

    if st.button("Open Lens", type="primary", use_container_width=True):
        st.session_state.lens_key += 1
        st.rerun()

    st.divider()

    lens = st.lens(
        label="Data Lens",
        key=f"lens_{st.session_state.lens_key}",
        on_result=analyze,
    )
    if lens:
        st.info(f"Result: {lens}")

with col1:
    tab1, tab2 = st.tabs(["Chart", "Data"])

    with tab1:
        st.subheader("Revenue Trend")
        st.line_chart(
            df.set_index("Date")[["Value", "Avg"]],
            use_container_width=True,
            height=400,
        )

    with tab2:
        st.subheader("Products")
        st.dataframe(products, use_container_width=True, hide_index=True)
