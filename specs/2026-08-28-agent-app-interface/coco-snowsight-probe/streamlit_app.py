"""Probe app for measuring how an MCP client handles the agent API's results.

Each page isolates one question, and pages keep each result small apart from
what is being measured:

- Payload: how large a tool result the client accepts, and what happens past
  that. The agent sets `payload_kb`, and the result grows by about that much.
- Table: whether the client fetches `data.url` and reads Arrow, because the
  questions about it need every row, not the inline preview.
- Charts: what a client can read from chart data alone.
- Media: whether the client follows image and PDF URLs.

Run locally with:

    streamlit run streamlit_app.py --server.enableAgentApi true
"""

# An app directory, not a package.
# ruff: noqa: INP001

from __future__ import annotations

import plotly.express as px
import probe_data

import streamlit as st


def payload_page() -> None:
    payload_kb = st.number_input(
        "Payload size (KB)",
        min_value=0,
        max_value=8192,
        value=0,
        step=1,
        key="payload_kb",
        help="Adds about this many kilobytes of numbered text to the result.",
    )
    if payload_kb:
        text = probe_data.payload_text(int(payload_kb))
        st.caption(f"The text below is {len(text):,} characters.")
        st.text(text)


def table_page() -> None:
    st.caption(f"{probe_data.TABLE_ROWS:,} orders. Revenue is units times unit_price.")
    st.dataframe(probe_data.sales_table(), key="orders")


def charts_page() -> None:
    series = probe_data.chart_series()
    st.line_chart(series, x="day", y="value")
    st.plotly_chart(
        px.scatter(series, x="day", y="value", title="Daily value (Plotly)"),
        key="plotly_series",
    )


def media_page() -> None:
    st.image(probe_data.image_pixels())
    st.pdf(probe_data.pdf_bytes(), height=200)
    st.download_button(
        "Download the PDF",
        probe_data.pdf_bytes(),
        file_name="probe.pdf",
        mime="application/pdf",
    )


st.set_page_config(page_title="Agent API probe", layout="wide")
page = st.navigation(
    [
        st.Page(payload_page, title="Payload", url_path="payload"),
        st.Page(table_page, title="Table", url_path="table"),
        st.Page(charts_page, title="Charts", url_path="charts"),
        st.Page(media_page, title="Media", url_path="media"),
    ]
)
st.title("Agent API probe")
st.caption("Synthetic content for measuring MCP client limits.")
page.run()
