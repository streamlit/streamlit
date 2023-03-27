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

import json
from abc import ABC, abstractmethod
from typing import Generic, Optional, TypeVar

from streamlit.runtime.secrets import AttrDict, secrets_singleton
from streamlit.util import calc_md5

T = TypeVar("T")


class BaseConnection(ABC, Generic[T]):
    """TODO(vdonato): docstrings for this class and all public methods."""

    def __init__(self, connection_name: str = "default", **kwargs) -> None:
        if connection_name == "default":
            connection_name = self.default_connection_name()

        self._connection_name = connection_name
        self._kwargs = kwargs

        self._raw_instance: Optional[T] = self.connect(**kwargs)
        secrets_dict = self.get_secrets().__nested_secrets__
        self._config_section_hash = calc_md5(json.dumps(secrets_dict))
        secrets_singleton.file_change_listener.connect(self._on_secrets_changed)

    def __del__(self) -> None:
        secrets_singleton.file_change_listener.disconnect(self._on_secrets_changed)

    def _repr_html_(self) -> str:
        # TODO(vdonato): Change this to whatever we actually want the default to be.
        return f"Hi, I am a {self.default_connection_name()} connection!"

    # Methods with default implementations that we don't expect subclasses to want or
    # need to overwrite.
    def _on_secrets_changed(self, _) -> None:
        secrets_dict = self.get_secrets().__nested_secrets__
        new_hash = calc_md5(json.dumps(secrets_dict))

        # Only reset the connection if the secrets file section specific to this
        # connection has changed.
        if new_hash != self._config_section_hash:
            self._config_section_hash = new_hash
            self.reset()

    def get_secrets(self) -> AttrDict:
        connections_section = None
        if secrets_singleton.load_if_toml_exists():
            connections_section = secrets_singleton.get("connections")

        if type(connections_section) is not AttrDict:
            return AttrDict({})

        return connections_section.get(self._connection_name, AttrDict({}))

    @classmethod
    def default_connection_name(cls) -> str:
        name = cls._default_connection_name

        if name is None:
            raise NotImplementedError(
                "Subclasses of BaseConnection must define a _default_connection_name attribute."
            )
        return name

    # TODO(vdonato): Finalize the name for this method. Should this be `invalidate`?
    def reset(self) -> None:
        self._raw_instance = None

    @property
    def _instance(self) -> T:
        if self._raw_instance is None:
            self._raw_instance = self.connect(**self._kwargs)

        return self._raw_instance

    # Abstract fields/methods that subclasses of BaseConnection must implement
    _default_connection_name: Optional[str] = None

    @abstractmethod
    def connect(self, **kwargs) -> T:
        raise NotImplementedError
