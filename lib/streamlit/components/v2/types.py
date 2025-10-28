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

"""Shared typing utilities for the `st.components.v2` API.

This module exposes common, user-facing argument types and callable
signatures used by the bidirectional component API. Import these types to
annotate code that constructs kwargs dictionaries for components, or when
authoring wrappers/utilities around `st.components.v2.component`.

The goal is to keep the public argument surface documented in one place and
reusable across both the user-facing factory in `components/v2/__init__.py`
and the internal implementation in `components/v2/bidi_component/main.py`.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Protocol

if TYPE_CHECKING:
    from streamlit.components.v2.bidi_component.state import BidiComponentResult
    from streamlit.elements.lib.layout_utils import Height, Width
    from streamlit.runtime.state.common import WidgetCallback


# Individual argument type aliases to make reuse ergonomic across modules.
BidiComponentKey = str | None
BidiComponentData = Any | None
BidiComponentDefaults = dict[str, Any] | None
ComponentIsolateStyles = bool


class BidiComponentCallable(Protocol):
    '''Signature of the mounting command returned by ``st.components.v2.component``.

    This callable mounts a bidirectional component in a Streamlit app and
    returns a ``BidiComponentResult`` object that exposes the component's
    state and trigger values.

    For published components, this callable is often wrapped in a user-friendly
    command with typed parameters and declared defaults.

    Parameters
    ----------
    key : str or None
        An optional string to use as the unique key for the
        component instance. If this is omitted, an internal key is generated
        for the component instance based on its mounting parameters. No two
        Streamlit elements may have the same key.

        When a key is defined, the component's state is available in Session
        State via the key.

        .. note::
            If you want to access this key in your component's frontend, you
            must pass it explicitly within the ``data`` parameter. The ``key``
            parameter in ``BidiComponentCallable`` is not the same as the
            ``key`` property in ``ComponentArgs`` in the component's frontend
            code.

            The frontend key is automatically generated to be unique among all
            instances of all components and to avoid collisions with classes
            and IDs in the app's DOM.

    data : Any or None
        Data to pass to the component. This can be one of the following:

        - A JSON-serializable object, like ``Dict[str, str | int]`` or
          ``List[str]``.
        - An Arrow-serializable object, like ``pandas.DataFrame``.
        - Raw bytes.
        - A dictionary of JSON-serializable and Arrow-serializable objects.
          The dictionary's keys must be Python primitives.

        Because this data is sent to the frontend, it must be serializable by
        one of the supported serialization methods (JSON, Arrow, or raw bytes).
        You can't pass arbitrary Python objects. Arrow-serialization is only
        supported at the top level of the ``data`` parameter or one level deep
        in a dictionary. Raw bytes are only supported at the top level.

    default : dict[str, Any] or None
        Default state values for the component. Each key in the dictionary must
        correspond to a valid state attribute with an ``on_<key>_change``
        callback. This callback can be empty, but must be included as a
        parameter when the component is mounted.

        Trigger values do not support manual defaults. All trigger and state
        values defined by an associated callback are initialized to ``None`` by
        default.

    width : "stretch", "content", or int
        Width of the component. This can be one of the following:

        - ``"stretch"`` (default): The component is wrapped in a ``<div>`` with
          CSS style ``width: 100%;``.
        - ``"content"``: The component is wrapped in a ``<div>`` with CSS
          style ``width: fit-content;``.
        - An integer specifying the width in pixels: The component is wrapped
          in a ``<div>`` with the specified pixel width.

        You are responsible for ensuring the component's inner HTML content is
        responsive to the ``<div>`` wrapper.

    height : "content", "stretch", or int
        Height of the component. This can be one of the following:

        - ``"content"`` (default): The component is wrapped in a ``<div>`` with
          CSS style ``height: auto;``.
        - ``"stretch"``: The component is wrapped in a ``<div>`` with CSS
          style ``height: 100%;``.
        - An integer specifying the height in pixels: The component is wrapped
          in a ``<div>`` with the specified pixel height. If the component
          content is larger than the specified height, scrolling is enabled.

        .. note::
            Use scrolling containers sparingly. If you use scrolling
            containers, avoid heights that exceed 500 pixels. Otherwise,
            the scroll surface of the container might cover the majority of
            the screen on mobile devices, which makes it hard to scroll the
            rest of the app.

            If you want to disable scrolling for a fixed-height component,
            include an inner ``<div>`` wrapper in your component's HTML to
            control the overflow behavior.

        You are responsible for ensuring the component's inner HTML content is
        responsive to the ``<div>`` wrapper.

    isolate_styles : bool
        Whether to sandbox the component styles in a shadow root. If this is
        ``True`` (default), the component's HTML is mounted inside a shadow DOM
        and, in your component's JavaScript, ``parentElement`` returns a
        ``ShadowRoot``. If this is ``False``, the component's HTML is mounted
        directly into the app's DOM tree, and ``parentElement`` returns a
        regular ``HTMLElement``.

    **callbacks : Callable or None
        Callbacks with the naming pattern ``on_<key>_change`` for each state and
        trigger key. For example, if your component has a state key of
        ``"value"`` and a trigger key of ``"click"``, its callbacks can include
        ``on_value_change`` and ``on_click_change``.

        Only names that follow this pattern are recognized. Custom components
        don't currently support callbacks with arguments.

        Callbacks are required for any state values defined in the ``default``
        parameter. Otherwise, a callback is optional. To ensure your
        component's result always returns the expected attributes, you can pass
        empty callbacks like ``lambda: None``.

    Returns
    -------
    BidiComponentResult
        Component state object that exposes state and trigger values.

    Examples
    --------
    **Example 1: Create a bidirectional text input component**

    If you assign a key to a mounted instance of a component, you can feed its
    state back into the component through the ``data`` parameter. This allows
    you to both read and write state values from Session State. The following
    example has a user-friendly wrapper around the mounting command to provide
    typed parameters and a clean end-user API. A couple buttons demonstrate
    programmatic updates to the component's state.

    .. code-block:: python

        import streamlit as st

        HTML = """
            <label style='padding-right: 1em;' for='txt'>Enter text</label>
            <input id='txt' type='text' />
        """

        JS = """
            export default function(component) {
                const { setStateValue, parentElement, data } = component;

                const label = parentElement.querySelector('label');
                label.innerText = data.label;

                const input = parentElement.querySelector('input');
                if (input.value !== data.value) {
                    input.value = data.value ?? '';
                };

                input.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        setStateValue('value', e.target.value);
                    }
                };

                input.onblur = (e) => {
                    setStateValue('value', e.target.value);
                };
            }
        """

        my_component = st.components.v2.component(
            "my_text_input",
            html=HTML,
            js=JS,
        )


        def my_component_wrapper(
            label, *, default="", key=None, on_change=lambda: None
        ):
            component_state = st.session_state.get(key, {})
            value = component_state.get("value", default)
            data = {"label": label, "value": value}
            result = my_component(
                data=data,
                default={"value": value},
                key=key,
                on_value_change=on_change,
            )
            return result


        st.title("My custom component")

        if st.button("Hello World"):
            st.session_state["my_text_input_instance"]["value"] = "Hello World"
        if st.button("Clear text"):
            st.session_state["my_text_input_instance"]["value"] = ""
        result = my_component_wrapper(
            "Enter something",
            default="I love Streamlit!",
            key="my_text_input_instance",
        )

        st.write("Result:", result)
        st.write("Session state:", st.session_state)

    .. output ::
        https://doc-components-text-input.streamlit.app/
        height: 600px

    **Example 2: Add Tailwind CSS to a component**

    You can use the ``isolate_styles`` parameter to disable shadow DOM
    isolation and apply global styles like Tailwind CSS to your component. The
    following example creates a simple button styled with Tailwind CSS. This
    example also demonstrates using different keys to mount multiple instances
    of the same component in one app.

    .. code-block:: python

        import streamlit as st

        with open("tailwind.js", "r") as f:
            TAILWIND_SCRIPT = f.read()

        HTML = """
            <button class="bg-blue-500 hover:bg-blue-700 text-white py-1 px-3 rounded">
                Click me!
            </button>
        """
        JS = (
            TAILWIND_SCRIPT
            + """
                export default function(component) {
                    const { setTriggerValue, parentElement } = component;
                    const button = parentElement.querySelector('button');
                    button.onclick = () => {
                        setTriggerValue('clicked', true);
                    };
                }
            """
        )
        my_component = st.components.v2.component(
            "my_tailwind_button",
            html=HTML,
            js=JS,
        )
        result_1 = my_component(
            isolate_styles=False, on_clicked_change=lambda: None, key="one"
        )
        result_1

        result_2 = my_component(
            isolate_styles=False, on_clicked_change=lambda: None, key="two"
        )
        result_2

    .. output ::
        https://doc-components-tailwind-button.streamlit.app/
        height: 350px

    '''

    def __call__(
        self,
        *,
        key: BidiComponentKey = None,
        data: BidiComponentData = None,
        default: BidiComponentDefaults = None,
        width: Width = "stretch",
        height: Height = "content",
        isolate_styles: ComponentIsolateStyles = True,
        **on_callbacks: WidgetCallback | None,
    ) -> BidiComponentResult: ...


__all__ = [
    "BidiComponentCallable",
    "BidiComponentData",
    "BidiComponentDefaults",
    "BidiComponentKey",
    "ComponentIsolateStyles",
]
