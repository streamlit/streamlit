# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

"""Test the components logic and that custom components work.

This test app includes some component actions as well as the top N most popular custom components based on our usage metrics.
The function for the component is imported when the respective option is selected in the selection-widget.
Also, some example action is executed on the component.
If the component cannot be imported or the component itself has some issue, e.g. some transitive import does not work,
an exception is shown.
This is some guard for us to detect potential issues in case of refactorings etc.

Following actions/components are tested:
- components.html (this function and its import is popularily documented in some places)
- extra-streamlit-components (CookieManager)
- streamlit-ace
- streamlit-antd-components
- streamlit-aggrid
- streamlit-autorefresh
- streamlit-chat
- streamlit-echarts
- streamlit-folium
- streamlit-option-menu
- streamlit-url-fragment
"""

from __future__ import annotations

from typing import Callable

import streamlit as st


def use_components_html():
    # note that we import streamlit before and so this `components.html` working
    # might be coincidental; this is the reason why we have dedicated tests for this kind of imports in the `st_components_v1_*` files
    import streamlit.components.v1 as components

    components.html("<div>Hello World!</div>")


def use_components_iframe():
    # note that we import streamlit before and so this `components.html` working
    # might be coincidental; this is the reason why we have dedicated tests for this kind of imports in the `st_components_v1_*` files
    import streamlit.components.v1 as components

    st.write(str(components.iframe))


def use_components_declare_component():
    import streamlit.components.v1 as components

    st.write(str(components.declare_component))


# Different custom components:
def use_streamlit_ace():
    from streamlit_ace import st_ace

    ## Spawn a new Ace editor
    content = st_ace()
    st.write(content)


def use_aggrid():
    import numpy as np
    import pandas as pd
    from st_aggrid import AgGrid

    np.random.seed(0)
    df = pd.DataFrame(
        np.random.choice(100, size=(100, 4)), columns=["A", "B", "C", "D"]
    )
    AgGrid(df, height=200)


def use_antd():
    import streamlit_antd_components as sac

    btn = sac.buttons(
        items=["button1", "button2", "button3"],
        index=0,
        format_func="title",
        align="center",
        direction="horizontal",
        radius="lg",
        return_index=False,
    )
    st.write(f"The selected button label is: {btn}")


def use_autorefresh():
    from streamlit_autorefresh import st_autorefresh

    ## Run the autorefresh about every 2000 milliseconds (2 seconds) and stop
    ## after it's been refreshed 100 times.
    count = st_autorefresh(interval=2000, limit=100, key="fizzbuzzcounter")
    ## The function returns a counter for number of refreshes. This allows the
    ## ability to make special requests at different intervals based on the count
    if count == 0:
        st.write("Count is zero")
    elif count % 3 == 0 and count % 5 == 0:
        st.write("FizzBuzz")
    elif count % 3 == 0:
        st.write("Fizz")
    elif count % 5 == 0:
        st.write("Buzz")
    else:
        st.write(f"Count: {count}")


def use_chat():
    from streamlit_chat import message

    message("My message")
    message("Hello bot!", is_user=True)  # align's the message to the right


def use_echarts():
    from streamlit_echarts import st_echarts

    options = {
        "xAxis": {
            "type": "category",
            "data": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        },
        "yAxis": {"type": "value"},
        "series": [{"data": [820, 932, 901, 934, 1290, 1330, 1320], "type": "line"}],
    }
    st_echarts(options=options)


def use_extra_streamlit_components():
    from extra_streamlit_components import CookieManager

    CookieManager()


def use_folium():
    import folium
    from streamlit_folium import st_folium

    ## center on Liberty Bell, add marker
    m = folium.Map(location=[39.949610, -75.150282], zoom_start=16)
    folium.Marker(
        [39.949610, -75.150282], popup="Liberty Bell", tooltip="Liberty Bell"
    ).add_to(m)
    ## call to render Folium map in Streamlit
    st_data = st_folium(m, width=725)
    st.write(st_data)


def use_option_menu():
    from streamlit_option_menu import option_menu

    key = "my_option_menu"

    # TODO: uncomment the on_change callback as soon as streamlit-option-menu is updated and uses the new on_change callback
    # def on_change():
    #     selection = st.session_state[key]
    #     st.write(f"Selection changed to {selection}")

    with st.sidebar:
        selected = option_menu(
            "Main Menu",
            ["Home", "Settings"],
            icons=["house", "gear"],
            menu_icon="cast",
            default_index=1,
            key=key,
            # on_change=on_change,
        )
        st.write(selected)


def use_url_fragment():
    from streamlit_url_fragment import get_fragment

    current_value = get_fragment()
    st.write(f"Current value: {current_value!r}")


# ---

options: dict[str, Callable] = {
    "componentsHtml": use_components_html,
    "componentsIframe": use_components_iframe,
    "componentsDeclareComponent": use_components_declare_component,
    "ace": use_streamlit_ace,
    "aggrid": use_aggrid,
    "antd": use_antd,
    "autorefresh": use_autorefresh,
    "chat": use_chat,
    "echarts": use_echarts,
    "extraStreamlitComponents": use_extra_streamlit_components,
    "folium": use_folium,
    "optionMenu": use_option_menu,
    "urlFragment": use_url_fragment,
}
component_selection = st.selectbox("ComponentSelections", options=options.keys())
if component_selection:
    options[component_selection]()
