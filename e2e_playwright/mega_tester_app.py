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

from __future__ import annotations

import importlib.util
import re
import sys
from datetime import date, datetime, time
from pathlib import Path
from typing import TYPE_CHECKING, Literal, cast

import numpy as np
import pandas as pd

import streamlit as st
import streamlit.components.v1 as components

if TYPE_CHECKING:
    from collections.abc import Generator

    from streamlit.elements.widgets.chat import ChatInputValue
    from streamlit.navigation.page import StreamlitPage

_DUMMY_PDF = (
    "%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n"
    "2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n"
    "3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n"
    "/Contents 4 0 R\n/Resources <<\n/Font <<\n/F1 5 0 R\n>>\n>>\n>>\nendobj\n"
    "4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n"
    "(Hello PDF World!) Tj\nET\nendstream\nendobj\n"
    "5 0 obj\n<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\nendobj\n"
    "xref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n"
    "0000000115 00000 n\n0000000274 00000 n\n0000000373 00000 n\ntrailer\n"
    "<<\n/Size 6\n/Root 1 0 R\n>>\nstartxref\n446\n%%EOF"
).encode("latin-1")

_MAGIC_COW = """\
 ______________
< Abracowdabra! >
 --------------
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||
"""

_STATIC_DIR = Path(__file__).resolve().parent / "static"


def _minor_version() -> int:
    match = re.match(r"^\d+\.(\d+)", st.__version__)
    if match is None:
        raise RuntimeError(f"Unable to parse Streamlit version: {st.__version__}")
    return int(match.group(1))


def _module_available(module_name: str) -> bool:
    try:
        return importlib.util.find_spec(module_name) is not None
    except ModuleNotFoundError:
        return False


def _stream_chunks() -> Generator[str | pd.DataFrame, None, None]:
    yield "lorem "
    yield "ipsum "
    yield pd.DataFrame({"a": [1, 2], "b": [3, 4]})
    yield "dolor sit amet"


def _generate_sparkline_data(
    length: int = 15, drift: float = 0.05, volatility: float = 10
) -> list[float]:
    random_changes = np.random.default_rng(31).normal(
        loc=drift, scale=volatility, size=length
    )
    initial_value = np.random.default_rng(32).normal(loc=50, scale=5)
    data = initial_value + np.cumsum(random_changes)
    return cast("list[float]", data.tolist())


def _render_sidebar_controls() -> tuple[str | None, bool]:
    with st.sidebar:
        st.subheader("Mega tester controls")
        show_tooltips = st.toggle("Show tooltips", True, key="show_tooltips")
        disabled = st.toggle("Disable widgets", False, key="disable_widgets")
        st.toggle("Wide mode", True, key="wide_mode")
        st.toggle("Navigation sections", True, key="nav_sections")
        st.toggle("Many pages", False, key="many_pages")
        st.toggle("Show more chart lines", False, key="more_lines")
        st.toggle("Horizontal bars", False, key="horizontal_bars")
        st.toggle("Range sliders", False, key="range_sliders")
        st.toggle("Show chat input at bottom", False, key="chat_input_bottom")
        st.divider()
        st.write("Sidebar widgets")
        st.selectbox(
            "Sidebar animal",
            ["cat", "dog", "bird"],
            key="sidebar_selectbox",
            disabled=disabled,
        )
        st.button("Sidebar button", key="sidebar_button", disabled=disabled)
        st.checkbox(
            "Sidebar choice",
            key="sidebar_checkbox",
            disabled=disabled,
        )
        with st.expander("Sidebar expander"):
            st.write("Sidebar expander content")
        st.info("Sidebar info")

    st.sidebar.write("Sidebar write API")
    help_text = "Tooltip text" if show_tooltips else None
    return help_text, disabled


def _render_packages_and_magic() -> None:
    st.header("Packages and magic")

    python_match = re.match(r"^\d+\.\d+\.\d+", sys.version)
    if python_match is None:
        raise RuntimeError(f"Unable to parse Python version: {sys.version}")

    st.dataframe(
        pd.DataFrame(
            {
                "package": ["Python", "Streamlit"],
                "version": [python_match.group(0), st.__version__],
            }
        ),
        width="stretch",
    )

    optional_deps = [
        "altair",
        "graphviz",
        "matplotlib",
        "plotly",
        "pydeck",
        "seaborn",
        "snowflake.snowpark",
        "streamlit_pdf",
    ]
    st.dataframe(
        pd.DataFrame(
            {
                "module": optional_deps,
                "status": [
                    "available" if _module_available(module_name) else "missing"
                    for module_name in optional_deps
                ],
            }
        ),
        width="stretch",
    )
    st.code(_MAGIC_COW)

    st.write("Write API call")
    "Magic bare expression"


def _render_map_and_media(minor_version: int) -> None:
    st.header("Map and media elements")

    rng = np.random.default_rng(7)
    map_df = pd.DataFrame(rng.standard_normal((1000, 2)) / [50, 50] + [37.76, -122.4])
    map_df.columns = ["lat", "lon"]
    st.map(map_df)

    st.image(
        np.arange(10000, dtype=np.uint8).reshape(100, 100), caption="Generated image"
    )

    if minor_version >= 35:
        logo = np.tile(np.array([[0, 255], [255, 0]], dtype=np.uint8), (40, 40))
        if minor_version >= 39:
            st.logo(logo, link="https://streamlit.io", size="large")
        else:
            st.logo(logo, link="https://streamlit.io")

    t = np.linspace(0.0, 0.25, 2000, endpoint=False)
    audio = 0.25 * np.sin(2 * np.pi * 440 * t)
    st.audio(audio, sample_rate=8000)
    example_video_path = _STATIC_DIR / "sintel-short.mp4"
    if example_video_path.is_file():
        st.video(example_video_path)


def _render_data_display(
    minor_version: int, help_text: str | None, disabled: bool
) -> None:
    st.header("Data display elements")

    rng = np.random.default_rng(11)
    chart_data = pd.DataFrame(rng.standard_normal((20, 3)), columns=["a", "b", "c"])
    st.dataframe(chart_data, width="stretch")

    selection_df = pd.DataFrame(rng.standard_normal((12, 5)), columns=list("abcde"))
    st.dataframe(
        selection_df,
        key="selection_df",
        on_select="rerun",
        selection_mode=["multi-row", "multi-column", "multi-cell"],
        width="stretch",
    )

    if minor_version >= 52:
        st.dataframe(
            pd.DataFrame({"col1": [1, None, 3], "col2": [None, "b", "c"]}),
            placeholder="N/A",
            width="stretch",
        )

    edited_df = st.data_editor(
        pd.DataFrame(
            [
                {"command": "st.selectbox", "rating": 4, "is_widget": True},
                {"command": "st.balloons", "rating": 5, "is_widget": False},
                {"command": "st.time_input", "rating": 3, "is_widget": True},
            ]
        ),
        num_rows="dynamic",
        disabled=disabled,
        key="data_editor",
    )
    st.download_button(
        "Download data as CSV",
        edited_df.to_csv(index=False).encode("utf-8"),
        "df.csv",
        "text/csv",
    )

    if hasattr(st, "column_config"):
        st.subheader("Column config matrix")
        column_config_df = pd.DataFrame(
            {
                "column": ["foo", "bar", "baz"],
                "text": ["foo", "bar", "baz"],
                "number": [1, 2, 3],
                "checkbox": [True, False, True],
                "selectbox": ["foo", "bar", "foo"],
                "datetime": pd.to_datetime(
                    [
                        "2021-01-01 00:00:00",
                        "2021-01-02 00:00:00",
                        "2021-01-03 00:00:00",
                    ]
                ),
                "date": pd.to_datetime(["2021-01-01", "2021-01-02", "2021-01-03"]),
                "time": [time(0, 0), time(1, 0), time(2, 0)],
                "list": [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
                "link": [
                    "https://streamlit.io",
                    "https://streamlit.io",
                    "https://streamlit.io",
                ],
                "image": [
                    "./app/static/test-streamlit-logo.png",
                    "./app/static/test-streamlit-logo.png",
                    "./app/static/test-streamlit-logo.png",
                ],
                "area_chart": [[1, 2, 1], [2, 3, 1], [3, 1, 2]],
                "line_chart": [[1, 2, 1], [2, 3, 1], [3, 1, 2]],
                "bar_chart": [[1, 2, 1], [2, 3, 1], [3, 1, 2]],
                "progress": [0.1, 0.2, 0.3],
                "json": [
                    {"foo": "bar"},
                    {"numbers": [123, 4.56]},
                    {"level1": {"level2": {"level3": {"a": "b"}}}},
                ],
            }
        )
        st.data_editor(
            column_config_df,
            key="column_config_editor",
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

    st.table(chart_data.head())
    st.metric("Metric", 42, 2, help=help_text)
    if minor_version >= 52:
        st.metric("Metric without arrow", 100, -5, delta_arrow="off")

    pos_col, neg_col, neutral_col = st.columns(3)
    pos_col.metric("Metric positive", 1234, 123, help=help_text)
    neg_col.metric("Metric negative", 1234, -123, help=help_text)
    neutral_col.metric("Metric neutral", 1234, 123, delta_color="off", help=help_text)

    left, middle, right = st.columns(3)
    left.metric(
        "Metric sparkline line",
        1234,
        123,
        border=True,
        chart_data=_generate_sparkline_data(),
        chart_type="line",
        help=help_text,
    )
    middle.metric(
        "Metric sparkline area",
        1234,
        -123,
        border=True,
        chart_data=_generate_sparkline_data(),
        chart_type="area",
        help=help_text,
    )
    right.metric(
        "Metric sparkline bar",
        1234,
        123,
        border=True,
        chart_data=_generate_sparkline_data(),
        chart_type="bar",
        delta_color="off",
        help=help_text,
    )
    st.json(chart_data.head().to_dict(), expanded=2)


def _render_charts(minor_version: int) -> None:
    st.header("Chart elements")

    if _module_available("matplotlib"):
        import matplotlib.pyplot as plt

        arr = np.random.default_rng(17).normal(1, 1, size=100)
        fig, ax = plt.subplots()
        ax.hist(arr, bins=20)
        ax.set_title("Histogram")
        st.pyplot(fig)

    if _module_available("matplotlib") and _module_available("seaborn"):
        import matplotlib.pyplot as plt
        import seaborn as sns  # type: ignore[import-untyped]

        fig, _ = plt.subplots()
        sns.heatmap(pd.DataFrame([[1, 2], [3, 4]]), cmap="plasma")
        st.pyplot(fig)

    column_count = 10 if st.session_state.get("more_lines", False) else 3
    columns = (
        ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]
        if column_count == 10
        else ["a", "b", "c"]
    )
    chart_data = pd.DataFrame(
        np.random.default_rng(19).standard_normal((20, column_count)),
        columns=columns,
    )
    st.line_chart(chart_data, x_label="x label", y_label="y label")
    area_stack = cast(
        "Literal['normalize', 'center'] | bool",
        st.segmented_control(
            "Area chart stack",
            [True, False, "normalize", "center"],
            key="area_stack",
        ),
    )
    st.area_chart(chart_data, x_label="x label", y_label="y label", stack=area_stack)
    bar_stack = cast(
        "Literal['normalize', 'center'] | bool",
        st.segmented_control(
            "Bar chart stack",
            [True, False, "normalize", "center"],
            key="bar_stack",
        ),
    )
    st.bar_chart(
        chart_data,
        x_label="x label",
        y_label="y label",
        horizontal=st.session_state.get("horizontal_bars", False),
        stack=bar_stack,
    )

    if _module_available("altair"):
        import altair as alt

        st.altair_chart(
            alt.Chart(chart_data)
            .mark_circle()
            .encode(x="a", y="b", size="c", color="c", tooltip=["a", "b", "c"]),
            use_container_width=True,
        )

    if minor_version >= 27:
        st.scatter_chart(chart_data, x_label="x label", y_label="y label")

    st.vega_lite_chart(
        chart_data,
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

    if _module_available("plotly"):
        import plotly.graph_objects as go

        fig = go.Figure()
        fig.add_scatter(y=[1, 3, 2, 4], mode="lines", name="Demo")
        st.plotly_chart(fig, use_container_width=True)

    if _module_available("pydeck"):
        import pydeck as pdk

        points = pd.DataFrame(
            np.random.default_rng(23).standard_normal((1000, 2)) / [50, 50]
            + [37.76, -122.4],
            columns=["lat", "lon"],
        )
        st.pydeck_chart(
            pdk.Deck(
                map_style=None,
                initial_view_state=pdk.ViewState(
                    latitude=37.76,
                    longitude=-122.4,
                    zoom=11,
                ),
                layers=[
                    pdk.Layer(
                        "ScatterplotLayer",
                        data=points,
                        get_position="[lon, lat]",
                        get_radius=200,
                    )
                ],
            )
        )

    if _module_available("graphviz"):
        import graphviz

        graph = graphviz.Digraph()
        graph.edge("run", "kernel")
        graph.edge("kernel", "sleep")
        st.graphviz_chart(graph)

    st.graphviz_chart("""
        digraph {
            start -> process
            process -> decision
            decision -> finish
        }
    """)


def _render_custom_ui(minor_version: int) -> None:
    st.header("Custom UI elements")

    components.html("<b style='color: green'>Bold green HTML text</b>", height=50)
    st.markdown(
        "<b style='color: green'>Unsafe markdown HTML</b>", unsafe_allow_html=True
    )
    components.html("<button>Click me</button>", height=50)

    if (
        minor_version >= 51
        and hasattr(st, "components")
        and hasattr(st.components, "v2")
        and hasattr(st.components.v2, "component")
    ):
        inline_component = st.components.v2.component(
            "inline_links",
            js="""
            export default function(component) {
              const { setTriggerValue } = component;
              const links = document.querySelectorAll('a[href="#"]');
              links.forEach((link) => {
                link.onclick = () => {
                  setTriggerValue("clicked", link.innerHTML);
                };
              });
            }
            """,
        )
        click_result = inline_component(on_clicked_change=lambda: None)
        st.markdown("Click [one](#) or [two](#) inline link.")
        clicked_link = click_result.get("clicked")
        if clicked_link:
            st.write(f"Clicked link: {clicked_link}")


@st.dialog(
    "Test dialog",
    width=cast(
        "Literal['small', 'medium', 'large']",
        st.session_state.get("dialog_width", "small"),
    ),
    dismissible=st.session_state.get("dialog_dismissible", True),
)
def _dialog(item: str) -> None:
    reason = st.text_input("Dialog reason", key="dialog_reason")
    if st.button("Submit dialog"):
        st.session_state.vote = {"item": item, "reason": reason}
        st.rerun()


def _render_inputs(minor_version: int, help_text: str | None, disabled: bool) -> None:
    st.header("Input widgets")

    st.text_input(
        "Textbox",
        key="textbox",
        help=help_text,
        disabled=disabled,
    )
    st.number_input(
        "Number",
        key="number",
        help=help_text,
        disabled=disabled,
    )
    range_slider = st.session_state.get("range_sliders", False)
    st.slider(
        "Slider",
        value=(30, 60) if range_slider else 30,
        key="slider",
        help=help_text,
        disabled=disabled,
    )
    if minor_version >= 46:
        st.slider(
            "Slider narrow",
            width=200,
            key="slider_narrow",
            help=help_text,
            disabled=disabled,
        )

    if st.button(
        "Button",
        key="button",
        icon=":material/home:",
        help=help_text,
        disabled=disabled,
    ):
        st.write("You pressed the default button")
    if st.button(
        "Button primary",
        key="button_primary",
        type="primary",
        icon=":material/home:",
        help=help_text,
        disabled=disabled,
    ):
        st.write("You pressed the primary button")
    if st.button(
        "Button tertiary",
        key="button_tertiary",
        type="tertiary",
        icon=":material/home:",
        help=help_text,
        disabled=disabled,
    ):
        st.write("You pressed the tertiary button")
    if minor_version >= 52:
        st.button(
            "Shortcut button",
            shortcut="k",
            key="shortcut_button",
            disabled=disabled,
        )

    st.download_button(
        "Download hello",
        data="Hello!",
        icon=":material/home:",
        help=help_text,
        disabled=disabled,
    )
    st.link_button(
        "Link button in inputs",
        "https://streamlit.io",
        icon=":material/home:",
        help=help_text,
        disabled=disabled,
    )
    if hasattr(st, "page_link"):
        st.page_link(
            "https://streamlit.io",
            label="Page link",
            icon=":material/home:",
            help=help_text,
            disabled=disabled,
        )

    st.checkbox("Checkbox", key="checkbox", help=help_text, disabled=disabled)
    toggle_value = st.toggle("Toggle", key="toggle", help=help_text, disabled=disabled)
    st.write(f"Toggle state is {toggle_value}")
    st.radio(
        "Radio",
        ["cat", "dog"],
        key="radio",
        help=help_text,
        disabled=disabled,
    )
    st.radio(
        "Horizontal option",
        ["cat", "dog"],
        key="radio_horizontal",
        horizontal=True,
        help=help_text,
        disabled=disabled,
    )

    accept_new_options = st.toggle(
        "Accept new options",
        key="accept_new_options",
    )

    if minor_version >= 45:
        st.selectbox(
            "Selectbox",
            ["cat", "dog"],
            accept_new_options=accept_new_options,
            key="selectbox",
            help=help_text,
            disabled=disabled,
        )
        st.multiselect(
            "Multiselect",
            ["cat", "dog"],
            accept_new_options=accept_new_options,
            key="multiselect",
            help=help_text,
            disabled=disabled,
        )
    else:
        st.selectbox(
            "Selectbox",
            ["cat", "dog"],
            key="selectbox",
            help=help_text,
            disabled=disabled,
        )
        st.multiselect(
            "Multiselect",
            ["cat", "dog"],
            key="multiselect",
            help=help_text,
            disabled=disabled,
        )

    st.select_slider(
        "Select slider",
        ["xsmall", "small", "medium", "large", "xlarge"],
        value=("small", "large") if range_slider else "small",
        key="select_slider",
        help=help_text,
        disabled=disabled,
    )
    st.text_area(
        "Text area",
        key="text_area",
        help=help_text,
        disabled=disabled,
    )
    st.date_input(
        "Date input",
        value=date(2024, 1, 1),
        key="date_input",
        help=help_text,
        disabled=disabled,
    )
    st.time_input(
        "Time input",
        value=time(8, 30),
        key="time_input",
        help=help_text,
        disabled=disabled,
    )
    if minor_version >= 52:
        st.datetime_input(
            "Datetime input",
            value=datetime(2024, 1, 1, 8, 30),
            key="datetime_input",
            help=help_text,
            disabled=disabled,
        )
    if minor_version >= 49:
        upload_mode = cast(
            "Literal['directory'] | bool",
            st.segmented_control(
                "File uploader mode",
                [False, True, "directory"],
                default=False,
                key="file_uploader_mode",
            ),
        )
        if upload_mode is False:
            st.file_uploader("File input", key="file_input", disabled=disabled)
        else:
            st.file_uploader(
                "File input",
                accept_multiple_files=upload_mode,
                key="file_input",
                disabled=disabled,
            )
    else:
        st.file_uploader("File input", key="file_input", disabled=disabled)
    st.color_picker(
        "Color picker",
        key="color_picker",
        help=help_text,
        disabled=disabled,
    )

    with st.form("form"):
        st.text_input(
            "Form text",
            key="form_text",
            help=help_text,
            disabled=disabled,
        )
        submitted = st.form_submit_button(
            "Submit form", help=help_text, disabled=disabled
        )
    if submitted:
        st.write("Form submitted")

    if st.button("Trigger rerun", key="rerun"):
        st.rerun()

    st.segmented_control(
        "Dialog width",
        ["small", "medium", "large"],
        default="small",
        key="dialog_width",
    )
    st.toggle(
        "Dialog dismissible",
        True,
        key="dialog_dismissible",
    )

    show_chat_input_bottom = st.session_state.get("chat_input_bottom", False)
    prompt: str | ChatInputValue | None = None
    if show_chat_input_bottom:
        if minor_version >= 52:
            prompt = st.chat_input(
                "Chat input",
                key="chat_input",
                accept_file="multiple",
                accept_audio=True,
                disabled=disabled,
            )
        elif minor_version >= 43:
            prompt = st.chat_input(
                "Chat input",
                key="chat_input",
                accept_file="multiple",
                disabled=disabled,
            )
        else:
            prompt = st.chat_input(
                "Chat input",
                key="chat_input",
                disabled=disabled,
            )
    else:
        chat_input_target = st.container()
        if minor_version >= 52:
            prompt = chat_input_target.chat_input(
                "Chat input",
                key="chat_input",
                accept_file="multiple",
                accept_audio=True,
                disabled=disabled,
            )
        elif minor_version >= 43:
            prompt = chat_input_target.chat_input(
                "Chat input",
                key="chat_input",
                accept_file="multiple",
                disabled=disabled,
            )
        else:
            prompt = chat_input_target.chat_input(
                "Chat input",
                key="chat_input",
                disabled=disabled,
            )

    if prompt:
        st.chat_message("user").write(getattr(prompt, "text", str(prompt)))
    st.chat_message("assistant").write("Assistant response")

    if st.button("Write stream", key="write_stream"):
        st.write_stream(_stream_chunks)

    if "vote" not in st.session_state:
        if st.button("Open dialog item 1", key="dialog_open"):
            _dialog("1")
    else:
        st.write(
            f"Dialog result item={st.session_state.vote['item']} "
            f"reason={st.session_state.vote['reason']}"
        )
    if minor_version >= 37:
        st.feedback("thumbs", key="feedback_thumbs", disabled=disabled)
        st.feedback("faces", key="feedback_faces", disabled=disabled)
        st.feedback("stars", key="feedback_stars", disabled=disabled)

    if minor_version >= 40:
        pills_value = st.pills(
            "Pills",
            ["North", "East", "South", "West"],
            selection_mode="multi",
            key="pills",
            disabled=disabled,
            help=help_text,
        )
        st.write(f"Pills value is {pills_value}")
        segmented_value = st.segmented_control(
            "Segmented",
            ["North", "East", "South", "West"],
            selection_mode="multi",
            key="segmented",
            disabled=disabled,
            help=help_text,
        )
        st.write(f"Segmented value is {segmented_value}")
        audio_value = st.audio_input(
            "Audio input",
            key="audio_input",
            disabled=disabled,
        )
        st.write(f"Audio input is {audio_value}")

    if hasattr(st, "camera_input") and st.toggle(
        "Show camera input", False, key="show_camera_input"
    ):
        camera_value = st.camera_input(
            "Camera input",
            key="camera_input",
            disabled=disabled,
        )
        st.write(f"Camera input is {camera_value}")


def _render_text_elements(minor_version: int, help_text: str | None) -> None:
    st.header("Text elements")
    st.title("Title with tooltip", help=help_text)
    st.markdown("Markdown", help=help_text)
    st.markdown(
        "Markdown features: **bold** *italic* ~strikethrough~ [link](https://streamlit.io) "
        "`code` $a=b$ 🐶 :cat: :material/home: :streamlit: <- -> <-> -- >= <= ~= :small[small] $$a = b$$"
    )
    st.markdown("""
Text colors:

:blue[blue] :green[green] :orange[orange] :red[red] :violet[violet] :gray[gray] :rainbow[rainbow] :primary[primary]

:blue-background[blue] :green-background[green] :orange-background[orange] :red-background[red]
:violet-background[violet] :gray-background[gray] :rainbow-background[rainbow] :primary-background[primary]

:blue-badge[blue] :green-badge[green] :orange-badge[orange] :red-badge[red] :violet-badge[violet]
:gray-badge[gray] :primary-badge[primary]
""")
    st.header("Header")
    for color in [
        "blue",
        "green",
        "yellow",
        "orange",
        "red",
        "violet",
        "gray",
        "rainbow",
    ]:
        st.header(f"Header with {color} divider", divider=color, help=help_text)
    st.subheader("Subheader")
    st.caption("Caption", help=help_text)
    st.code("a = 1234")
    st.code("a = 1234", line_numbers=True)
    st.code(
        'a = "This is a very very very very very very very very very very very very long string"',
        wrap_lines=True,
    )
    st.text("Text", help=help_text)
    if minor_version >= 52:
        st.markdown("Centered markdown", text_alignment="center")
        st.caption("Centered caption", text_alignment="center")
        st.text("Centered text", text_alignment="center", width="stretch")
    st.latex(r"\int a x^2 \,dx", help=help_text)
    st.divider()
    st.warning("Warning")
    st.warning("Warning with icon", icon=":material/home:")
    st.error("Error")
    st.error("Error with icon", icon=":material/home:")
    st.info("Info")
    st.info("Info with icon", icon=":material/home:")
    st.success("Success")
    st.success("Success with icon", icon=":material/home:")
    st.exception(RuntimeError("Example exception"))
    if st.button("Run balloons", key="balloons"):
        st.balloons()
    if st.button("Run snow", key="snow"):
        st.snow()
    if minor_version >= 27:
        st.link_button("Link button", "https://streamlit.io")
    if minor_version >= 44:
        st.badge("Badge", icon=":material/check:", color="green")


def _render_blocks(minor_version: int, help_text: str | None, disabled: bool) -> None:
    st.header("Block elements")

    left, right = st.columns(2)
    left.write("Left column")
    right.write("Right column")
    bordered_left, bordered_right = st.columns(2, border=True)
    bordered_left.write("Bordered left column")
    bordered_right.write("Bordered right column")

    tab_a, tab_b = st.tabs(["Tab A", "Tab B"])
    tab_a.write("Tab A content")
    tab_b.write("Tab B content")

    with st.expander("Expander"):
        st.write("Expander content")

    st.container().write("Container content")
    st.container(border=True).write("Bordered container content")
    if minor_version >= 32:
        with st.popover("Popover", help=help_text, disabled=disabled):
            st.write("Popover content")
    st.empty().write("Empty content")

    if minor_version >= 37:

        @st.fragment
        def _fragment() -> None:
            st.button("Fragment button", key="fragment_button")
            st.write("Fragment content")

        _fragment()

    if minor_version >= 48:
        horizontal = st.container(horizontal=True, horizontal_alignment="right")
        for idx in range(3):
            horizontal.button(
                f"Horizontal button {idx + 1}", key=f"horizontal_button_{idx}"
            )

    if minor_version >= 51:
        with st.container(horizontal=True):
            st.button("Left", key="space_left")
            st.space("stretch")
            st.button("Right", key="space_right")

    if minor_version >= 52:
        with st.container(width="content"):
            st.write("Content-width container")


def _render_navigation(minor_version: int) -> None:
    st.header("Navigation elements")

    nav_positions: list[Literal["hidden", "sidebar", "top"]] = ["hidden", "sidebar"]
    if minor_version >= 46:
        nav_positions.append("top")

    position = st.selectbox(
        "Navigation position",
        nav_positions,
        index=nav_positions.index("sidebar"),
        key="navigation_position",
    )

    def _nav_home() -> None:
        st.write("Home page")

    def _nav_about() -> None:
        st.write("About page")

    def _nav_contact() -> None:
        st.write("Contact page")

    def _nav_logs() -> None:
        st.write("Logs page")

    def _nav_data_visualizations() -> None:
        st.write("Data visualizations page")

    def _nav_analytics() -> None:
        st.write("Analytics page")

    def _nav_calculator() -> None:
        st.write("Calculator page")

    def _nav_editor() -> None:
        st.write("Editor page")

    def _nav_viewer() -> None:
        st.write("Viewer page")

    def _nav_converter() -> None:
        st.write("Converter page")

    def _nav_import() -> None:
        st.write("Import page")

    def _nav_export() -> None:
        st.write("Export page")

    def _nav_transform() -> None:
        st.write("Transform page")

    def _nav_settings() -> None:
        st.write("Settings page")

    def _nav_users() -> None:
        st.write("Users page")

    many_pages = st.session_state.get("many_pages", False)
    nav_sections = st.session_state.get("nav_sections", True)

    pages: dict[str, list[StreamlitPage]]
    if many_pages:
        pages = {
            "General": [
                st.Page(_nav_home, title="Home", icon=":material/home:"),
                st.Page(
                    _nav_data_visualizations,
                    title="Data visualizations",
                    icon=":material/monitoring:",
                ),
                st.Page(_nav_analytics, title="Analytics", icon=":material/analytics:"),
            ],
            "Tools": [
                st.Page(
                    _nav_calculator, title="Calculator", icon=":material/calculate:"
                ),
                st.Page(_nav_editor, title="Editor", icon=":material/edit:"),
                st.Page(_nav_viewer, title="Viewer", icon=":material/visibility:"),
                st.Page(
                    _nav_converter, title="Converter", icon=":material/swap_horiz:"
                ),
            ],
            "Data": [
                st.Page(_nav_import, title="Import", icon=":material/file_upload:"),
                st.Page(_nav_export, title="Export", icon=":material/file_download:"),
                st.Page(_nav_transform, title="Transform", icon=":material/transform:"),
            ],
            "Admin": [
                st.Page(_nav_settings, title="Settings", icon=":material/settings:"),
                st.Page(_nav_users, title="Users", icon=":material/people:"),
                st.Page(_nav_logs, title="Logs", icon=":material/history:"),
            ],
        }
    else:
        pages = {
            "General": [
                st.Page(_nav_home, title="Home", icon=":material/home:"),
                st.Page(_nav_about, title="About", icon=":material/info:"),
            ],
            "Admin": [
                st.Page(_nav_contact, title="Contact", icon=":material/contact_mail:")
            ],
        }

    navigation_pages: list[StreamlitPage] | dict[str, list[StreamlitPage]]
    if nav_sections:
        navigation_pages = pages
    else:
        navigation_pages = [page for section in pages.values() for page in section]

    nav = st.navigation(navigation_pages, position=position)
    nav.run()


def _render_context() -> None:
    st.header("Streamlit context")
    context_values: dict[str, str] = {}
    for attr in dir(st.context):
        if attr.startswith("_"):
            continue
        try:
            context_values[attr] = str(getattr(st.context, attr))
        except Exception as ex:
            context_values[attr] = f"Error: {ex}"
    st.json(context_values)


def _render_authentication(minor_version: int) -> None:
    if minor_version < 42:
        return

    st.header("Authentication")
    if st.button("Login", key="login_button") and hasattr(st, "login"):
        try:
            st.login()
        except Exception as ex:
            st.info(f"Login unavailable in this environment: {ex}")


def _render_utilities() -> None:
    st.header("Utility elements")
    with st.echo():
        st.write("Echo")
    st.help(st.write)

    duration = cast(
        "Literal['short', 'long', 'infinite']",
        st.segmented_control(
            "Toast duration",
            ["short", "long", "infinite"],
            default="short",
            key="toast_duration",
        ),
    )
    if st.button("Show toast", key="toast_button"):
        st.toast("Hello there!", icon="🎈", duration=duration)
    if st.button("Run status", key="status_button"):
        with st.status("Working...", expanded=True) as status:
            st.write("Status step 1")
            st.write("Status step 2")
            status.update(label="Done", state="complete")
    if st.button("Run progress", key="progress_button"):
        progress_bar = st.progress(0)
        for percent_complete in range(0, 101, 25):
            progress_bar.progress(percent_complete)
    if st.button("Run spinner", key="spinner_button"):
        with st.spinner("Wait!", show_time=True):
            st.write("Spinner finished")
    if st.button("Add query params", key="query_params_button"):
        st.query_params["test"] = "1"
        st.query_params["bvt"] = "true"
    st.write("Query params", dict(st.query_params))

    st.session_state.setdefault("key", True)
    st.write(st.session_state["key"])


def _render_pdf(minor_version: int) -> None:
    if minor_version < 49 or not hasattr(st, "pdf"):
        return

    show_pdf = st.toggle("Show PDF", False, key="show_pdf")
    if not show_pdf:
        return

    st.header("PDF element")
    uploaded = st.file_uploader("Upload a PDF", type="pdf", key="pdf_upload")
    st.pdf(uploaded if uploaded is not None else _DUMMY_PDF, height=240)


def _render_stop_section() -> None:
    st.header("Stop behavior")
    st.text("Text before stop")
    if st.button("Run st.stop", key="stop_button"):
        st.stop()
    st.text("Text after stop")


layout_mode: Literal["wide", "centered"] = (
    "wide" if st.session_state.get("wide_mode", True) else "centered"
)
st.set_page_config(
    page_title="Mega tester app",
    page_icon="🎈",
    layout=layout_mode,
    initial_sidebar_state="expanded",
)

st.title("🎈 Mega tester app")

minor = _minor_version()
help_text, disabled = _render_sidebar_controls()

_render_packages_and_magic()
_render_map_and_media(minor)
_render_data_display(minor, help_text, disabled)
_render_charts(minor)
_render_custom_ui(minor)
_render_inputs(minor, help_text, disabled)
_render_text_elements(minor, help_text)
_render_blocks(minor, help_text, disabled)
_render_navigation(minor)
_render_context()
_render_authentication(minor)
_render_utilities()
_render_pdf(minor)
_render_stop_section()
