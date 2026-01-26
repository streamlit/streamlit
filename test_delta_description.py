#!/usr/bin/env python3
"""
Test script for the delta_description feature in st.metric()

This script tests that the new delta_description parameter works correctly
and displays the description text next to the delta value.
"""

import streamlit as st

st.set_page_config(page_title="Metric Delta Description Test", layout="centered")

st.title("st.metric() Delta Description Test")

st.write("""
This page demonstrates the new `delta_description` parameter for `st.metric()`.
The delta_description parameter allows you to show contextual text next to the
delta value, making it clearer what the change represents.
""")

st.divider()

# Example 1: Sales metric with delta_description
st.subheader("Example 1: Sales with 'month over month' description")
st.metric(
    label="Sales",
    value="$2,297,201",
    delta="-29.2%",
    delta_color="inverse",
    delta_description="month over month"
)

st.divider()

# Example 2: Users metric with description
st.subheader("Example 2: Active Users with 'from last week' description")
st.metric(
    label="Active Users",
    value=12345,
    delta=234,
    delta_description="from last week"
)

st.divider()

# Example 3: Temperature metric
st.subheader("Example 3: Temperature with 'from yesterday' description")
st.metric(
    label="Temperature",
    value="72°F",
    delta="5°F",
    delta_description="from yesterday"
)

st.divider()

# Example 4: Without delta_description (should still work)
st.subheader("Example 4: Without delta_description (backwards compatibility)")
st.metric(
    label="Response Time",
    value="245ms",
    delta="-12ms"
)

st.divider()

# Example 5: Multiple metrics in columns
st.subheader("Example 5: Multiple metrics in columns with descriptions")
col1, col2, col3 = st.columns(3)

with col1:
    st.metric(
        label="Revenue",
        value="$100K",
        delta="+20%",
        delta_description="vs Q3"
    )

with col2:
    st.metric(
        label="Customers",
        value=1234,
        delta=-45,
        delta_color="inverse",
        delta_description="from Q3"
    )

with col3:
    st.metric(
        label="Efficiency",
        value="94%",
        delta="+2%",
        delta_description="from baseline"
    )

st.info("""
If you can see the descriptions next to the delta values
(e.g., "month over month", "from last week"), the feature is working correctly!
""")
