# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""
Test script to demonstrate area chart improvements:
1. Removed bottom padding
2. Better axis scaling for high values
"""

import streamlit as st

# High-value data similar to the image (MiB/KiB scale)
# Simulating gzip size data that changes slightly but numbers are high
base_size_mib = 8.4
data_points = 30

# Generate data with small variations around 8.4 MiB
# Converting to KiB for more granular changes
base_size_kib = base_size_mib * 1024  # ~8601.6 KiB
changes_kib = [-947.9, -900, -850, -800, -750, -700, -650, -600, -550, -500,
               -450, -400, -350, -300, -250, -200, -150, -100, -50, 0,
               50, 100, 150, 200, 250, 300, 350, 400, 450, 500]

# Create chart data: current size minus the changes (showing progression)
chart_data = [base_size_kib - change for change in changes_kib]

# Current value and delta
current_value_kib = chart_data[-1]
delta_kib = chart_data[-1] - chart_data[0]  # -947.9 KiB

st.title("Area Chart Improvements Test")

st.markdown("""
### Test Case: High-Value Data with Small Changes

This demonstrates the improvements to area charts:
1. **Removed bottom padding** - Area chart should align with line/bar charts
2. **Better axis scaling** - Y-axis should adjust to data range, making small changes visible

The data represents file sizes around 8.4 MiB with small variations.
""")

# Display the metric with area chart
st.metric(
    label="Total Gzip Size",
    value=f"{base_size_mib:.1f} MiB",
    delta=f"{delta_kib:.1f} KiB",
    delta_color="normal",
    chart_data=chart_data,
    chart_type="area",
    border=True,
    help="This area chart should have no bottom padding and better axis scaling"
)

# Comparison: Show all three chart types side by side
st.markdown("### Comparison: Line vs Area vs Bar")

col1, col2, col3 = st.columns(3)

with col1:
    st.metric(
        "Line Chart",
        f"{base_size_mib:.1f} MiB",
        f"{delta_kib:.1f} KiB",
        chart_data=chart_data,
        chart_type="line",
        border=True,
    )

with col2:
    st.metric(
        "Area Chart",
        f"{base_size_mib:.1f} MiB",
        f"{delta_kib:.1f} KiB",
        chart_data=chart_data,
        chart_type="area",
        border=True,
    )

with col3:
    st.metric(
        "Bar Chart",
        f"{base_size_mib:.1f} MiB",
        f"{delta_kib:.1f} KiB",
        chart_data=chart_data,
        chart_type="bar",
        border=True,
    )

st.markdown("""
**Expected Results:**
- All three charts should have the same height
- Area chart should align at the bottom with line/bar charts (no extra padding)
- Area chart y-axis should scale to show the data variation clearly
- The green area should fill more of the vertical space, making the trend more visible
""")
