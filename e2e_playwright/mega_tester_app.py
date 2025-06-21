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

from __future__ import annotations

import time
from pathlib import Path

import altair as alt
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import plotly.express as px
import pydeck as pdk

import streamlit as st

TEST_ASSETS_DIR = Path(__file__).parent / "test_assets"
FLOWER_VIDEO_PATH = TEST_ASSETS_DIR / "flower.webm"
CAT_AUDIO_PATH = TEST_ASSETS_DIR / "cat-purr.mp3"
STREAMLIT_LOGO_PATH = TEST_ASSETS_DIR / "streamlit-logo.png"
STREAMLIT_LOGO_SMALL_PATH = TEST_ASSETS_DIR / "streamlit-logo-small.png"

st.set_page_config("Mega tester app", "🎈")
st.logo(STREAMLIT_LOGO_SMALL_PATH, size="small")
st.title("🎈 Mega tester app")


def page1():
    pass


def page2():
    pass


def page3():
    pass


st.navigation(
    {
        "General": [
            st.Page(page1, title="Home", icon=":material/home:"),
            st.Page(page2, title="Data visualizations", icon=":material/monitoring:"),
        ],
        "Admin": [st.Page(page3, title="Settings", icon=":material/settings:")],
    }
)


"## Write and magic"
st.write("st.write")
"magic"


"## Text elements"
st.markdown("st.markdown")
st.markdown(
    "Markdown features: **bold** *italic* ~strikethrough~ [link](https://streamlit.io) `code` $a=b$ 🐶 :cat: "
    ":material/home: :streamlit: <- -> <-> -- >= <= ~= :small[small]"
)
st.markdown("""
Text colors:

:blue[blue] :green[green] :orange[orange] :red[red] :violet[violet] :gray[gray] :rainbow[rainbow] :primary[primary]

:blue-background[blue] :green-background[green] :orange-background[orange] :red-background[red]
:violet-background[violet] :gray-background[gray] :rainbow-background[rainbow] :primary-background[primary]

:blue-badge[blue] :green-badge[green] :orange-badge[orange] :red-badge[red] :violet-badge[violet]
:gray-badge[gray] :primary-badge[primary]
""")
st.title("st.title", help="Hello!")
st.header("st.header", help="Hello!")
st.header("st.header with blue divider", divider="blue")
st.header("st.header with green divider", divider="green")
st.header("st.header with orange divider", divider="orange")
st.header("st.header with red divider", divider="red")
st.header("st.header with violet divider", divider="violet")
st.header("st.header with gray divider", divider="gray")
st.header("st.header with rainbow divider", divider="rainbow")
st.subheader("st.subheader", help="Hello!")
st.badge("st.badge", icon=":material/home:", color="green")
st.caption("st.caption", help="Hello!")
st.code("# st.code\na = 1234")
st.code("# st.code with line numbers\na = 1234", line_numbers=True)
st.code(
    '# st.code with line wrapping\na = "This is a very very very very very very very very very very '
    'very very long string"',
    wrap_lines=True,
)
with st.echo():
    st.write("st.echo")
st.latex(r"\int a x^2 \,dx", help="Hello!")
st.text("st.text", help="Hello!")
st.divider()


"## Data elements"
np.random.seed(42)
data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])

"st.dataframe"
st.dataframe(data)

"st.data_editor"
st.data_editor(data)

"st.column_config"
data_df = pd.DataFrame(
    {
        "column": ["foo", "bar", "baz"],
        "text": ["foo", "bar", "baz"],
        "number": [1, 2, 3],
        "checkbox": [True, False, True],
        "selectbox": ["foo", "bar", "foo"],
        "datetime": pd.to_datetime(
            ["2021-01-01 00:00:00", "2021-01-02 00:00:00", "2021-01-03 00:00:00"]
        ),
        "date": pd.to_datetime(["2021-01-01", "2021-01-02", "2021-01-03"]),
        "time": pd.to_datetime(["00:00:00", "01:00:00", "02:00:00"]),
        "list": [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
        "link": [
            "https://streamlit.io",
            "https://streamlit.io",
            "https://streamlit.io",
        ],
        "image": [
            "https://picsum.photos/200/300",
            "https://picsum.photos/200/300",
            "https://picsum.photos/200/300",
        ],
        "area_chart": [[1, 2, 1], [2, 3, 1], [3, 1, 2]],
        "line_chart": [[1, 2, 1], [2, 3, 1], [3, 1, 2]],
        "bar_chart": [[1, 2, 1], [2, 3, 1], [3, 1, 2]],
        "progress": [0.1, 0.2, 0.3],
        "json": [
            {
                "foo": "bar",
            },
            {
                "numbers": [123, 4.56],
            },
            {
                "level1": {"level2": {"level3": {"a": "b"}}},
            },
        ],
    }
)

st.data_editor(
    data_df,
    column_config={
        "column": st.column_config.Column(
            "Column", help="A column tooltip", pinned=True
        ),
        "text": st.column_config.TextColumn("TextColumn"),
        "number": st.column_config.NumberColumn("NumberColumn"),
        "checkbox": st.column_config.CheckboxColumn("CheckboxColumn"),
        "selectbox": st.column_config.SelectboxColumn(
            "SelectboxColumn", options=["foo", "bar", "baz"]
        ),
        "datetime": st.column_config.DatetimeColumn("DatetimeColumn"),
        "date": st.column_config.DateColumn("DateColumn"),
        "time": st.column_config.TimeColumn("TimeColumn"),
        "list": st.column_config.ListColumn("ListColumn"),
        "link": st.column_config.LinkColumn("LinkColumn"),
        "image": st.column_config.ImageColumn("ImageColumn"),
        "area_chart": st.column_config.AreaChartColumn("AreaChartColumn"),
        "line_chart": st.column_config.LineChartColumn("LineChartColumn"),
        "bar_chart": st.column_config.BarChartColumn("BarChartColumn"),
        "progress": st.column_config.ProgressColumn("ProgressColumn"),
        "json": st.column_config.JsonColumn("JSONColumn"),
    },
)

"st.table"
st.table(data.iloc[0:5])

col1, col2 = st.columns(2)
col1.metric("st.metric positive", 42, 2)
col2.metric("st.metric negative", 42, -2)

col1, col2 = st.columns(2)
col1.metric("st.metric with border positive", 42, 2, border=True)
col2.metric("st.metric with border negative", 42, -2, border=True)

"st.json"
st.json(
    {
        "foo": "bar",
        "numbers": [
            123,
            4.56,
        ],
        "level1": {"level2": {"level3": {"a": "b"}}},
    },
    expanded=2,
)


"## Chart elements"
data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])
"st.area_chart"
stack = st.radio(
    "stack",
    [None, True, False, "normalize", "center"],
    horizontal=True,
    key="area_chart_stack",
)
st.area_chart(data, x_label="x label", y_label="y label", stack=stack)  # type: ignore
"st.bar_chart"
horizontal = st.toggle("horizontal", False)
stack = st.radio(
    "stack",
    [None, True, False, "normalize", "center"],
    horizontal=True,
    key="bar_chart_stack",
)
st.bar_chart(
    data,
    x_label="x label",
    y_label="y label",
    horizontal=horizontal,
    stack=stack,  # type: ignore
)
"st.line_chart"
st.line_chart(data, x_label="x label", y_label="y label")
"st.scatter_chart"
st.scatter_chart(data, x_label="x label", y_label="y label")

"st.map"
df = pd.DataFrame(
    np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4], columns=["lat", "lon"]
)
st.map(df)

"st.pyplot"
fig, ax = plt.subplots()
ax.hist(data, bins=20)
st.pyplot(fig)

"st.altair_chart"
st.altair_chart(
    alt.Chart(data)
    .mark_circle()
    .encode(x="a", y="b", size="c", color="c", tooltip=["a", "b", "c"]),
    use_container_width=True,
)

"st.vega_lite_chart"
st.vega_lite_chart(
    data,
    {
        "mark": {"type": "circle", "tooltip": True},
        "encoding": {
            "x": {"field": "a", "type": "quantitative"},
            "y": {"field": "b", "type": "quantitative"},
            "size": {"field": "c", "type": "quantitative"},
            "color": {"field": "c", "type": "quantitative"},
        },
    },
    use_container_width=True,
)

"st.plotly_chart"
df = px.data.gapminder()
fig = px.scatter(
    df.query("year==2007"),
    x="gdpPercap",
    y="lifeExp",
    size="pop",
    color="continent",
    hover_name="country",
    log_x=True,
    size_max=60,
)
st.plotly_chart(fig, use_container_width=True)

"st.bokeh_chart"
if st.toggle("Show Bokeh chart (has some issues)", False):
    from bokeh.plotting import figure

    x = [1, 2, 3, 4, 5]
    y = [6, 7, 2, 4, 5]
    p = figure(title="simple line example", x_axis_label="x", y_axis_label="y")
    p.line(x, y, legend_label="Trend", line_width=2)
    st.bokeh_chart(p, use_container_width=True)

"st.pydeck_chart"
data = pd.DataFrame(
    np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4], columns=["lat", "lon"]
)
st.pydeck_chart(
    pdk.Deck(
        map_style=None,
        initial_view_state=pdk.ViewState(
            latitude=37.76,
            longitude=-122.4,
            zoom=11,
            pitch=50,
        ),
        layers=[
            pdk.Layer(
                "HexagonLayer",
                data=data,
                get_position="[lon, lat]",
                radius=200,
                elevation_scale=4,
                elevation_range=[0, 1000],
                pickable=True,
                extruded=True,
            ),
            pdk.Layer(
                "ScatterplotLayer",
                data=data,
                get_position="[lon, lat]",
                get_color="[200, 30, 0, 160]",
                get_radius=200,
            ),
        ],
    )
)

"st.graphviz_chart"
st.graphviz_chart(
    """
    digraph {
        run -> intr
        intr -> runbl
        runbl -> run
        run -> kernel
        kernel -> zombie
        kernel -> sleep
        kernel -> runmem
        sleep -> swap
        swap -> runswap
        runswap -> new
        runswap -> runmem
        new -> runmem
        sleep -> runmem
    }
    """
)


"## Input widgets"
if st.button("st.button"):
    st.write("You pressed the button!")

if st.button("st.button primary", type="primary"):
    st.write("You pressed the button!")

if st.button("st.button tertiary", type="tertiary"):
    st.write("You pressed the button!")

if st.button("st.button with icon", icon=":material/home:"):
    st.write("You pressed the button!")

text_contents = "This is some text"
st.download_button("st.download_button", data=text_contents)

"st.feedback"
st.feedback("thumbs")
st.feedback("faces")
st.feedback("stars")

st.link_button("st.link_button", "https://streamlit.io")

st.page_link("https://streamlit.io", label="st.page_link", icon=":material/home:")

checkbox_input = st.checkbox("st.checkbox", True)
st.write(f"Your checkbox input is {checkbox_input}!")

toggle_input = st.toggle("st.toggle", True)
st.write(f"Your toggle input is {toggle_input}!")

radio_input = st.radio("st.radio", ["cat", "dog"])
st.write(f"Your radio input is {radio_input}!")

radio_input = st.radio("st.radio horizontal", ["cat", "dog"], horizontal=True)
st.write(f"Your radio input is {radio_input}!")

selectbox_input = st.selectbox(
    "st.selectbox", ["cat", "dog", "monkey", "snake", "bird"]
)
st.write(f"Your selectbox input is {selectbox_input}!")

multiselect_input = st.multiselect(
    "st.multiselect",
    ["cat", "dog", "monkey", "snake", "bird"],
    default=["cat", "monkey"],
)
st.write(f"Your multiselect input is {multiselect_input}!")

pills_input = st.pills(
    "st.pills multi",
    ["cat", "dog", "monkey", "snake", "bird"],
    selection_mode="multi",
    default=["cat", "monkey"],
)
st.write(f"Your pills input is {pills_input}!")

segmented_control_input = st.segmented_control(
    "st.segmented_control multi",
    ["cat", "dog", "monkey", "snake", "bird"],
    selection_mode="multi",
    default=["cat", "monkey"],
)
st.write(f"Your segmented control input is {segmented_control_input}!")

select_slider_input = st.select_slider(
    "st.select_slider",
    options=["xsmall", "small", "medium", "large", "xlarge"],
    value="small",
)
st.write(f"Your select_slider input is {select_slider_input}!")

color_input = st.color_picker("st.color_picker")
st.write(f"Your color input hex is {color_input}!")

number_input = st.number_input("st.number_input")
st.write(f"Your number input is {number_input}!")

slider_input = st.slider("st.slider", value=30)
st.write(f"Your slider input is {slider_input}!")

date_input = st.date_input("st.date_input")
st.write(f"Your date input is {date_input}!")

time_input = st.time_input("st.time_input")
st.write(f"Your time input is {time_input}!")

text_input = st.text_input("st.text_input")
st.write(f"Your text input is {text_input}!")

text_area_input = st.text_area("st.text_area")
st.write(f"Your text_area input is {text_area_input}!")

audio_input = st.audio_input("st.audio_input")
st.write(f"Your audio input is {audio_input}!")

file_input = st.file_uploader("st.file_input")

if st.toggle("Show camera input (requires camera permission)", False):
    cam_input = st.camera_input("st.camera_input")
    st.write(f"Your cam input is {cam_input}!")


"## Media elements"
"st.image"
st.image(STREAMLIT_LOGO_PATH)

"st.audio"
st.audio(CAT_AUDIO_PATH)

"st.video"
st.video(FLOWER_VIDEO_PATH)


"## Layouts and containers"

"st.columns"
a, b = st.columns(2)
a.write("column 1")
b.write("column 2")

c = st.container()
c.write("st.container")


@st.dialog("Test dialog")
def dialog():
    st.write("Hello there!")
    if st.button("Close"):
        st.rerun()


if st.button("Open st.dialog"):
    dialog()

a = st.empty()
a.write("st.empty")

with st.expander("st.expander"):
    st.write("works!")

with st.popover("st.popover"):
    st.write("works!")

st.sidebar.write("st.sidebar")

with st.sidebar:
    st.selectbox("st.selectbox sidebar", ["cat", "dog", "monkey", "snake", "bird"])
    st.button("st.button sidebar")
    st.checkbox("st.checkbox sidebar", True)
    st.info("st.info sidebar")
    st.expander("st.expander sidebar").write("works!")

"st.tabs"
tab_a, tab_b = st.tabs(["tab 1", "tab 2"])
tab_b.write("tab 1 content")
tab_a.write("tab 2 content")


"## Chat elements"

"st.chat_input"
if st.toggle("Show chat input at the bottom of the screen", False):
    st.chat_input(accept_file="multiple")
else:
    st.container().chat_input(accept_file="multiple")

"st.chat_message"
st.chat_message("assistant").write("Hello there!")

if st.button("Start st.status"):
    with st.status("Working on it...", expanded=True) as status:
        time.sleep(1)
        st.write("Some content...")
        time.sleep(1)
        st.write("Some content...")
        time.sleep(1)
        st.write("Some content...")
        status.update(label="Done!", state="complete")


if st.button("Start st.write_stream"):

    def stream():
        for i in ["hello", " streaming", " world"]:
            time.sleep(0.5)
            yield i

    st.write_stream(stream)


"## Status elements"
if st.button("st.progress"):
    my_bar = st.progress(0)
    for percent_complete in range(100):
        my_bar.progress(percent_complete + 1)
        time.sleep(0.05)

if st.button("st.spinner"):
    with st.spinner("Wait!", show_time=True):
        time.sleep(3)
        st.write("spinner works if you saw it!")

if st.button("st.toast"):
    st.toast("Hello there!", icon="🎈")

if st.button("st.balloons"):
    st.balloons()

if st.button("st.snow"):
    st.snow()

st.success("st.success")
st.success("st.success with icon", icon=":material/home:")
st.info("st.info")
st.info("st.info with icon", icon=":material/home:")
st.warning("st.warning")
st.warning("st.warning with icon", icon=":material/home:")
st.error("st.error")
st.error("st.error with icon", icon=":material/home:")
st.exception(RuntimeError("st.exception"))


"## Execution flow"

"st.fragment"


@st.fragment
def my_fragment() -> None:
    if st.button("Wait 1s inside the fragment"):
        time.sleep(1)


my_fragment()

if st.button("st.rerun()"):
    st.rerun()

if st.button("st.stop()"):
    st.stop()
    st.write("if you see this, st.stop does not work")  # type: ignore

with st.form(key="tester"):
    "st.form"
    text_tester = st.text_input("Your text")
    st.form_submit_button("Submit")
st.write("Your text is:", text_tester)


st.write("## Utilities")

"st.help"
st.help(st.write)

st.write("## State Management")

"st.session_state"
if "foo" not in st.session_state:
    st.session_state["foo"] = "bar"
st.write(st.session_state)

if st.button("Add st.query_params"):
    st.query_params["foo"] = "bar"

"st.context.cookies"
st.write(st.context.cookies)

"st.context.headers"
st.write(st.context.headers)

"st.context.locale"
st.write(st.context.locale)

"st.context.timezone"
st.write(st.context.timezone)

"st.context.timezone_offset"
st.write(st.context.timezone_offset)
