# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
from typing import Dict, Generic, Optional, TypeVar

from streamlit.runtime.secrets import AttrDict, secrets_singleton

# TODO(vdonato): docstrings for everything in this file

T = TypeVar("T")

# NOTE: We'll want to consider making __init__, __enter__, and __exit__ abstract if it
# starts seeming like many of the connections that we write need to overwrite them
# anyway.
class BaseConnection(ABC, Generic[T]):
    def __init__(self, connection_name: str = "default", **kwargs) -> None:
        self._connection_name = connection_name
        self._kwargs = kwargs

        self._instance: T = self.connect(**kwargs)

    # TODO(vdonato): Throw user-friendly error messages if the specified connections.*
    # section can't be found.
    def get_secrets(self) -> Dict[str, str]:
        connection_name = self._connection_name
        if connection_name == "default":
            connection_name = self.default_connection_name()

        connections_section = secrets_singleton.get("connections")
        if type(connections_section) is not AttrDict:
            return {}

        return connections_section.get(connection_name, {})

    # TODO(vdonato): Change this to whatever we actually want the default to be.
    def _repr_html_(self) -> str:
        return f"""
Hi, I am a {self.default_connection_name()} connection!
Currently connected: {self.is_connected()}.
"""

    # NOTE: After writing a rough implementation of the SQL connector, I'm skeptical
    # that we'll want a default implementation for these methods since they'll have to
    # be overwritten so frequently. We may not even want these methods to begin with as
    # each connector will probably have its own patterns for being used in `with`
    # blocks.
    def __enter__(self):
        return self.instance

    def __exit__(self, exec_type, exec_instance, traceback):
        # For many connections, `with` syntax will simply be equivalent to binding
        # self.instance to a variable, so we don't have to do anything here.
        ...

    @classmethod
    def default_connection_name(cls) -> str:
        name = cls._default_connection_name

        if name is None:
            raise NotImplementedError(
                "Subclasses of BaseConnection must define a _default_connection_name attribute."
            )
        return name

    @property
    def instance(self) -> T:
        if not self.is_connected():
            self._instance = self.connect(**self._kwargs)

        return self._instance

    ####### Abstract methods that all subclasses of BaseConnection must implement ######

    _default_connection_name: Optional[str] = None

    @abstractmethod
    def connect(self, **kwargs) -> T:
        raise NotImplementedError

    @abstractmethod
    def disconnect(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def is_connected(self) -> bool:
        raise NotImplementedError
