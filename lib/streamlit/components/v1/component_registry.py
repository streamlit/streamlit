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

import inspect
import os
import threading

from streamlit.components.v1.base_component_registry import BaseComponentRegistry
from streamlit.components.v1.custom_component import CustomComponent
from streamlit.errors import CustomComponentError


def declare_component(
    name: str,
    path: str | None = None,
    url: str | None = None,
) -> CustomComponent:
    """Create and register a custom component.

    Parameters
    ----------
    name: str
        A short, descriptive name for the component. Like, "slider".
    path: str or None
        The path to serve the component's frontend files from. Either
        `path` or `url` must be specified, but not both.
    url: str or None
        The URL that the component is served from. Either `path` or `url`
        must be specified, but not both.

    Returns
    -------
    CustomComponent
        A CustomComponent that can be called like a function.
        Calling the component will create a new instance of the component
        in the Streamlit app.

    """

    # Get our stack frame.
    current_frame = inspect.currentframe()
    assert current_frame is not None

    # Get the stack frame of our calling function.
    caller_frame = current_frame.f_back
    assert caller_frame is not None

    # Get the caller's module name. `__name__` gives us the module's
    # fully-qualified name, which includes its package.
    module = inspect.getmodule(caller_frame)
    assert module is not None
    module_name = module.__name__

    # If the caller was the main module that was executed (that is, if the
    # user executed `python my_component.py`), then this name will be
    # "__main__" instead of the actual package name. In this case, we use
    # the main module's filename, sans `.py` extension, as the component name.
    if module_name == "__main__":
        file_path = inspect.getfile(caller_frame)
        filename = os.path.basename(file_path)
        module_name, _ = os.path.splitext(filename)

    # Build the component name.
    component_name = f"{module_name}.{name}"

    # Create our component object, and register it.
    component = CustomComponent(
        name=component_name, path=path, url=url, module_name=module_name
    )
    ComponentRegistry.instance().register_component(component)

    return component


class ComponentRegistry:
    _instance_lock: threading.Lock = threading.Lock()
    _instance: BaseComponentRegistry | None = None

    @classmethod
    def instance(cls) -> BaseComponentRegistry:
        """Returns the singleton ComponentRegistry

        :raises:
            CustomComponentError: If no ComponentRegistry has been initialized
        """

        if cls._instance is None:
            raise CustomComponentError("No ComponentRegistry has been initialized")

        return cls._instance

    @classmethod
    def initialize(cls, registry: BaseComponentRegistry) -> None:
        """Register ComponentRegistry as the one used by the runtime

        :raises:
            CustomComponentError: If a ComponentRegistry is already initialized
        """

        # We use a double-checked locking optimization to avoid the overhead
        # of acquiring the lock in the common case:
        # https://en.wikipedia.org/wiki/Double-checked_locking
        if cls._instance is not None:
            raise CustomComponentError("ComponentRegistry is already initialized")
        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = registry
