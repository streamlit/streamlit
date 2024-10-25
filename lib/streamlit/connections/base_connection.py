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

import json
from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar

from streamlit.runtime.secrets import AttrDict, secrets_singleton
from streamlit.util import calc_md5

RawConnectionT = TypeVar("RawConnectionT")


class BaseConnection(ABC, Generic[RawConnectionT]):
    """The abstract base class that all Streamlit Connections must inherit from.

    This base class provides connection authors with a standardized way to hook into the
    ``st.connection()`` factory function: connection authors are required to provide an
    implementation for the abstract method ``_connect`` in their subclasses.

    Additionally, it also provides a few methods/properties designed to make
    implementation of connections more convenient. See the docstrings for each of the
    methods of this class for more information

    .. note::
        While providing an implementation of ``_connect`` is technically all that's
        required to define a valid connection, connections should also provide the user
        with context-specific ways of interacting with the underlying connection object.
        For example, the first-party SQLConnection provides a ``query()`` method for
        reads and a ``session`` property for more complex operations.
    """

    def __init__(self, connection_name: str, **kwargs) -> None:
        """Create a BaseConnection.

        This constructor is called by the connection factory machinery when a user
        script calls ``st.connection()``.

        Subclasses of BaseConnection that want to overwrite this method should take care
        to also call the base class' implementation.

        Parameters
        ----------
        connection_name : str
            The name of this connection. This corresponds to the
            ``[connections.<connection_name>]`` config section in ``st.secrets``.
        kwargs : dict
            Any other kwargs to pass to this connection class' ``_connect`` method.

        Returns
        -------
        None
        """
        self._connection_name = connection_name
        self._kwargs = kwargs

        self._config_section_hash = calc_md5(json.dumps(self._secrets.to_dict()))
        secrets_singleton.file_change_listener.connect(self._on_secrets_changed)

        self._raw_instance: RawConnectionT | None = self._connect(**kwargs)

    def __del__(self) -> None:
        secrets_singleton.file_change_listener.disconnect(self._on_secrets_changed)

    def __getattribute__(self, name: str) -> Any:
        try:
            return object.__getattribute__(self, name)
        except AttributeError as e:
            if hasattr(self._instance, name):
                raise AttributeError(
                    f"`{name}` doesn't exist here, but you can call `._instance.{name}` instead"
                )
            raise e

    def _repr_html_(self) -> str:
        """Return a human-friendly markdown string describing this connection.

        This is the string that will be written to the app if a user calls
        ``st.write(this_connection)``. Subclasses of BaseConnection can freely overwrite
        this method if desired.

        Returns
        -------
        str
        """
        module_name = getattr(self, "__module__", None)
        class_name = type(self).__name__

        cfg = (
            f"- Configured from `[connections.{self._connection_name}]`"
            if len(self._secrets)
            else ""
        )

        return f"""
---
**st.connection {self._connection_name} built from `{module_name}.{class_name}`**
{cfg}
- Learn more using `st.help()`
---
"""

    # Methods with default implementations that we don't expect subclasses to want or
    # need to overwrite.
    def _on_secrets_changed(self, _) -> None:
        """Reset the raw connection object when this connection's secrets change.

        We don't expect either user scripts or connection authors to have to use or
        overwrite this method.
        """
        new_hash = calc_md5(json.dumps(self._secrets.to_dict()))

        # Only reset the connection if the secrets file section specific to this
        # connection has changed.
        if new_hash != self._config_section_hash:
            self._config_section_hash = new_hash
            self.reset()

    @property
    def _secrets(self) -> AttrDict:
        """Get the secrets for this connection from the corresponding st.secrets section.

        We expect this property to be used primarily by connection authors when they
        are implementing their class' ``_connect`` method. User scripts should, for the
        most part, have no reason to use this property.
        """
        connections_section = None
        if secrets_singleton.load_if_toml_exists():
            connections_section = secrets_singleton.get("connections")

        if type(connections_section) is not AttrDict:
            return AttrDict({})

        return connections_section.get(self._connection_name, AttrDict({}))

    def reset(self) -> None:
        """Reset this connection so that it gets reinitialized the next time it's used.

        This method can be useful when a connection has become stale, an auth token has
        expired, or in similar scenarios where a broken connection might be fixed by
        reinitializing it. Note that some connection methods may already use ``reset()``
        in their error handling code.

        Returns
        -------
        None

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> conn = st.connection("my_conn")
        >>>
        >>> # Reset the connection before using it if it isn't healthy
        >>> # Note: is_healthy() isn't a real method and is just shown for example here.
        >>> if not conn.is_healthy():
        ...     conn.reset()
        >>>
        >>> # Do stuff with conn...
        """
        self._raw_instance = None

    @property
    def _instance(self) -> RawConnectionT:
        """Get an instance of the underlying connection, creating a new one if needed."""
        if self._raw_instance is None:
            self._raw_instance = self._connect(**self._kwargs)

        return self._raw_instance

    # Abstract fields/methods that subclasses of BaseConnection must implement
    @abstractmethod
    def _connect(self, **kwargs) -> RawConnectionT:
        """Create an instance of an underlying connection object.

        This abstract method is the one method that we require subclasses of
        BaseConnection to provide an implementation for. It is called when first
        creating a connection and when reconnecting after a connection is reset.

        Parameters
        ----------
        kwargs : dict

        Returns
        -------
        RawConnectionT
            The underlying connection object.
        """
        raise NotImplementedError
