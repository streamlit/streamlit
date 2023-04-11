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

RawConnectionT = TypeVar("RawConnectionT")


class ExperimentalBaseConnection(ABC, Generic[RawConnectionT]):
    """TODO(vdonato): docstrings for this class and all public methods."""

    def __init__(self, connection_name: str, **kwargs) -> None:
        self._connection_name = connection_name
        self._kwargs = kwargs

        secrets_dict = self._secrets.to_dict()
        self._config_section_hash = calc_md5(json.dumps(secrets_dict))
        secrets_singleton.file_change_listener.connect(self._on_secrets_changed)

        self._raw_instance: Optional[RawConnectionT] = self._connect(**kwargs)

    def __del__(self) -> None:
        secrets_singleton.file_change_listener.disconnect(self._on_secrets_changed)

    def _repr_html_(self) -> str:
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
        secrets_dict = self._secrets.to_dict()
        new_hash = calc_md5(json.dumps(secrets_dict))

        # Only reset the connection if the secrets file section specific to this
        # connection has changed.
        if new_hash != self._config_section_hash:
            self._config_section_hash = new_hash
            self.reset()

    @property
    def _secrets(self) -> AttrDict:
        connections_section = None
        if secrets_singleton.load_if_toml_exists():
            connections_section = secrets_singleton.get("connections")

        if type(connections_section) is not AttrDict:
            return AttrDict({})

        return connections_section.get(self._connection_name, AttrDict({}))

    def reset(self) -> None:
        self._raw_instance = None

    @property
    def _instance(self) -> RawConnectionT:
        if self._raw_instance is None:
            self._raw_instance = self._connect(**self._kwargs)

        return self._raw_instance

    # Abstract fields/methods that subclasses of ExperimentalBaseConnection must implement
    @abstractmethod
    def _connect(self, **kwargs) -> RawConnectionT:
        raise NotImplementedError
