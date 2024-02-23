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

from abc import ABC, abstractmethod

from streamlit import util
from streamlit.components.v1.custom_component import CustomComponent


class BaseComponentRegistry(ABC):
    def __init__(self):
        """Init instance"""

    def __repr__(self) -> str:
        return util.repr_(self)

    @abstractmethod
    def register_component(self, component: CustomComponent) -> None:
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

        If no such component us registered, return None instead.

        Returns
        -------
        str or None
            The module_name of the specified component or None if no component with the given name has been registered.
        """
        raise NotImplementedError

    @abstractmethod
    def get_components(self) -> list[CustomComponent]:
        """Returns a list of custom components that are registered."""
        raise NotImplementedError
