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

import os
import threading
from typing import TYPE_CHECKING, Final

from streamlit import util
from streamlit.components.types.base_component_registry import BaseComponentRegistry
from streamlit.errors import StreamlitAPIException
from streamlit.logger import get_logger

if TYPE_CHECKING:
    from streamlit.components.types.base_custom_component import BaseCustomComponent

_LOGGER: Final = get_logger(__name__)


class LocalComponentRegistry(BaseComponentRegistry):
    def __init__(self) -> None:
        self._components: dict[str, BaseCustomComponent] = {}
        self._lock = threading.Lock()

    def __repr__(self) -> str:
        return util.repr_(self)

    def register_component(self, component: BaseCustomComponent) -> None:
        """Register a CustomComponent.

        Parameters
        ----------
        component : BaseCustomComponent
            The component to register.
        """

        # Validate the component's path
        abspath = component.abspath
        if abspath is not None and not os.path.isdir(abspath):
            raise StreamlitAPIException(f"No such component directory: '{abspath}'")

        with self._lock:
            existing = self._components.get(component.name)
            self._components[component.name] = component

        if existing is not None and component != existing:
            _LOGGER.warning(
                "%s overriding previously-registered %s",
                component,
                existing,
            )

        _LOGGER.debug("Registered component %s", component)

    def get_component_path(self, name: str) -> str | None:
        """Return the filesystem path for the component with the given name.

        If no such component is registered, or if the component exists but is
        being served from a URL, return None instead.
        """
        component = self._components.get(name, None)
        return component.abspath if component is not None else None

    def get_module_name(self, name: str) -> str | None:
        component = self._components.get(name, None)
        return component.module_name if component is not None else None

    def get_component(self, name: str) -> BaseCustomComponent | None:
        return self._components.get(name, None)

    def get_components(self) -> list[BaseCustomComponent]:
        return list(self._components.values())
