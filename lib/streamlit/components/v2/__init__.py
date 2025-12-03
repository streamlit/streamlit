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

"""Register the st.components.v2 API namespace."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from streamlit.components.v2.component_definition_resolver import (
    build_definition_with_validation,
)
from streamlit.components.v2.get_bidi_component_manager import (
    get_bidi_component_manager,
)
from streamlit.errors import StreamlitAPIException

if TYPE_CHECKING:
    from streamlit.components.v2.types import BidiComponentCallable

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.components.v2.bidi_component import BidiComponentResult
    from streamlit.elements.lib.layout_utils import Height, Width
    from streamlit.runtime.state.common import WidgetCallback


def _register_component(
    name: str,
    html: str | None = None,
    css: str | None = None,
    js: str | None = None,
) -> str:
    """Register a component and return its fully qualified key.

    This shared function handles the component registration and constructing a
    validated definition against any pre-registered components from
    ``pyproject.toml``.

    Parameters
    ----------
    name : str
        A short, descriptive identifier for the component.
    html : str or None
        Inline HTML markup for the component root.
    css : str | None
        Either inline CSS (string) or an asset-dir-relative path/glob to a
        ``.css`` file declared in the component's ``asset_dir``. Globs are
        allowed and must resolve to exactly one file within ``asset_dir``.
    js : str | None
        Either inline JavaScript (string) or an asset-dir-relative path/glob to
        a ``.js`` file declared in the component's ``asset_dir``. Globs are
        allowed and must resolve to exactly one file within ``asset_dir``.

    Returns
    -------
    str
        The fully qualified component key in the form ``<module_name>.<n>``.

    Raises
    ------
    StreamlitAPIException
        If ``css`` or ``js`` parameters are not strings or None.
    """
    # Parameter type guards: only strings or None are supported for js/css
    for _param_name, _param_value in (("css", css), ("js", js)):
        if _param_value is not None and not isinstance(_param_value, str):
            raise StreamlitAPIException(
                f"{_param_name} parameter must be a string or None. Pass a string path or glob."
            )

    component_key = name

    manager = get_bidi_component_manager()
    manager.register(
        build_definition_with_validation(
            manager=manager,
            component_key=component_key,
            html=html,
            css=css,
            js=js,
        )
    )

    # Record API inputs for future re-resolution on file changes
    manager.record_api_inputs(component_key, css, js)

    return component_key


def _create_component_callable(
    name: str,
    *,
    html: str | None = None,
    css: str | None = None,
    js: str | None = None,
) -> Callable[..., Any]:
    """Create a component callable, handling both lookup and registration cases.

    Parameters
    ----------
    name : str
        A short, descriptive identifier for the component.
    html : str | None
        Inline HTML markup for the component root.
    css : str | None
        Inline CSS (string) or a string path/glob to a file under ``asset_dir``;
        see :func:`_register_component` for path validation semantics.
    js : str | None
        Inline JavaScript (string) or a string path/glob to a file under
        ``asset_dir``; see :func:`_register_component` for path validation semantics.

    Returns
    -------
    Callable[..., Any]
        A function that, when called inside a Streamlit script, mounts the
        component and returns its state.

    Raises
    ------
    StreamlitAPIException
        If a component is not found in the registry.
    """
    component_key = _register_component(name=name, html=html, css=css, js=js)

    # The inner callable that mounts the component.
    def _mount_component(
        *,
        key: str | None = None,
        data: Any | None = None,
        default: dict[str, Any] | None = None,
        width: Width = "stretch",
        height: Height = "content",
        isolate_styles: bool = True,
        **on_callbacks: WidgetCallback | None,
    ) -> BidiComponentResult:
        """Mount the component.

        Parameters
        ----------
        key : str or None
            An optional string to use as the unique key for the component.
        data : Any or None
            Data to pass to the component (JSON-serializable).
        default : dict[str, Any] or None
            A dictionary of default values for state properties. Keys must
            correspond to valid state names (those with on_*_change callbacks).
        width : Width
            The width of the component.
        height : Height
            The height of the component.
        isolate_styles : bool
            Whether to sandbox the component styles in a shadow-root. Defaults to
            True.
        **on_callbacks : WidgetCallback
            Callback functions for handling component events. Use pattern
            on_{state_name}_change (e.g., on_click_change, on_value_change).

        Returns
        -------
        BidiComponentResult
            Component state.
        """
        import streamlit as st

        return st._bidi_component(
            component_key,
            key=key,
            isolate_styles=isolate_styles,
            data=data,
            default=default,
            width=width,
            height=height,
            **on_callbacks,
        )

    # Ensure the function remains compatible with the shared public callable type.
    # Static type assertion to ensure the callable matches the shared signature
    _typed_check_mount_component: BidiComponentCallable = _mount_component

    return _mount_component


def component(
    name: str,
    *,
    html: str | None = None,
    css: str | None = None,
    js: str | None = None,
) -> BidiComponentCallable:
    '''Register an ``st.components.v2`` component and return a callable to mount it.

    A component must have HTML, JavaScript, or both. If you want a component
    with only CSS, use ``st.html`` instead.

    If your component is defined in an installed package, you can declare an
    asset directory (``asset_dir``) through ``pyproject.toml`` files in the
    package. This allows you to serve component assets and reference them by
    path or glob in the ``html``, ``css``, and ``js`` parameters. Otherwise,
    you must provide raw HTML, CSS, and/or JavaScript strings directly to these
    parameters.

    .. important::
        When using paths or globs to define one or more component assets, the
        paths must be relative to the component's ``asset_dir`` as declared in
        the component manifest. This is only possible for installed components.

        For security reasons, absolute paths and path traversals are rejected.
        Because of runtime constraints, paths and globs must be provided as
        strings and not ``Path`` objects.

    Parameters
    ----------
    name : str
        A short, descriptive identifier for the component. This is used
        internally by Streamlit to manage instances of the component.

        Component names must be unique across an app. The names of imported
        components are prefixed by their module name to avoid collisions.

        If you register multiple components with the same name, a warning is
        logged and the last-registered component is used. Because this can lead
        to unexpected behavior, ensure that component names are unique. If you
        intend to have multiple instances of a component in one app, avoid
        wrapping a component definition together with its mounting command so
        you don't re-register your component with each instance.

    html : str or None
        Inline HTML markup for the component root. This can be one of the
        following strings:

        - Raw HTML. This doesn't require any ``<html>``, ``<head>``, or
          ``<body>`` tags; just provide the inner HTML.
        - A path or glob to an HTML file, relative to the component's
          asset directory.

        If any HTML depends on data passed at mount time, use a placeholder
        element and populate it via JavaScript. Alternatively, you can append
        a new element to the parent. For more information, see Example 2.

        ``html`` and ``js`` can't both be ``None``. At least one of them must
        be provided.

    css : str or None
        Inline CSS. This can be one of the following strings:

        - Raw CSS (without a ``<style>`` block).
        - A path or glob to a CSS file, relative to the component's
          asset directory.

    js : str or None
        Inline JavaScript. This can be one of the following strings:

        - Raw JavaScript (without a ``<script>`` block).
        - A path or glob to a JS file, relative to the component's
          asset directory.

        ``html`` and ``js`` can't both be ``None``. At least one of them must
        be provided.

    Returns
    -------
    BidiComponentCallable
        The component's mounting command.

        This callable accepts the component parameters like ``key`` and
        ``data`` and returns a ``BidiComponentResult`` object with the
        component's state. The mounting command can be included in a
        user-friendly wrapper function to provide a simpler API. A mounting
        command can be called multiple times in an app to create multiple
        instances of the component.

    Examples
    --------
    **Example 1: Create a JavaScript-only component that captures link clicks**

    You can create a simple component that allows inline links to communicate
    with Python. Normally, clicking links in a Streamlit app would start a new
    session. This component captures link clicks and sends them to Python as
    trigger values.

    .. code-block:: python

        import streamlit as st

        JS = """
        export default function(component) {
            const { setTriggerValue } = component;
            const links = document.querySelectorAll('a[href="#"]');

            links.forEach((link) => {
                link.onclick = (e) => {
                    setTriggerValue('clicked', link.innerHTML);
                };
            });
        }
        """

        my_component = st.components.v2.component(
            "inline_links",
            js=JS,
        )

        result = my_component(on_clicked_change=lambda: None)

        st.markdown(
            "Components aren't [sandboxed](#), so you can write JS that [interacts](#) with the main [document](#)."
        )

        if result.clicked:
            st.write(f"You clicked {result.clicked}!")

    .. output::
        https://doc-components-markdown-links.streamlit.app/
        height: 250px

    **Example 2: Display a paragraph with custom inline links**

    If you want to dynamically pass custom data from inline links, you can pass
    HTML to the ``data`` parameter of the component's mount command. When a
    link is clicked, the component sets a trigger value from the link's
    ``data-link`` HTML attribute.

    .. warning::

        If you directly modify the inner HTML of the parent element, you will
        overwrite the HTML and CSS passed to the component. Instead, create a
        new child element and set its inner HTML. You can create the
        placeholder dynamically in JavaScript or include it in the ``html``
        parameter.

    .. code-block:: python

        import streamlit as st

        CSS = """
        a {
            color: var(--st-link-color);
        }
        """

        JS = """
        export default function(component) {
            const { data, setTriggerValue, parentElement } = component;
            const newElement = document.createElement('div');
            parentElement.appendChild(newElement);
            newElement.innerHTML = data;

            const links = newElement.querySelectorAll('a');

            links.forEach((link) => {
                link.onclick = (e) => {
                    setTriggerValue('clicked', link.getAttribute('data-link'));
                };
            });
        }
        """

        my_component = st.components.v2.component(
            "inline_links",
            css=CSS,
            js=JS,
        )

        paragraph_html = """
        <p>This is an example paragraph with inline links. To see the response in
        Python, click on the <a href="#" data-link="link_1">first link</a> or
        <a href="#" data-link="link_2">second link</a>.</p>
        """

        result = my_component(data=paragraph_html, on_clicked_change=lambda: None)
        if result.clicked == "link_1":
            st.write("You clicked the first link!")
        elif result.clicked == "link_2":
            st.write("You clicked the second link!")

    .. output::
        https://doc-components-custom-anchors.streamlit.app/
        height: 250px

    **Example 3: Display an interactive SVG image**

    You can create a component that displays an SVG image with clickable
    shapes. When a shape is clicked, the component sends the shape type to
    Python as a trigger value.

    .. code-block:: python

        import streamlit as st

        HTML = """
        <p>Click on the triangle, square, or circle to interact with the shapes:</p>

        <svg width="400" height="300">
            <polygon points="100,50 50,150 150,150" data-shape="triangle"></polygon>
            <rect x="200" y="75" width="100" height="100" data-shape="square"></rect>
            <circle cx="125" cy="225" r="40" data-shape="circle"></circle>
        </svg>
        """

        JS = """
        export default function(component) {
            const { setTriggerValue, parentElement } = component;
            const shapes = parentElement.querySelectorAll('[data-shape]');

            shapes.forEach((shape) => {
                shape.onclick = (e) => {
                    setTriggerValue('clicked', shape.getAttribute('data-shape'));
                };
            });
        }
        """

        CSS = """
        polygon, rect, circle {
            stroke: var(--st-primary-color);
            stroke-width: 2;
            fill: transparent;
            cursor: pointer;
        }
        polygon:hover, rect:hover, circle:hover {
            fill: var(--st-secondary-background-color);
        }
        """

        my_component = st.components.v2.component(
            "clickable_svg",
            html=HTML,
            css=CSS,
            js=JS,
        )

        result = my_component(on_clicked_change=lambda: None)
        result

    .. output::
        https://doc-components-interactive-svg.streamlit.app/
        height: 550px

    **Example 4: Clean up your component's resources**

    You can use the return value of the component's JavaScript function to
    clean up any resources when the component is unmounted. For example, you
    can disconnect a MutationObserver that was monitoring changes in the DOM.

    .. code-block:: python

        import streamlit as st

        JS = """
        export default function(component) {
            const { setStateValue, parentElement } = component;
            const sidebar = document.querySelector('section.stSidebar');
            const initialState = sidebar.getAttribute('aria-expanded') === 'true';

            // Create observer to watch for aria-expanded attribute changes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'aria-expanded') {
                        const newIsExpanded = sidebar.getAttribute('aria-expanded') === 'true';
                        setStateValue('expanded', newIsExpanded);
                    }
                });
            });

            // Start observing
            observer.observe(sidebar, {
                attributes: true,
                attributeFilter: ['aria-expanded']
            });

            // Set initial state
            setStateValue('expanded', initialState);

            // Cleanup function to remove the observer
            return () => {
                observer.disconnect();
            };

        };
        """

        my_component = st.components.v2.component(
            "sidebar_expansion_detector",
            js=JS,
        )

        st.sidebar.write("Sidebar content")
        result = my_component(on_expanded_change=lambda: None)
        result

    .. output::
        https://doc-components-cleanup-function.streamlit.app/
        height: 250px

    '''
    return _create_component_callable(name, html=html, css=css, js=js)


__all__ = [
    "component",
]
