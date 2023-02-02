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

from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass

from typing_extensions import ClassVar, Literal, Protocol


@dataclass(frozen=True)
class CacheStorageContext:
    """Context passed to the cache storage"""

    function_key: str
    ttl_seconds: float | None = None
    max_entries: int | None = None
    persist: Literal["disk"] | None = None  # TODO: [Karen] import type from memo


class CacheStorage(Protocol):
    WORK_WITH_PERSIST_KEYWORD: ClassVar[bool]

    @abstractmethod
    def get(self, key: str) -> bytes:
        """Returns the stored value for the key or None if the key is not present"""
        raise NotImplementedError

    @abstractmethod
    def set(self, key: str, value: bytes) -> None:
        """Sets the value for a given key with a ttl expressed in milliseconds"""
        raise NotImplementedError

    @abstractmethod
    def delete(self, key: str) -> None:
        """Expires a given key"""
        raise NotImplementedError

    @abstractmethod
    def clear_all(self) -> None:
        """Expires all keys for the app"""
        raise NotImplementedError

    # TODO[Karen]: Think about should we have a close method for storage?
    #  to potentially close the connection to the storage in case of a remote storage
    @abstractmethod
    def close(self) -> None:
        """Closes the cache storage"""
        raise NotImplementedError

    def get_stats(self) -> list[int]:
        """Returns a list of stats in bytes for the cache storage per item"""


class CacheStorageFactory(Protocol):
    @abstractmethod
    def create(self, context: CacheStorageContext) -> CacheStorage:
        """Creates a new cache storage instance"""
        raise NotImplementedError
