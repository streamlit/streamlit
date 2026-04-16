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

"""
Streamlit Element Explorer - Theme Demo

A comprehensive single-page app showcasing all major Streamlit components
with custom theming. Use this to preview how your theme looks across
different element types.
"""
# DO NOT EDIT — managed by manage.py, edit _shared/streamlit_app.py instead

import numpy as np
import pandas as pd

import streamlit as st

st.set_page_config(page_title="Element Explorer", page_icon="🎨", layout="wide")

# Initialize sample data in session state
if "chart_data" not in st.session_state:
    np.random.seed(42)
    st.session_state.chart_data = pd.DataFrame(
        np.random.randn(20, 3), columns=["a", "b", "c"]
    )

chart_data = st.session_state.chart_data

st.title("Streamlit Element Explorer")
st.markdown(
    "Explore how Streamlit's built-in elements look with this theme. "
    "Select a category below to preview different components."
)

# Navigation using segmented_control for better performance
section = st.segmented_control(
    "Section",
    ["Widgets", "Data", "Charts", "Text", "Layouts", "Chat", "Status"],
    default="Widgets",
    label_visibility="collapsed",
)

st.divider()

# -----------------------------------------------------------------------------
# WIDGETS SECTION
# -----------------------------------------------------------------------------
if section == "Widgets":
    st.header("Widgets")

    # Buttons
    st.subheader("Buttons")
    cols = st.columns(4)
    cols[0].button("Primary", type="primary")
    cols[1].button("Secondary", type="secondary")
    cols[2].button("Tertiary", type="tertiary")
    cols[3].link_button(
        "Link", url="https://streamlit.io", icon=":material/open_in_new:"
    )

    # Form
    with st.form(key="demo_form"):
        st.subheader("Form")
        form_cols = st.columns(2)
        form_cols[0].text_input("Name", placeholder="Enter your name")
        form_cols[1].text_input("Email", placeholder="you@example.com")
        st.form_submit_button("Submit", type="primary", use_container_width=True)

    # Selection widgets
    st.subheader("Selection Widgets")
    sel_cols = st.columns(2)

    with sel_cols[0]:
        st.checkbox("Checkbox option")
        st.toggle("Toggle switch")
        st.selectbox("Selectbox", options=["Option A", "Option B", "Option C"])
        st.multiselect(
            "Multiselect", options=["Tag 1", "Tag 2", "Tag 3"], default=["Tag 1"]
        )

    with sel_cols[1]:
        st.radio(
            "Radio buttons",
            options=["Choice 1", "Choice 2", "Choice 3"],
            horizontal=True,
        )
        st.pills("Pills", options=["Small", "Medium", "Large"], default="Medium")
        st.segmented_control(
            "Segmented", options=["Day", "Week", "Month"], default="Week"
        )
        st.caption("Feedback widget")
        st.feedback("stars")

    # Numeric & Sliders
    st.subheader("Numeric Inputs")
    num_cols = st.columns(3)
    num_cols[0].number_input("Number input", value=42)
    num_cols[1].slider("Slider", 0, 100, 50)
    num_cols[2].select_slider(
        "Select slider", options=["XS", "S", "M", "L", "XL"], value="M"
    )

    # Date/Time
    st.subheader("Date & Time")
    dt_cols = st.columns(2)
    dt_cols[0].date_input("Date input")
    dt_cols[1].time_input("Time input")

    # Text inputs
    st.subheader("Text Inputs")
    txt_cols = st.columns(2)
    txt_cols[0].text_input("Text input", placeholder="Type something...")
    txt_cols[1].text_area(
        "Text area", placeholder="Longer text goes here...", height=100
    )

    # File upload
    st.subheader("File Upload")
    st.file_uploader("Upload a file", type=["csv", "txt", "pdf"])

# -----------------------------------------------------------------------------
# DATA SECTION
# -----------------------------------------------------------------------------
elif section == "Data":
    st.header("Data Display")

    # Metrics
    st.subheader("Metrics")
    m_cols = st.columns(4)
    m_cols[0].metric("Revenue", "$45,231", "+12.5%")
    m_cols[1].metric("Users", "2,847", "+8.2%")
    m_cols[2].metric("Conversion", "3.24%", "-0.4%", delta_color="inverse")
    m_cols[3].metric("Avg. Session", "4m 32s", "+1.2%")

    st.divider()

    # Dataframe
    st.subheader("Dataframe")
    df = pd.DataFrame(
        {
            "Name": ["Alice", "Bob", "Charlie", "Diana", "Eve"],
            "Department": ["Engineering", "Sales", "Marketing", "Engineering", "Sales"],
            "Salary": [95000, 78000, 82000, 105000, 71000],
            "Start Date": pd.date_range("2022-01-15", periods=5, freq="3M"),
            "Active": [True, True, False, True, True],
        }
    )
    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
        column_config={
            "Salary": st.column_config.NumberColumn(format="$%d"),
            "Start Date": st.column_config.DateColumn(format="MMM DD, YYYY"),
            "Active": st.column_config.CheckboxColumn("Active?"),
        },
    )

    # Table
    st.subheader("Static Table")
    st.table(chart_data.head(5))

    # JSON
    st.subheader("JSON Display")
    st.json(
        {
            "name": "Streamlit",
            "version": "1.41.0",
            "features": ["themes", "widgets", "charts"],
        }
    )

# -----------------------------------------------------------------------------
# CHARTS SECTION
# -----------------------------------------------------------------------------
elif section == "Charts":
    st.header("Charts")

    chart_cols = st.columns(2)

    with chart_cols[0]:
        st.subheader("Line Chart")
        st.line_chart(chart_data, height=250)

        st.subheader("Bar Chart")
        st.bar_chart(chart_data, height=250)

    with chart_cols[1]:
        st.subheader("Area Chart")
        st.area_chart(chart_data, height=250)

        st.subheader("Scatter Chart")
        st.scatter_chart(chart_data, height=250)

# -----------------------------------------------------------------------------
# TEXT SECTION
# -----------------------------------------------------------------------------
elif section == "Text":
    st.header("Text Elements")

    # Headers
    st.subheader("Headers")
    st.title("Title Element")
    st.header("Header Element")
    st.subheader("Subheader Element")
    st.caption("Caption text - smaller, muted")

    st.divider()

    # Markdown
    st.subheader("Markdown Formatting")
    st.markdown(
        "**Bold text**, *italic text*, ~~strikethrough~~, "
        "`inline code`, [link](https://streamlit.io)"
    )
    st.markdown(
        "Math: $E = mc^2$ and $\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$"
    )
    st.markdown("Emojis: 🚀 🎨 📊 ✨ and icons: :material/home: :material/settings:")

    # Colored text
    st.subheader("Colored Text")
    color_cols = st.columns(3)
    color_cols[0].markdown(":red[Red text] and :orange[Orange text]")
    color_cols[1].markdown(":green[Green text] and :blue[Blue text]")
    color_cols[2].markdown(":violet[Violet text] and :rainbow[Rainbow text]")

    # Code blocks
    st.subheader("Code Block")
    st.code(
        """import streamlit as st

# Create a themed dashboard
st.set_page_config(page_title="My App", layout="wide")
st.title("Hello, Streamlit!")

# Display metrics
col1, col2 = st.columns(2)
col1.metric("Users", "1,234", "+5%")
col2.metric("Revenue", "$56K", "+12%")""",
        language="python",
    )

# -----------------------------------------------------------------------------
# LAYOUTS SECTION
# -----------------------------------------------------------------------------
elif section == "Layouts":
    st.header("Layout Elements")

    # Columns
    st.subheader("Columns with Borders")
    layout_cols = st.columns(3, border=True)
    layout_cols[0].write("**Column 1**\n\nFirst column content")
    layout_cols[1].write("**Column 2**\n\nSecond column content")
    layout_cols[2].write("**Column 3**\n\nThird column content")

    # Tabs
    st.subheader("Tabs")
    tab1, tab2, tab3 = st.tabs(["📈 Chart", "📋 Data", "⚙️ Settings"])
    with tab1:
        st.write("Chart tab content")
        st.line_chart(chart_data["a"], height=150)
    with tab2:
        st.write("Data tab content")
        st.dataframe(chart_data.head(3))
    with tab3:
        st.write("Settings tab content")
        st.checkbox("Enable feature X")
        st.checkbox("Enable feature Y", value=True)

    # Expander
    st.subheader("Expander")
    with st.expander("Click to expand"):
        st.write("This content is hidden by default.")
        st.image("https://placehold.co/400x200/29B5E8/white?text=Expanded+Content")

    # Popover
    st.subheader("Popover")
    pop_cols = st.columns(3)
    with pop_cols[0].popover("Open popover", icon=":material/info:"):
        st.write("Popover content here!")
        st.slider("Popover slider", 0, 100, 50)

    # Container
    st.subheader("Container with Border")
    with st.container(border=True):
        st.write("**Bordered Container**")
        st.write("Content inside a container with a visible border.")
        st.button("Button inside container")

# -----------------------------------------------------------------------------
# CHAT SECTION
# -----------------------------------------------------------------------------
elif section == "Chat":
    st.header("Chat Elements")

    # Chat messages
    st.subheader("Chat Messages")
    with st.chat_message("user"):
        st.write("Hello! How can I analyze my sales data?")

    with st.chat_message("assistant"):
        st.write("I can help you with that! Here are a few options:")
        st.markdown("""
        1. **Revenue trends** - View monthly/quarterly patterns
        2. **Top products** - Identify best sellers
        3. **Customer segments** - Analyze by region or category
        """)

    with st.chat_message("user"):
        st.write("Show me the revenue trends please.")

    with st.chat_message("assistant"):
        st.write("Here's your revenue trend for the past 20 periods:")
        st.line_chart(chart_data["a"], height=200)

    # Chat input
    st.chat_input("Type a message...")

# -----------------------------------------------------------------------------
# STATUS SECTION
# -----------------------------------------------------------------------------
elif section == "Status":
    st.header("Status Elements")

    # Alert messages
    st.subheader("Alert Messages")
    st.error("Error: Something went wrong with the data pipeline.")
    st.warning("Warning: API rate limit approaching (80% used).")
    st.info("Info: New features available in the latest release.")
    st.success("Success: Data exported successfully to warehouse.")

    # Exception
    st.subheader("Exception Display")
    try:
        raise ValueError("This is an example exception for demonstration")
    except ValueError as e:
        st.exception(e)

    # Interactive status
    st.subheader("Interactive Status")
    status_cols = st.columns(3)
    if status_cols[0].button("Show Toast", icon=":material/notifications:"):
        st.toast("This is a toast notification!", icon="🔔")
    if status_cols[1].button("Balloons", icon=":material/celebration:"):
        st.balloons()
    if status_cols[2].button("Snow", icon=":material/ac_unit:"):
        st.snow()

    # Progress
    st.subheader("Progress Indicators")
    st.progress(0.7, text="70% complete")
    with st.spinner("Loading..."):
        st.write("Spinner is active (non-blocking in this demo)")

# -----------------------------------------------------------------------------
# SIDEBAR
# -----------------------------------------------------------------------------
with st.sidebar:
    st.header("Settings")
    st.selectbox(
        "Time Period", ["Last 7 days", "Last 30 days", "Last 90 days", "All time"]
    )
    st.multiselect(
        "Metrics", ["Revenue", "Users", "Sessions"], default=["Revenue", "Users"]
    )
    st.slider("Confidence threshold", 0.0, 1.0, 0.8)
    st.divider()
    st.caption("Element Explorer v1.0")
    st.caption("Theme: **Snowflake**")
