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

"""Unit tests for DummyCacheStorage and MemoryCacheStorageManager"""
import unittest

from streamlit.runtime.caching.storage import (
    CacheStorageContext,
    CacheStorageKeyNotFoundError,
)
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    DummyCacheStorage,
    MemoryCacheStorageManager,
)


class DummyCacheStorageManagerTest(unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.context = CacheStorageContext(
            function_key="func-key",
            function_display_name="func-display-name",
            persist="disk",
        )
        self.dummy_cache_storage = DummyCacheStorage()
        self.storage_manager = MemoryCacheStorageManager()
        self.storage = self.storage_manager.create(self.context)

    def test_in_memory_wrapped_dummy_cache_storage_get_not_found(self):
        """
        Test that storage.get() returns CacheStorageKeyNotFoundError when key is not
        present.
        """
        with self.assertRaises(CacheStorageKeyNotFoundError):
            self.storage.get("some-key")

    def test_in_memory_wrapped_dummy_cache_storage_get_found(self):
        """
        Test that storage.get() returns the value when key is present.
        """
        self.storage.set("some-key", b"some-value")
        self.assertEqual(self.storage.get("some-key"), b"some-value")

    def test_in_memory_wrapped_dummy_cache_storage_storage_set(self):
        """
        Test that storage.set() sets the value correctly.
        """
        self.storage.set("new-key", b"new-value")
        self.assertEqual(self.storage.get("new-key"), b"new-value")

    def test_in_memory_wrapped_dummy_cache_storage_storage_set_override(self):
        """
        Test that storage.set() overrides the value.
        """
        self.storage.set("another_key", b"another_value")
        self.storage.set("another_key", b"new_value")
        self.assertEqual(self.storage.get("another_key"), b"new_value")

    def test_in_memory_wrapped_dummy_cache_storage_storage_delete(self):
        """
        Test that storage.delete() deletes the value correctly.
        """
        self.storage.set("new-key", b"new-value")
        self.storage.delete("new-key")
        with self.assertRaises(CacheStorageKeyNotFoundError):
            self.storage.get("new-key")


class DummyCacheStorageTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.storage = DummyCacheStorage()

    def test_dummy_storage_get_always_not_found(self):
        """Test that storage.get() always returns CacheStorageKeyNotFoundError."""

        with self.assertRaises(CacheStorageKeyNotFoundError):
            self.storage.get("some-key")

        self.storage.set("some-key", b"some-value")

        with self.assertRaises(CacheStorageKeyNotFoundError):
            self.storage.get("some-key")

    def test_storage_set(self):
        """
        Test that storage.set() works correctly, at always do nothing without
        raising exception."""
        self.storage.set("new-key", b"new-value")
        with self.assertRaises(CacheStorageKeyNotFoundError):
            self.storage.get("new-key")

    def test_storage_delete(self):
        """
        Test that storage.delete() works correctly, at always do nothing without
        raising exception.
        """
        self.storage.delete("another-key")
        self.storage.delete("another-key")
        self.storage.delete("another-key")

    def test_storage_clear(self):
        """
        Test that storage.clear() works correctly, at always do nothing without
        raising exception.
        """
        self.storage.clear()

    def test_storage_close(self):
        """
        Test that storage.close() works correctly, at always do nothing without
        raising exception.
        """
        self.storage.close()
