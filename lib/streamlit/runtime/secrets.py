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

import os
import threading
from collections.abc import Callable, ItemsView, Iterator, KeysView, Mapping, ValuesView
from copy import deepcopy
from typing import (
    Any,
    Final,
    NoReturn,
)

from blinker import Signal

import streamlit.watcher.path_watcher
from streamlit import config, runtime
from streamlit.errors import StreamlitMaxRetriesError, StreamlitSecretNotFoundError
from streamlit.logger import get_logger

_LOGGER: Final = get_logger(__name__)


class SecretErrorMessages:
    """SecretErrorMessages stores all error messages we use for secrets to allow customization
    for different environments.

    For example Streamlit Cloud can customize the message to be different than the open source.

    For internal use, may change in future releases without notice.
    """

    def __init__(self) -> None:
        self.missing_attr_message: Callable[[str], str] = lambda attr_name: (
            f'st.secrets has no attribute "{attr_name}". '
            "Did you forget to add it to secrets.toml, mount it to secret directory, or the app settings "
            "on Streamlit Cloud? More info: "
            "https://docs.streamlit.io/deploy/streamlit-community-cloud/deploy-your-app/secrets-management"
        )
        self.missing_key_message: Callable[[str], str] = lambda key: (
            f'st.secrets has no key "{key}". '
            "Did you forget to add it to secrets.toml, mount it to secret directory, or the app settings "
            "on Streamlit Cloud? More info: "
            "https://docs.streamlit.io/deploy/streamlit-community-cloud/deploy-your-app/secrets-management"
        )
        self.no_secrets_found: Callable[[list[str]], str] = lambda file_paths: (
            f"No secrets found. Valid paths for a secrets.toml file or secret directories are: {', '.join(file_paths)}"
        )
        self.error_parsing_file_at_path: Callable[[str, Exception], str] = (
            lambda path, ex: f"Error parsing secrets file at {path}: {ex}"
        )
        self.subfolder_path_is_not_a_folder: Callable[[str], str] = (
            lambda sub_folder_path: (
                f"{sub_folder_path} is not a folder. "
                "To use directory based secrets, mount every secret in a subfolder under the secret directory"
            )
        )
        self.invalid_secret_path: Callable[[str], str] = lambda path: (
            f"Invalid secrets path: {path}: path is not a .toml file or a directory"
        )

    def set_missing_attr_message(self, message: Callable[[str], str]) -> None:
        """Set the missing attribute error message."""
        self.missing_attr_message = message

    def set_missing_key_message(self, message: Callable[[str], str]) -> None:
        """Set the missing key error message."""
        self.missing_key_message = message

    def set_no_secrets_found_message(self, message: Callable[[list[str]], str]) -> None:
        """Set the no secrets found error message."""
        self.no_secrets_found = message

    def set_error_parsing_file_at_path_message(
        self, message: Callable[[str, Exception], str]
    ) -> None:
        """Set the error parsing file at path error message."""
        self.error_parsing_file_at_path = message

    def set_subfolder_path_is_not_a_folder_message(
        self, message: Callable[[str], str]
    ) -> None:
        """Set the subfolder path is not a folder error message."""
        self.subfolder_path_is_not_a_folder = message

    def set_invalid_secret_path_message(self, message: Callable[[str], str]) -> None:
        """Set the invalid secret path error message."""
        self.invalid_secret_path = message

    def get_missing_attr_message(self, attr_name: str) -> str:
        """Get the missing attribute error message."""
        return self.missing_attr_message(attr_name)

    def get_missing_key_message(self, key: str) -> str:
        """Get the missing key error message."""
        return self.missing_key_message(key)

    def get_no_secrets_found_message(self, file_paths: list[str]) -> str:
        """Get the no secrets found error message."""
        return self.no_secrets_found(file_paths)

    def get_error_parsing_file_at_path_message(self, path: str, ex: Exception) -> str:
        """Get the error parsing file at path error message."""
        return self.error_parsing_file_at_path(path, ex)

    def get_subfolder_path_is_not_a_folder_message(self, sub_folder_path: str) -> str:
        """Get the subfolder path is not a folder error message."""
        return self.subfolder_path_is_not_a_folder(sub_folder_path)

    def get_invalid_secret_path_message(self, path: str) -> str:
        """Get the invalid secret path error message."""
        return self.invalid_secret_path(path)


secret_error_messages_singleton: Final = SecretErrorMessages()


def _convert_to_dict(obj: Mapping[str, Any] | AttrDict) -> dict[str, Any]:
    """Convert Mapping or AttrDict objects to dictionaries."""
    if isinstance(obj, AttrDict):
        return obj.to_dict()
    return {k: v.to_dict() if isinstance(v, AttrDict) else v for k, v in obj.items()}


def _missing_attr_error_message(attr_name: str) -> str:
    return secret_error_messages_singleton.get_missing_attr_message(attr_name)


def _missing_key_error_message(key: str) -> str:
    return secret_error_messages_singleton.get_missing_key_message(key)


class AttrDict(Mapping[str, Any]):
    """We use AttrDict to wrap up dictionary values from secrets
    to provide dot access to nested secrets.
    """

    def __init__(self, value: Mapping[str, Any]) -> None:
        self.__dict__["__nested_secrets__"] = dict(value)

    @staticmethod
    def _maybe_wrap_in_attr_dict(value: Any) -> Any:
        if not isinstance(value, Mapping):
            return value
        return AttrDict(value)

    def __len__(self) -> int:
        return len(self.__nested_secrets__)

    def __iter__(self) -> Iterator[str]:
        return iter(self.__nested_secrets__)

    def __getitem__(self, key: str) -> Any:
        try:
            value = self.__nested_secrets__[key]
            return self._maybe_wrap_in_attr_dict(value)
        except KeyError:
            raise KeyError(_missing_key_error_message(key))

    def __getattr__(self, attr_name: str) -> Any:
        try:
            value = self.__nested_secrets__[attr_name]
            return self._maybe_wrap_in_attr_dict(value)
        except KeyError:
            raise AttributeError(_missing_attr_error_message(attr_name))

    def __repr__(self) -> str:
        return repr(self.__nested_secrets__)

    def __setitem__(self, key: str, value: Any) -> NoReturn:
        raise TypeError("Secrets does not support item assignment.")

    def __setattr__(self, key: str, value: Any) -> NoReturn:
        raise TypeError("Secrets does not support attribute assignment.")

    def to_dict(self) -> dict[str, Any]:
        return deepcopy(self.__nested_secrets__)


class Secrets(Mapping[str, Any]):
    """A dict-like class that stores secrets.
    Parses secrets.toml on-demand. Cannot be externally mutated.

    Safe to use from multiple threads.
    """

    def __init__(self) -> None:
        # Our secrets dict.
        self._secrets: Mapping[str, Any] | None = None
        self._lock = threading.RLock()
        self._file_watchers_installed = False

        self.file_change_listener = Signal(
            doc="Emitted when a `secrets.toml` file has been changed."
        )

    def load_if_toml_exists(self) -> bool:
        """Load secrets.toml files from disk if they exists. If none exist,
        no exception will be raised. (If a file exists but is malformed,
        an exception *will* be raised.).

        Returns True if a secrets.toml file was successfully parsed, False otherwise.

        Thread-safe.
        """
        try:
            self._parse()

            return True
        except StreamlitSecretNotFoundError:
            # No secrets.toml files exist. That's fine.
            return False

    def set_suppress_print_error_on_exception(
        self, suppress_print_error_on_exception: bool
    ) -> None:
        """Left in place for compatibility with integrations until integration
        code can be updated.
        """

    def _reset(self) -> None:
        """Clear the secrets dictionary and remove any secrets that were
        added to os.environ.

        Thread-safe.
        """
        with self._lock:
            if self._secrets is None:
                return

            for k, v in self._secrets.items():
                self._maybe_delete_environment_variable(k, v)
            self._secrets = None

    def _parse_toml_file(self, path: str) -> tuple[Mapping[str, Any], bool]:
        """Parse a TOML file and return the secrets as a dictionary."""
        secrets = {}
        found_secrets_file = False

        try:
            with open(path, encoding="utf-8") as f:
                secrets_file_str = f.read()

            found_secrets_file = True
        except FileNotFoundError:
            # the default config for secrets contains two paths. It's likely one of will not have secrets file.
            return {}, False

        import toml

        try:
            secrets.update(toml.loads(secrets_file_str))
        except (TypeError, toml.TomlDecodeError) as ex:
            msg = (
                secret_error_messages_singleton.get_error_parsing_file_at_path_message(
                    path, ex
                )
            )
            raise StreamlitSecretNotFoundError(msg) from ex

        return secrets, found_secrets_file

    def _parse_directory(self, path: str) -> tuple[Mapping[str, Any], bool]:
        """Parse a directory for secrets. Directory style can be used to support Kubernetes secrets that are
        mounted to folders.

        Example structure:
        - top_level_secret_folder
            - user_pass_secret (folder)
                - username (file), content: myuser
                - password (file), content: mypassword
            - my_plain_secret (folder)
                - regular_secret (file), content: mysecret

        See: https://kubernetes.io/docs/tasks/inject-data-application/distribute-credentials-secure/#create-a-pod-that-has-access-to-the-secret-data-through-a-volume
        And: https://docs.snowflake.com/en/developer-guide/snowpark-container-services/additional-considerations-services-jobs#passing-secrets-in-local-container-files
        """
        secrets: dict[str, Any] = {}
        found_secrets_file = False

        for dirname in os.listdir(path):
            sub_folder_path = os.path.join(path, dirname)
            if not os.path.isdir(sub_folder_path):
                error_msg = secret_error_messages_singleton.get_subfolder_path_is_not_a_folder_message(
                    sub_folder_path
                )
                raise StreamlitSecretNotFoundError(error_msg)
            sub_secrets = {}

            for filename in os.listdir(sub_folder_path):
                file_path = os.path.join(sub_folder_path, filename)

                # ignore folders
                if os.path.isdir(file_path):
                    continue

                with open(file_path, encoding="utf-8") as f:
                    sub_secrets[filename] = f.read().strip()
                    found_secrets_file = True

            if len(sub_secrets) == 1:
                # if there's just one file, collapse it so it's directly under `dirname`
                secrets[dirname] = sub_secrets[next(iter(sub_secrets.keys()))]
            else:
                secrets[dirname] = sub_secrets

        return secrets, found_secrets_file

    def _parse_file_path(self, path: str) -> tuple[Mapping[str, Any], bool]:
        if path.endswith(".toml"):
            return self._parse_toml_file(path)

        if os.path.isdir(path):
            return self._parse_directory(path)

        error_msg = secret_error_messages_singleton.get_invalid_secret_path_message(
            path
        )
        raise StreamlitSecretNotFoundError(error_msg)

    def _parse(self) -> Mapping[str, Any]:
        """Parse our secrets.toml files if they're not already parsed.
        This function is safe to call from multiple threads.

        Parameters
        ----------
        print_exceptions : bool
            If True, then exceptions will be printed with `st.error` before
            being re-raised.

        Raises
        ------
            StreamlitSecretNotFoundError
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

            secrets = {}

            file_paths = config.get_option("secrets.files")
            found_secrets_file = False
            for path in file_paths:
                path_secrets, found_secrets_file_in_path = self._parse_file_path(path)
                found_secrets_file = found_secrets_file or found_secrets_file_in_path
                secrets.update(path_secrets)

            if not found_secrets_file:
                error_msg = (
                    secret_error_messages_singleton.get_no_secrets_found_message(
                        file_paths
                    )
                )
                raise StreamlitSecretNotFoundError(error_msg)

            for k, v in secrets.items():
                self._maybe_set_environment_variable(k, v)

            self._secrets = secrets
            self._maybe_install_file_watchers()

            return self._secrets

    def to_dict(self) -> dict[str, Any]:
        """Converts the secrets store into a nested dictionary, where nested AttrDict objects are
        also converted into dictionaries.
        """
        secrets = self._parse()
        return _convert_to_dict(secrets)

    @staticmethod
    def _maybe_set_environment_variable(k: Any, v: Any) -> None:
        """Add the given key/value pair to os.environ if the value
        is a string, int, or float.
        """
        value_type = type(v)
        if value_type in {str, int, float}:
            os.environ[k] = str(v)

    @staticmethod
    def _maybe_delete_environment_variable(k: Any, v: Any) -> None:
        """Remove the given key/value pair from os.environ if the value
        is a string, int, or float.
        """
        value_type = type(v)
        if value_type in {str, int, float} and os.environ.get(k) == v:
            del os.environ[k]

    def _maybe_install_file_watchers(self) -> None:
        with self._lock:
            if self._file_watchers_installed:
                return

            file_paths = config.get_option("secrets.files")
            for path in file_paths:
                try:
                    if path.endswith(".toml"):
                        streamlit.watcher.path_watcher.watch_file(
                            path,
                            self._on_secrets_changed,
                            watcher_type="poll",
                        )
                    else:
                        streamlit.watcher.path_watcher.watch_dir(
                            path,
                            self._on_secrets_changed,
                            watcher_type="poll",
                        )
                except (StreamlitMaxRetriesError, FileNotFoundError):  # noqa: PERF203
                    # A user may only have one secrets.toml file defined, so we'd expect
                    # exceptions to be raised here when attempting to install a
                    # watcher on the nonexistent ones.
                    pass

            # We set file_watchers_installed to True even if the installation attempt
            # failed to avoid repeatedly trying to install it.
            self._file_watchers_installed = True

    def _on_secrets_changed(self, changed_file_path: str) -> None:
        with self._lock:
            _LOGGER.debug("Secret path %s changed, reloading", changed_file_path)
            self._reset()
            self._parse()

        # Emit a signal to notify receivers that the `secrets.toml` file
        # has been changed.
        self.file_change_listener.send()

    def __getattr__(self, key: str) -> Any:
        """Return the value with the given key. If no such key
        exists, raise an AttributeError.

        Thread-safe.
        """
        try:
            value = self._parse()[key]
            if not isinstance(value, Mapping):
                return value
            return AttrDict(value)
        # We add FileNotFoundError since __getattr__ is expected to only raise
        # AttributeError and mocking utilities expect that contract.
        except (KeyError, FileNotFoundError):
            raise AttributeError(_missing_attr_error_message(key))

    def __getitem__(self, key: str) -> Any:
        """Return the value with the given key. If no such key
        exists, raise a KeyError.

        Thread-safe.
        """
        try:
            value = self._parse()[key]
            if not isinstance(value, Mapping):
                return value
            return AttrDict(value)
        except KeyError:
            raise KeyError(_missing_key_error_message(key))

    def __setattr__(self, key: str, value: Any) -> None:
        # Allow internal attributes to be set
        if key in {
            "_secrets",
            "_lock",
            "_file_watchers_installed",
            "_suppress_print_error_on_exception",
            "file_change_listener",
            "load_if_toml_exists",
        }:
            super().__setattr__(key, value)
        else:
            raise TypeError("Secrets does not support attribute assignment.")

    def __repr__(self) -> str:
        # If the runtime is NOT initialized, it is a method call outside
        # the streamlit app, so we avoid reading the secrets file as it may not exist.
        # If the runtime is initialized, display the contents of the file and
        # the file must already exist.
        """A string representation of the contents of the dict. Thread-safe."""
        if not runtime.exists():
            return f"{self.__class__.__name__}"
        return repr(self._parse())

    def __len__(self) -> int:
        """The number of entries in the dict. Thread-safe."""
        return len(self._parse())

    def has_key(self, k: str) -> bool:
        """True if the given key is in the dict. Thread-safe."""
        return k in self._parse()

    def keys(self) -> KeysView[str]:
        """A view of the keys in the dict. Thread-safe."""
        return self._parse().keys()

    def values(self) -> ValuesView[Any]:
        """A view of the values in the dict. Thread-safe."""
        return self._parse().values()

    def items(self) -> ItemsView[str, Any]:
        """A view of the key-value items in the dict. Thread-safe."""
        return self._parse().items()

    def __contains__(self, key: Any) -> bool:
        """True if the given key is in the dict. Thread-safe."""
        return key in self._parse()

    def __iter__(self) -> Iterator[str]:
        """An iterator over the keys in the dict. Thread-safe."""
        return iter(self._parse())


secrets_singleton: Final = Secrets()
