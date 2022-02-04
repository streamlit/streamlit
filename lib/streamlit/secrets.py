# Copyright 2018-2022 Streamlit Inc.
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
from typing import Any, Mapping, Optional

import toml
from blinker import Signal

import streamlit as st
import streamlit.watcher.file_watcher
from streamlit.logger import get_logger

LOGGER = get_logger(__name__)
SECRETS_FILE_LOC = os.path.abspath(os.path.join(".", ".streamlit", "secrets.toml"))


def _missing_attr_error_message(attr_name: str) -> str:
    return (
        f'st.secrets has no attribute "{attr_name}". '
        f"Did you forget to add it to secrets.toml or the app settings on Streamlit Cloud? "
        f"More info: https://docs.streamlit.io/streamlit-cloud/get-started/deploy-an-app/connect-to-data-sources/secrets-management"
    )


def _missing_key_error_message(key: str) -> str:
    return (
        f'st.secrets has no key "{key}". '
        f"Did you forget to add it to secrets.toml or the app settings on Streamlit Cloud? "
        f"More info: https://docs.streamlit.io/streamlit-cloud/get-started/deploy-an-app/connect-to-data-sources/secrets-management"
    )


class AttrDict(dict):  # type: ignore[type-arg]
    """
    We use AttrDict to wrap up dictionary values from secrets
    to provide dot access to nested secrets
    """

    def __init__(self, *args, **kwargs) -> None:
        super(AttrDict, self).__init__(*args, **kwargs)
        self.__dict__ = self

    @staticmethod
    def _maybe_wrap_in_attr_dict(value) -> Any:
        if not isinstance(value, dict):
            return value
        else:
            return AttrDict(**value)

    def __getattr__(self, attr_name: str) -> Any:
        try:
            value = super(AttrDict, self).__getitem__(attr_name)
            return self._maybe_wrap_in_attr_dict(value)
        except KeyError:
            raise AttributeError(_missing_attr_error_message(attr_name))

    def __getitem__(self, key: str) -> Any:
        try:
            value = super(AttrDict, self).__getitem__(key)
            return self._maybe_wrap_in_attr_dict(value)
        except KeyError:
            raise KeyError(_missing_key_error_message(key))


class Secrets(Mapping[str, Any]):
    """A dict-like class that stores secrets.
    Parses secrets.toml on-demand. Cannot be externally mutated.
    """

    def __init__(self, file_path: str):
        # Our secrets dict.
        self._secrets: Optional[Mapping[str, Any]] = None
        self._lock = threading.RLock()
        self._file_watcher_installed = False
        self._file_path = file_path
        self._file_change_listener = Signal(
            doc="Emitted when the `secrets.toml` file has been changed."
        )

    def load_if_toml_exists(self) -> None:
        """Load secrets.toml from disk if it exists. If it doesn't exist,
        no exception will be raised. (If the file exists but is malformed,
        an exception *will* be raised.)
        """
        try:
            self._parse(print_exceptions=False)
        except FileNotFoundError:
            pass

    def _reset(self) -> None:
        """Clear the secrets dictionary and remove any secrets that were
        added to os.environ."""
        with self._lock:
            if self._secrets is None:
                return

            for k, v in self._secrets.items():
                self._maybe_delete_environment_variable(k, v)
            self._secrets = None

    def _parse(self, print_exceptions: bool) -> Mapping[str, Any]:
        """Parse our secrets.toml file if it's not already parsed.
        This function is safe to call from multiple threads.

        Parameters
        ----------
        print_exceptions : bool
            If True, then exceptions will be printed with `st.error` before
            being re-raised.

        Raises
        ------
        FileNotFoundError
            Raised if secrets.toml doesn't exist.

        """
        # Avoid taking a lock for the common case where secrets are already
        # loaded.
        secrets = self._secrets
        if secrets is not None:
            return secrets

        with self._lock:
            if self._secrets is not None:
                return self._secrets

            try:
                with open(self._file_path, encoding="utf-8") as f:
                    secrets_file_str = f.read()
            except FileNotFoundError:
                if print_exceptions:
                    st.error(f"Secrets file not found. Expected at: {self._file_path}")
                raise

            try:
                secrets = toml.loads(secrets_file_str)
            except:
                if print_exceptions:
                    st.error("Error parsing Secrets file.")
                raise

            for k, v in secrets.items():
                self._maybe_set_environment_variable(k, v)

            self._secrets = secrets
            self._maybe_install_file_watcher()

            return self._secrets

    @staticmethod
    def _maybe_set_environment_variable(k: Any, v: Any) -> None:
        """Add the given key/value pair to os.environ if the value
        is a string, int, or float."""
        value_type = type(v)
        if value_type in (str, int, float):
            os.environ[k] = str(v)

    @staticmethod
    def _maybe_delete_environment_variable(k: Any, v: Any) -> None:
        """Remove the given key/value pair from os.environ if the value
        is a string, int, or float."""
        value_type = type(v)
        if value_type in (str, int, float) and os.environ.get(k) == v:
            del os.environ[k]

    def _maybe_install_file_watcher(self) -> None:
        with self._lock:
            if self._file_watcher_installed:
                return

            # We force our watcher_type to 'poll' because Streamlit Cloud
            # stores `secrets.toml` in a virtual filesystem that is
            # incompatible with watchdog.
            streamlit.watcher.file_watcher.watch_file(
                self._file_path,
                self._on_secrets_file_changed,
                watcher_type="poll",
            )

            # We set file_watcher_installed to True even if watch_file
            # returns False to avoid repeatedly trying to install it.
            self._file_watcher_installed = True

    def _on_secrets_file_changed(self, _) -> None:
        with self._lock:
            LOGGER.debug(f"Secrets file {self._file_path} changed, reloading")
            self._reset()
            self._parse(print_exceptions=True)

        # Emit a signal to notify receivers that the `secrets.toml` file
        # has been changed.
        self._file_change_listener.send()

    def __getattr__(self, key: str) -> Any:
        try:
            value = self._parse(True)[key]
            if not isinstance(value, dict):
                return value
            else:
                return AttrDict(**value)
        # We add FileNotFoundError since __getattr__ is expected to only raise
        # AttributeError. Without handling FileNotFoundError, unittests.mocks
        # fails during mock creation on Python3.9
        except (KeyError, FileNotFoundError):
            raise AttributeError(_missing_attr_error_message(key))

    def __getitem__(self, key: str) -> Any:
        try:
            value = self._parse(True)[key]
            if not isinstance(value, dict):
                return value
            else:
                return AttrDict(**value)
        except KeyError:
            raise KeyError(_missing_key_error_message(key))

    def __repr__(self):
        return repr(self._parse(True))

    def __len__(self) -> int:
        return len(self._parse(True))

    def has_key(self, k):
        return k in self._parse(True)

    def keys(self):
        return self._parse(True).keys()

    def values(self):
        return self._parse(True).values()

    def items(self):
        return self._parse(True).items()

    def __contains__(self, item):
        return item in self._parse(True)

    def __iter__(self):
        return iter(self._parse(True))
