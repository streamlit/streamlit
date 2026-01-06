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

from abc import abstractmethod
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from streamlit.components.types.base_custom_component import BaseCustomComponent


class BaseComponentRegistry(Protocol):
    """Interface for ComponentRegistries."""

    @abstractmethod
    def register_component(self, component: BaseCustomComponent) -> None:
        """Register a CustomComponent.

        Parameters
        ----------
        component : CustomComponent
            The component to register.
        """
        raise NotImplementedError

    @abstractmethod
    def get_component_path(self, name: str) -> str | None:
        """Return the filesystem path for the component with the given name.

        If no such component is registered, or if the component exists but is
        being served from a URL, return None instead.

        Parameters
        ----------
        name: name of the component

        Returns
        -------
        str or None
            The name of the specified component or None if no component with the given name has been registered.
        """
        raise NotImplementedError

    @abstractmethod
    def get_module_name(self, name: str) -> str | None:
        """Return the module name for the component with the given name.

        If no such component is registered, return None instead.

        Parameters
        ----------
        name: name of the component

        Returns
        -------
        str or None
            The module_name of the specified component or None if no component with the given name has been registered.
        """
        raise NotImplementedError

    @abstractmethod
    def get_component(self, name: str) -> BaseCustomComponent | None:
        """Return the registered component with the given name.

        If no such component is registered, return None instead.

        Parameters
        ----------
        name: name of the component

        Returns
        -------
        component or None
            The component with the provided name or None if component with the given name has been registered.
        """
        raise NotImplementedError

    @abstractmethod
    def get_components(self) -> list[BaseCustomComponent]:
        """Returns a list of custom components that are registered in this registry.

        Returns
        -------
        list[CustomComponents]
            A list of registered custom components.
        """
        raise NotImplementedError
