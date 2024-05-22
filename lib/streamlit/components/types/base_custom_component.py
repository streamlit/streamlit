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

from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any

from streamlit import util
from streamlit.errors import StreamlitAPIException

if TYPE_CHECKING:
    from streamlit.runtime.state.common import WidgetCallback


class MarshallComponentException(StreamlitAPIException):
    """Class for exceptions generated during custom component marshalling."""

    pass


class BaseCustomComponent(ABC):
    """Interface for CustomComponents."""

    def __init__(
        self,
        name: str,
        path: str | None = None,
        url: str | None = None,
        module_name: str | None = None,
    ):
        if (path is None and url is None) or (path is not None and url is not None):
            raise StreamlitAPIException(
                "Either 'path' or 'url' must be set, but not both."
            )

        self._name = name
        self._path = path
        self._url = url
        self._module_name = module_name

    def __repr__(self) -> str:
        return util.repr_(self)

    def __call__(
        self,
        *args,
        default: Any = None,
        key: str | None = None,
        on_change: WidgetCallback | None = None,
        **kwargs,
    ) -> Any:
        """An alias for create_instance."""
        return self.create_instance(
            *args,
            default=default,
            key=key,
            on_change=on_change,
            **kwargs,
        )

    @property
    def abspath(self) -> str | None:
        if self._path is None:
            return None
        return os.path.abspath(self._path)

    @property
    def module_name(self) -> str | None:
        return self._module_name

    @property
    def name(self) -> str:
        return self._name

    @property
    def path(self) -> str | None:
        return self._path

    @property
    def url(self) -> str | None:
        return self._url

    def __str__(self) -> str:
        return f"'{self.name}': {self.path if self.path is not None else self.url}"

    @abstractmethod
    def __eq__(self, other) -> bool:
        """Equality operator."""
        return NotImplemented

    @abstractmethod
    def __ne__(self, other) -> bool:
        """Inequality operator."""
        return NotImplemented

    @abstractmethod
    def create_instance(
        self,
        *args,
        default: Any = None,
        key: str | None = None,
        on_change: WidgetCallback | None = None,
        **kwargs,
    ) -> Any:
        """Create a new instance of the component.

        Parameters
        ----------
        *args
            Must be empty; all args must be named. (This parameter exists to
            enforce correct use of the function.)
        default: any or None
            The default return value for the component. This is returned when
            the component's frontend hasn't yet specified a value with
            `setComponentValue`.
        key: str or None
            If not None, this is the user key we use to generate the
            component's "widget ID".
        on_change: WidgetCallback or None
            An optional callback invoked when the widget's value changes. No arguments are passed to it.
        **kwargs
            Keyword args to pass to the component.

        Raises
        ------
        MarshallComponentException
            Raised when args is not empty or component cannot be marshalled.
        StreamlitAPIException
            Raised when PyArrow is not installed.

        Returns
        -------
        any or None
            The component's widget value.

        """
        raise NotImplementedError
