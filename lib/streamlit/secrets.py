# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
import threading
from typing import Any, Optional, Mapping

import toml

import streamlit as st

_SECRETS_LOCATION = os.path.abspath(os.path.join(".", ".streamlit", "secrets.toml"))


def _maybe_set_environment_variable(k: Any, v: Any) -> None:
    value_type = type(v)
    if value_type in (str, int, float):
        os.environ[k] = str(v)


class Secrets(Mapping[str, Any]):
    """A dict-like class that stores secrets.
    Parses secrets.toml on-demand. Cannot be externally mutated.
    """

    def __init__(self):
        # Our secrets dict. It will be loaded on demand.
        self._secrets: Optional[Mapping[str, Any]] = None
        self._lock = threading.RLock()

    def _reset(self) -> None:
        """Reset the dictionary. It will be re-parsed the next time it's
        accessed."""
        with self._lock:
            self._secrets = None

    def _parse(self) -> Mapping[str, Any]:
        """Parse our secrets.toml file, if it's not already parsed.
        Throw an error if the file doesn't exist, or can't be loaded.
        This function is safe to call from multiple threads.
        """
        with self._lock:
            if self._secrets is not None:
                return self._secrets

            try:
                with open(_SECRETS_LOCATION) as f:
                    secrets_file_str = f.read()
            except OSError:
                st.error(f"Secrets file not found. Expected at: {_SECRETS_LOCATION}")
                raise

            try:
                secrets = toml.loads(secrets_file_str)
            except:
                st.error("Error parsing Secrets file.")
                raise

            for k, v in secrets.items():
                _maybe_set_environment_variable(k, v)

            self._secrets = secrets
            return self._secrets

    def __getitem__(self, key):
        return self._parse()[key]

    def __repr__(self):
        return repr(self._parse())

    def __len__(self):
        return len(self._parse())

    def has_key(self, k):
        return k in self._parse()

    def keys(self):
        return self._parse().keys()

    def values(self):
        return self._parse().values()

    def items(self):
        return self._parse().items()

    def __contains__(self, item):
        return item in self._parse()

    def __iter__(self):
        return iter(self._parse())
