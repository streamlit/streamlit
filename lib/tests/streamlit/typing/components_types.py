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

"""Type tests for the st.components namespace.

Covers ``st.components.v2.component``, ``st.components.v1.declare_component``,
and the deprecated ``st.components.v1.html`` / ``st.components.v1.iframe``
wrappers. ``st.html`` and ``st.iframe`` have their own typing tests.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, assert_type

# mypy and ty check this block. It is not executed at runtime.
if TYPE_CHECKING:
    from pathlib import Path

    import streamlit as st
    from streamlit.components.v1.custom_component import CustomComponent
    from streamlit.components.v2.bidi_component.state import ComponentResult
    from streamlit.components.v2.types import ComponentRenderer
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import Width

    component = st.components.v2.component
    declare_component = st.components.v1.declare_component
    html = st.components.v1.html
    iframe = st.components.v1.iframe

    def _on_change() -> None:
        pass

    # =====================================================================
    # st.components.v2.component
    # =====================================================================

    # Name only. HTML, CSS, and JS are optional.
    assert_type(component("clickable_svg"), ComponentRenderer)
    assert_type(component(name="clickable_svg"), ComponentRenderer)

    assert_type(component("clickable_svg", html="<svg></svg>"), ComponentRenderer)
    assert_type(component("clickable_svg", html=None), ComponentRenderer)
    assert_type(component("clickable_svg", css="svg { fill: red; }"), ComponentRenderer)
    assert_type(component("clickable_svg", css=None), ComponentRenderer)
    assert_type(
        component("clickable_svg", js="export default function() {}"),
        ComponentRenderer,
    )
    assert_type(component("clickable_svg", js=None), ComponentRenderer)
    # Asset paths are strings. Path objects are rejected.
    assert_type(component("clickable_svg", html="index.html"), ComponentRenderer)
    assert_type(component("clickable_svg", css="styles/*.css"), ComponentRenderer)
    assert_type(component("clickable_svg", js="main.js"), ComponentRenderer)

    assert_type(component("clickable_svg", isolate_styles=True), ComponentRenderer)
    assert_type(component("clickable_svg", isolate_styles=False), ComponentRenderer)
    isolate_styles: bool = True
    assert_type(
        component("clickable_svg", isolate_styles=isolate_styles), ComponentRenderer
    )

    my_component = component(
        "clickable_svg",
        html="<svg></svg>",
        css="svg {}",
        js="export default function() {}",
        isolate_styles=False,
    )
    assert_type(my_component, ComponentRenderer)

    # Mount arguments are keyword-only.
    assert_type(my_component(), ComponentResult)
    assert_type(my_component(key="shape"), ComponentResult)
    assert_type(my_component(key=123), ComponentResult)
    assert_type(my_component(key=None), ComponentResult)
    assert_type(my_component(data={"shape": "circle"}), ComponentResult)
    assert_type(my_component(data=b"raw"), ComponentResult)
    assert_type(my_component(data=None), ComponentResult)
    assert_type(my_component(default={"clicked": None}), ComponentResult)
    assert_type(my_component(default=None), ComponentResult)
    assert_type(my_component(width="stretch"), ComponentResult)
    assert_type(my_component(width="content"), ComponentResult)
    assert_type(my_component(width=300), ComponentResult)
    assert_type(my_component(height="content"), ComponentResult)
    assert_type(my_component(height="stretch"), ComponentResult)
    assert_type(my_component(height=200), ComponentResult)
    assert_type(my_component(on_clicked_change=_on_change), ComponentResult)
    assert_type(my_component(on_clicked_change=None), ComponentResult)

    width: Width = "stretch"
    assert_type(my_component(width=width), ComponentResult)

    result = my_component(
        key="shape",
        data={"label": "Click"},
        default={"clicked": None},
        width="content",
        height=200,
        on_clicked_change=_on_change,
    )
    assert_type(result, ComponentResult)
    # State keys are dynamic, so attribute and bracket access both work.
    assert_type(result.clicked, Any)
    assert_type(result["clicked"], Any)

    # html, css, and js are keyword-only.
    component("clickable_svg", "<svg></svg>")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    component(
        "clickable_svg",
        js=Path("main.js"),  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    )
    component(
        "clickable_svg",
        isolate_styles="yes",  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    )
    my_component("positional")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]
    my_component(width="invalid")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    my_component(key=1.5)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    my_component(default=["clicked"])  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    my_component(on_clicked_change="nope")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    # isolate_styles belongs on component(), not on the mount callable.
    my_component(isolate_styles=True)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    plain_width: str = "stretch"
    # A plain str is not a Width. ty accepts it, so only mypy is suppressed.
    my_component(width=plain_width)  # type: ignore[arg-type]

    # =====================================================================
    # st.components.v1.declare_component
    # =====================================================================

    assert_type(declare_component("slider", path="frontend"), CustomComponent)
    assert_type(declare_component("slider", "frontend"), CustomComponent)
    assert_type(declare_component("slider", path=Path("frontend")), CustomComponent)
    assert_type(
        declare_component("slider", url="http://localhost:3001"), CustomComponent
    )
    assert_type(
        declare_component("slider", None, "http://localhost:3001"), CustomComponent
    )
    assert_type(
        declare_component("slider", path=Path("frontend"), url="http://localhost:3001"),
        CustomComponent,
    )

    component_path: str | None = "frontend"
    component_url: str | None = None
    assert_type(
        declare_component("slider", component_path, component_url), CustomComponent
    )

    slider = declare_component("slider", url="http://localhost:3001")
    assert_type(slider, CustomComponent)
    assert_type(slider.name, str)
    assert_type(slider.path, str | None)
    assert_type(slider.url, str | None)
    assert_type(slider.abspath, str | None)
    assert_type(slider.module_name, str | None)

    assert_type(slider(), Any)
    assert_type(slider(default=0), Any)
    assert_type(slider(key="slider"), Any)
    assert_type(slider(key=None), Any)
    assert_type(slider(on_change=_on_change), Any)
    assert_type(slider(on_change=None), Any)
    assert_type(slider(tab_index=None), Any)
    assert_type(slider(tab_index=-1), Any)
    assert_type(slider(tab_index=0), Any)
    assert_type(slider(tab_index=1), Any)
    assert_type(slider(label="Amount", min_value=0), Any)
    assert_type(
        slider(
            default=0,
            key="slider",
            on_change=_on_change,
            tab_index=0,
            label="Amount",
            min_value=0,
        ),
        Any,
    )
    assert_type(slider.create_instance(default=1, key="other"), Any)

    # Either path or url is required.
    declare_component("slider")  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]
    declare_component("slider", path=1)  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]
    # Literal path=None with no url matches the dynamic-path overload, so it
    # type-checks. Runtime still raises. A str | None path must stay valid.
    declare_component("slider", path=None)

    # Positional arguments match *args: Never. mypy reports no matching
    # overload; ty reports an invalid argument type.
    slider("value")  # type: ignore[call-overload]  # ty: ignore[invalid-argument-type]
    slider.create_instance("value")  # type: ignore[call-overload]  # ty: ignore[invalid-argument-type]
    # Keys are strings.
    slider(key=123)  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]
    slider(tab_index="0")  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]

    # =====================================================================
    # Deprecated st.components.v1.html / st.components.v1.iframe
    # =====================================================================

    # Width and height are pixel counts. "stretch" and "content" are invalid.
    assert_type(html("<p>Hello</p>"), DeltaGenerator)
    assert_type(html("<p>Hello</p>", width=400), DeltaGenerator)
    assert_type(html("<p>Hello</p>", width=None), DeltaGenerator)
    assert_type(html("<p>Hello</p>", height=300), DeltaGenerator)
    assert_type(html("<p>Hello</p>", height=None), DeltaGenerator)
    assert_type(html("<p>Hello</p>", scrolling=True), DeltaGenerator)
    assert_type(html("<p>Hello</p>", scrolling=False), DeltaGenerator)
    scrolling: bool = True
    assert_type(html("<p>Hello</p>", scrolling=scrolling), DeltaGenerator)
    assert_type(html("<p>Hello</p>", tab_index=None), DeltaGenerator)
    assert_type(html("<p>Hello</p>", tab_index=-1), DeltaGenerator)
    assert_type(html("<p>Hello</p>", tab_index=0), DeltaGenerator)
    assert_type(html("<p>Hello</p>", tab_index=1), DeltaGenerator)
    assert_type(
        html(
            "<p>Hello</p>",
            width=400,
            height=300,
            scrolling=True,
            tab_index=0,
        ),
        DeltaGenerator,
    )
    assert_type(html("<p>Hello</p>", 400, 300, True), DeltaGenerator)

    assert_type(iframe("https://example.com"), DeltaGenerator)
    assert_type(iframe("https://example.com", width=800), DeltaGenerator)
    assert_type(iframe("https://example.com", width=None), DeltaGenerator)
    assert_type(iframe("https://example.com", height=600), DeltaGenerator)
    assert_type(iframe("https://example.com", height=None), DeltaGenerator)
    assert_type(iframe("https://example.com", scrolling=True), DeltaGenerator)
    assert_type(iframe("https://example.com", scrolling=False), DeltaGenerator)
    assert_type(iframe("https://example.com", scrolling=scrolling), DeltaGenerator)
    assert_type(iframe("https://example.com", tab_index=None), DeltaGenerator)
    assert_type(iframe("https://example.com", tab_index=-1), DeltaGenerator)
    assert_type(iframe("https://example.com", tab_index=0), DeltaGenerator)
    assert_type(iframe("https://example.com", tab_index=1), DeltaGenerator)
    assert_type(
        iframe(
            "https://example.com",
            width=800,
            height=600,
            scrolling=False,
            tab_index=-1,
        ),
        DeltaGenerator,
    )
    assert_type(iframe("https://example.com", 800, 600, False), DeltaGenerator)

    html("<p>Hello</p>", width="stretch")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    html(Path("index.html"))  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    html("<p>Hello</p>", alt="text")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
    html(
        "<p>Hello</p>",
        unsafe_allow_javascript=True,  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
    )
    # tab_index is keyword-only.
    html("<p>Hello</p>", None, None, False, 0)  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    iframe("https://example.com", width="content")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    iframe(Path("report.html"))  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    iframe("https://example.com", alt="Docs")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
    iframe("https://example.com", None, None, False, 0)  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]
