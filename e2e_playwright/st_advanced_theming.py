import time

import altair as alt
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import plotly.express as px
import pydeck as pdk

import streamlit as st
from streamlit.config import get_option, set_option

st.set_page_config("Mega tester app", "🎈", initial_sidebar_state="collapsed")

st.sidebar.header("Hello Sidebar")

st.sidebar.text_input("text input")
st.sidebar.success("Wohooo")


with st.popover("Theme Editor"):
    with st.form("theme_editor", border=False):
        base_theme = st.selectbox(
            "Base theme",
            options=["light", "dark"],
            index=["light", "dark"].index(get_option("theme.base") or "dark"),
        )

        roundedness = st.slider(
            "Roundedness",
            value=get_option("theme.roundedness") or 0.25,
            min_value=0.0,
            max_value=1.0,
        )
        font_size = st.slider(
            "Font size",
            value=get_option("theme.fontSize") or 14,
            min_value=6,
            max_value=25,
        )

        st.divider()

        col1, col2 = st.columns(2)
        with col1:
            primary_color = st.color_picker(
                "Primary color",
                value=get_option("theme.primaryColor") or "#1BD760",
            )
            background_color = st.color_picker(
                "Background color",
                value=get_option("theme.backgroundColor") or "#181818",
            )
            secondary_background_color = st.color_picker(
                "Secondary background color",
                value=get_option("theme.secondaryBackgroundColor") or "#2C2C2C",
            )
        with col2:
            text_color = st.color_picker(
                "Text color",
                value=get_option("theme.textColor") or "#FFFFFF",
            )
            link_color = st.color_picker(
                "Link color",
                value=get_option("theme.linkColor") or "#1BD760",
            )

        st.divider()
        show_sidebar_shadow = st.checkbox(
            "Show sidebar shadow", get_option("theme.sidebarShadow") or False
        )
        col1, col2 = st.columns(2)
        with col1:
            sidebar_background_color = st.color_picker(
                "Sidebar background color",
                value=get_option("theme.sidebarBackgroundColor") or "#FFFFFF",
            )
            sidebar_secondary_background_color = st.color_picker(
                "Sidebar secondary background color",
                value=get_option("theme.sidebarSecondaryBackgroundColor") or "#f0f2f6",
            )
        with col2:
            sidebar_text_color = st.color_picker(
                "Sidebar text color",
                value=get_option("theme.sidebarTextColor") or "#000000",
            )

        st.divider()
        fonts = [
            "Signika",
            "Playwrite",
            "Source Sans Pro",
            "Source Code Pro",
            "Source Serif Pro",
            "sans-serif",
            "monospace",
            "serif",
            "cursive",
        ]
        body_font = st.selectbox(
            "Body font",
            options=fonts,
            index=fonts.index(get_option("theme.bodyFont") or "Signika"),
        )

        heading_font = st.selectbox(
            "Heading font",
            options=fonts,
            index=fonts.index(get_option("theme.headingFont") or "Playwrite"),
        )

        code_font = st.selectbox(
            "Code font",
            options=fonts,
            index=fonts.index(get_option("theme.codeFont") or "Source Code Pro"),
        )

        st.divider()

        toolbar_mode = st.selectbox(
            "Toolbar mode",
            options=["auto", "developer", "viewer", "minimal"],
            index=["auto", "developer", "viewer", "minimal"].index(
                get_option("client.toolbarMode") or "minimal"
            ),
        )
        hide_top_decoration = st.checkbox(
            "Hide top decoration", get_option("client.hideTopDecoration") or True
        )
        hide_top_bar = st.checkbox("Hide top bar", get_option("ui.hideTopBar") or True)

        if st.form_submit_button("Apply theme", use_container_width=True):
            set_option("theme.sidebarShadow", show_sidebar_shadow)
            set_option("theme.fontSize", font_size)
            set_option("theme.roundedness", roundedness)

            set_option("theme.base", base_theme)
            set_option("theme.primaryColor", primary_color)
            set_option("theme.backgroundColor", background_color)
            set_option("theme.secondaryBackgroundColor", secondary_background_color)
            set_option("theme.textColor", text_color)
            set_option("theme.sidebarTextColor", sidebar_text_color)
            set_option("theme.linkColor", link_color)
            set_option("theme.sidebarBackgroundColor", sidebar_background_color)
            set_option(
                "theme.sidebarSecondaryBackgroundColor",
                sidebar_secondary_background_color,
            )
            set_option("client.toolbarMode", toolbar_mode)
            set_option("client.hideTopDecoration", hide_top_decoration)
            set_option("ui.hideTopBar", hide_top_bar)
            set_option("theme.bodyFont", body_font)
            set_option("theme.headingFont", heading_font)
            set_option("theme.codeFont", code_font)
            st.rerun()

# st.html("app_styles.html")
st.logo(
    "https://upload.wikimedia.org/wikipedia/commons/2/26/Spotify_logo_with_text.svg",
    size="medium",
)


st.title("🎈 Mega tester app")

st.write(
    "This app tests all Streamlit commands in one app. It uses `streamlit-nightly`, so "
    "you always see the latest state of Streamlit's `develop` branch."
)

"## Write and magic"
st.write("hello from st.write")
"hello from magic"


"## Text elements"
st.markdown("hello from st.markdown")
st.title("hello from st.title")
st.header("hello from st.header")
st.subheader("hello from st.subheader")
st.caption("hello from st.caption")
st.code("# hello from st.code\na = 1234")
# with st.echo():
#     st.write("hello from st.echo")
st.text("hello from st.text")
st.latex(r"\int a x^2 \,dx")
st.divider()

st.write(
    "Here's a [link](https://streamlit.io) and here is :blue[blue], :green[green], :red[red], :violet[violet], and :orange[orange] and here is :blue-background[blue background], :green-background[green background], :red-background[red background], :violet-background[violet background], and :orange-background[orange background]"
)

"## Data elements"
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
    }
)

st.data_editor(
    data_df,
    column_config={
        "column": st.column_config.Column("Column", help="A column tooltip"),
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
    },
)

"st.table"
st.table(data.iloc[0:5])

st.metric("st.metric", 42, 2)

"st.json"
st.json(data.iloc[0:2].to_dict())


"## Chart elements"
data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])
"st.area_chart"
st.area_chart(data)
"st.line_chart"
st.line_chart(data)
"st.bar_chart"
st.bar_chart(data)
"st.scatter_chart"
st.scatter_chart(data)

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
button_input = st.button("st.button")
if button_input:
    st.write("You pressed the button!")

text_contents = "This is some text"
st.download_button("st.download_button", data=text_contents)

"st.feedback"
st.feedback()

st.link_button("st.link_button", "https://streamlit.io")

checkbox_input = st.checkbox("st.checkbox")
st.write(f"Your checkbox input is {checkbox_input}!")

toggle_input = st.toggle("st.toggle")
st.write(f"Your toggle input is {toggle_input}!")

radio_input = st.radio("st.radio", ["cat", "dog"])
st.write(f"Your radio input is {radio_input}!")

selectbox_input = st.selectbox("st.selectbox", ["cat", "dog"])
st.write(f"Your selectbox input is {selectbox_input}!")

multiselect_input = st.multiselect("st.multiselect", ["cat", "dog"])
st.write(f"Your multiselect input is {multiselect_input}!")

select_slider_input = st.select_slider("st.select_slider", ["cat", "dog"])
st.write(f"Your select_slider input is {select_slider_input}!")

color_input = st.color_picker("st.color_picker")
st.write(f"Your color input hex is {color_input}!")

number_input = st.number_input("st.number_input")
st.write(f"Your number input is {number_input}!")

slider_input = st.slider("st.slider")
st.write(f"Your slider input is {slider_input}!")

date_input = st.date_input("st.date_input")
st.write(f"Your date input is {date_input}!")

time_input = st.time_input("st.time_input")
st.write(f"Your time input is {time_input}!")

text_input = st.text_input("st.text_input")
st.write(f"Your text input is {text_input}!")

text_area_input = st.text_area("st.text_area")
st.write(f"Your text_area input is {text_area_input}!")

file_input = st.file_uploader("st.file_input")

if st.toggle("Show camera input (requires camera permission)", False):
    cam_input = st.camera_input("st.camera_input")
    st.write(f"Your cam input is {cam_input}!")


"## Media elements"
"st.image"
st.image("https://picsum.photos/200/300")

"st.audio"
st.audio(
    "https://file-examples.com/wp-content/storage/2017/11/file_example_MP3_700KB.mp3"
)

"st.video"
st.video(
    "https://file-examples.com/wp-content/storage/2017/04/file_example_MP4_480_1_5MG.mp4"
)


"## Layouts and containers"

"st.columns"
a, b = st.columns(2)
a.write("column 1")
b.write("column 2")

st.container().write("st.container")
st.container(border=True).write("st.container with border")
st.container(height=150).write(
    "st.container with fixed height\n\n1\n\n2\n\n3\n\n4\n\n5"
)


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


"st.tabs"
tab_a, tab_b = st.tabs(["tab 1", "tab 2"])
tab_b.write("tab 1 content")
tab_a.write("tab 2 content")


"## Chat elements"

"st.chat_input"
if st.toggle("Show chat input at the bottom of the screen", False):
    st.chat_input()
else:
    st.container().chat_input()

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

if st.button("st.spinner"):
    with st.spinner("Wait!"):
        time.sleep(3)
        st.write("spinner works if you saw it!")

if st.button("st.toast"):
    st.toast("Hello there!", icon="🎈")

if st.button("st.balloons"):
    st.balloons()

if st.button("st.snow"):
    st.snow()

st.success("st.success")
st.info("st.info")
st.warning("st.warning")
st.error("st.error")
st.exception(RuntimeError("st.exception"))


"## Execution flow"

"st.fragment"


@st.fragment
def my_fragment():
    if st.button("Wait 1s inside the fragment"):
        time.sleep(1)


my_fragment()

if st.button("st.rerun()"):
    st.rerun()

if st.button("st.stop()"):
    st.stop()
    st.write("if you see this, st.stop does not work")

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
