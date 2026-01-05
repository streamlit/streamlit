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

import inspect
import os
from pathlib import Path
from typing import TYPE_CHECKING

from streamlit import config
from streamlit.components.v1.custom_component import CustomComponent
from streamlit.runtime import get_instance
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx

if TYPE_CHECKING:
    from types import FrameType

    from streamlit.components.types.base_component_registry import BaseComponentRegistry


def _get_module_name(caller_frame: FrameType) -> str:
    # Get the caller's module name. `__name__` gives us the module's
    # fully-qualified name, which includes its package.
    module = inspect.getmodule(caller_frame)
    if module is None:
        raise RuntimeError("module is None. This should never happen.")
    module_name = module.__name__

    # If the caller was the main module that was executed (that is, if the
    # user executed `python my_component.py`), then this name will be
    # "__main__" instead of the actual package name. In this case, we use
    # the main module's filename, sans `.py` extension, as the component name.
    if module_name == "__main__":
        file_path = inspect.getfile(caller_frame)
        filename = os.path.basename(file_path)
        module_name, _ = os.path.splitext(filename)

    return module_name


def declare_component(
    name: str,
    path: str | Path | None = None,
    url: str | None = None,
) -> CustomComponent:
    """Create a custom component and register it if there is a ``ScriptRunContext``.

    The component is not registered when there is no ``ScriptRunContext``.
    This can happen when a ``CustomComponent`` is executed as standalone
    command (e.g. for testing).

    To use this function, import it from the ``streamlit.components.v1``
    module.

    .. warning::
        Using ``st.components.v1.declare_component`` directly (instead of
        importing its module) is deprecated and will be disallowed in a later
        version.

    Parameters
    ----------
    name : str
        A short, descriptive name for the component, like "slider".

    path: str, Path, or None
        The path to serve the component's frontend files from. The path should
        be absolute. If ``path`` is ``None`` (default), Streamlit will serve
        the component from the location in ``url``. Either ``path`` or ``url``
        must be specified. If both are specified, then ``url`` will take
        precedence.

    url: str or None
        The URL that the component is served from. If ``url`` is ``None``
        (default), Streamlit will serve the component from the location in
        ``path``. Either ``path`` or ``url`` must be specified. If both are
        specified, then ``url`` will take precedence.


    Returns
    -------
    CustomComponent
        A ``CustomComponent`` that can be called like a function.
        Calling the component will create a new instance of the component
        in the Streamlit app.

    """
    if path is not None and isinstance(path, Path):
        path = str(path)

    # Get our stack frame.
    current_frame: FrameType | None = inspect.currentframe()
    if current_frame is None:
        raise RuntimeError("current_frame is None. This should never happen.")
    # Get the stack frame of our calling function.
    caller_frame = current_frame.f_back
    if caller_frame is None:
        raise RuntimeError("caller_frame is None. This should never happen.")

    module_name = _get_module_name(caller_frame)

    # Build the component name.
    component_name = f"{module_name}.{name}"

    # NOTE: We intentionally don't mention this behavior in this function's
    # docstring as we're only using it internally for now (the config option
    # is also hidden). This should be properly documented if/when we do decide
    # to expose it more publicly.
    if not url and (
        component_base_path := config.get_option("server.customComponentBaseUrlPath")
    ):
        url = f"{component_base_path}/{component_name}/"  # ty: ignore[possibly-unresolved-reference]

    # Create our component object, and register it.
    component = CustomComponent(
        name=component_name, path=path, url=url, module_name=module_name
    )
    # the ctx can be None if a custom component script is run outside of Streamlit, e.g. via 'python ...'
    ctx = get_script_run_ctx()
    if ctx is not None:
        get_instance().component_registry.register_component(component)
    return component


# Keep for backwards-compatibility for now as we don't know whether existing custom
# components use this method. We made significant refactors to the custom component
# registry code in https://github.com/streamlit/streamlit/pull/8193 and after
# that is out in the wild, we can follow-up with more refactorings, e.g. remove
# the following class and method. When we do that, we should conduct some testing with
# popular custom components.
class ComponentRegistry:
    @classmethod
    def instance(cls) -> BaseComponentRegistry:
        """Returns the ComponentRegistry of the runtime instance."""

        return get_instance().component_registry
