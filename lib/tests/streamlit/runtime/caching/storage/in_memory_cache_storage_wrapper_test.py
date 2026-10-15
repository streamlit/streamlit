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

"""Unit tests for InMemoryCacheStorageWrapper"""

from __future__ import annotations

import threading
import unittest
from unittest.mock import Mock, patch

import pytest
from testfixtures import TempDirectory

from streamlit.runtime.caching.storage import (
    CacheStorageContext,
    CacheStorageKeyNotFoundError,
)
from streamlit.runtime.caching.storage.dummy_cache_storage import DummyCacheStorage
from streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper import (
    InMemoryCacheStorageWrapper,
)
from streamlit.runtime.caching.storage.local_disk_cache_storage import (
    LocalDiskCacheStorage,
)


class InMemoryCacheStorageWrapperTest(unittest.TestCase):
    """Unit tests for InMemoryCacheStorageWrapper"""

    def setUp(self) -> None:
        self.tempdir = TempDirectory(create=True)
        self.patch_get_cache_folder_path = patch(
            "streamlit.runtime.caching.storage.local_disk_cache_storage.get_cache_folder_path",
            return_value=self.tempdir.path,
        )
        self.patch_get_cache_folder_path.start()

    def tearDown(self):
        super().tearDown()
        self.patch_get_cache_folder_path.stop()
        self.tempdir.cleanup()

    def get_storage_context(self):
        return CacheStorageContext(
            function_key="func-key",
            function_display_name="func-display-name",
            persist="disk",
        )

    def test_in_memory_cache_storage_wrapper_works_with_local_disk_storage(self):
        """
        InMemoryCacheStorageWrapper should work with local disk storage without raising
        an exception
        """
        context = self.get_storage_context()

        InMemoryCacheStorageWrapper(
            persist_storage=LocalDiskCacheStorage(context),
            context=context,
        )

    def test_in_memory_cache_storage_wrapper_works_with_dummy_storage(self):
        """
        InMemoryCacheStorageWrapper should work with dummy storage without raising
        an exception
        """
        context = self.get_storage_context()

        InMemoryCacheStorageWrapper(
            persist_storage=DummyCacheStorage(),
            context=context,
        )

    def test_in_memory_cache_storage_wrapper_get_key_in_persist_storage(self):
        """
        Test that storage.get() returns the value from persist storage
        if value doesn't exist in memory.
        """

        context = self.get_storage_context()
        persist_storage = LocalDiskCacheStorage(context)
        wrapped_storage = InMemoryCacheStorageWrapper(
            persist_storage=persist_storage, context=context
        )

        persist_storage.set("some-key", b"some-value")
        with patch.object(
            persist_storage, "get", wraps=persist_storage.get
        ) as mock_persist_get:
            assert wrapped_storage.get("some-key") == b"some-value"
            mock_persist_get.assert_called_once_with("some-key")

            # Call get again to make that underlying storage is not called again
            assert wrapped_storage.get("some-key") == b"some-value"
            mock_persist_get.assert_called_once()

    def test_clear_invalidates_persistent_read_through(self) -> None:
        """A persistent read cannot promote stale bytes after clear returns."""
        context = self.get_storage_context()
        persist_storage = LocalDiskCacheStorage(context)
        wrapped_storage = InMemoryCacheStorageWrapper(
            persist_storage=persist_storage, context=context
        )
        wrapped_storage.set("some-key", b"some-value")
        wrapped_storage._remove_from_mem_cache("some-key")

        read_started = threading.Event()
        continue_read = threading.Event()
        clear_started = threading.Event()
        clear_finished = threading.Event()
        read_errors: list[CacheStorageKeyNotFoundError] = []
        original_get = persist_storage.get

        def delayed_get(key: str) -> bytes:
            value = original_get(key)
            read_started.set()
            assert continue_read.wait(timeout=5)
            return value

        def clear_storage() -> None:
            clear_started.set()
            wrapped_storage.clear()
            clear_finished.set()

        def read_storage() -> None:
            try:
                wrapped_storage.get("some-key")
            except CacheStorageKeyNotFoundError as ex:
                read_errors.append(ex)

        with patch.object(persist_storage, "get", side_effect=delayed_get):
            reader = threading.Thread(target=read_storage)
            reader.start()
            assert read_started.wait(timeout=5)

            clearer = threading.Thread(target=clear_storage)
            clearer.start()
            assert clear_started.wait(timeout=5)
            assert clear_finished.wait(timeout=5)

            continue_read.set()
            reader.join(timeout=5)
            clearer.join(timeout=5)

        assert not reader.is_alive()
        assert not clearer.is_alive()
        assert len(read_errors) == 1
        with pytest.raises(CacheStorageKeyNotFoundError):
            wrapped_storage.get("some-key")

    def test_unrelated_write_does_not_invalidate_persistent_read(self) -> None:
        """A write to another key does not cause a spurious read-through miss."""
        context = self.get_storage_context()
        persist_storage = LocalDiskCacheStorage(context)
        wrapped_storage = InMemoryCacheStorageWrapper(
            persist_storage=persist_storage, context=context
        )
        wrapped_storage.set("target", b"target-value")
        wrapped_storage._remove_from_mem_cache("target")

        read_started = threading.Event()
        continue_read = threading.Event()
        read_results: list[bytes] = []
        original_get = persist_storage.get

        def delayed_get(key: str) -> bytes:
            value = original_get(key)
            read_started.set()
            assert continue_read.wait(timeout=5)
            return value

        with patch.object(persist_storage, "get", side_effect=delayed_get):
            reader = threading.Thread(
                target=lambda: read_results.append(wrapped_storage.get("target"))
            )
            reader.start()
            assert read_started.wait(timeout=5)

            wrapped_storage.set("other", b"other-value")
            continue_read.set()
            reader.join(timeout=5)

        assert not reader.is_alive()
        assert read_results == [b"target-value"]
        assert wrapped_storage.get("target") == b"target-value"

    def test_in_memory_cache_storage_wrapper_get_key_in_memory_storage(self):
        """
        Test that storage.get() returns the value from in_memory storage
        if value exists in memory.
        """
        context = self.get_storage_context()
        persist_storage = LocalDiskCacheStorage(context)
        wrapped_storage = InMemoryCacheStorageWrapper(
            persist_storage=persist_storage, context=context
        )

        wrapped_storage.set("some-key", b"some-value")

        with patch.object(
            persist_storage, "get", wraps=persist_storage.get
        ) as mock_persist_get:
            assert wrapped_storage.get("some-key") == b"some-value"
            mock_persist_get.assert_not_called()

    def test_memory_read_uses_one_ttl_timer_value(self) -> None:
        """An entry cannot expire between separate membership and value lookups."""
        context = CacheStorageContext(
            function_key="func-key",
            function_display_name="func-display-name",
            ttl_seconds=0.5,
        )
        wrapped_storage = InMemoryCacheStorageWrapper(
            persist_storage=DummyCacheStorage(), context=context
        )
        wrapped_storage._mem_cache._timer = lambda: 0.0
        wrapped_storage.set("some-key", b"some-value")

        timer = Mock(side_effect=[0.0, 1.0])
        wrapped_storage._mem_cache._timer = timer

        assert wrapped_storage.get("some-key") == b"some-value"
        timer.assert_called_once_with()

    def test_has_key_in_memory_storage_does_not_check_persist_storage(self):
        context = self.get_storage_context()
        persist_storage = LocalDiskCacheStorage(context)
        wrapped_storage = InMemoryCacheStorageWrapper(
            persist_storage=persist_storage, context=context
        )
        wrapped_storage.set("some-key", b"some-value")

        with patch.object(
            persist_storage, "has", wraps=persist_storage.has
        ) as mock_persist_has:
            assert wrapped_storage.has("some-key") is True
            mock_persist_has.assert_not_called()

    def test_has_key_in_persist_storage_does_not_read_value(self):
        context = self.get_storage_context()
        persist_storage = LocalDiskCacheStorage(context)
        wrapped_storage = InMemoryCacheStorageWrapper(
            persist_storage=persist_storage, context=context
        )
        persist_storage.set("some-key", b"some-value")

        with (
            patch.object(
                persist_storage, "has", wraps=persist_storage.has
            ) as mock_persist_has,
            patch.object(
                persist_storage, "get", wraps=persist_storage.get
            ) as mock_persist_get,
        ):
            assert wrapped_storage.has("some-key") is True
            mock_persist_has.assert_called_once_with("some-key")
            mock_persist_get.assert_not_called()

    def test_in_memory_cache_storage_wrapper_set(self):
        """
        Test that storage.set() sets value both in in-memory cache and
        in persist storage
        """
        context = self.get_storage_context()
        persist_storage = LocalDiskCacheStorage(context)
        wrapped_storage = InMemoryCacheStorageWrapper(
            persist_storage=persist_storage, context=context
        )

        persist_storage.set("some-key", b"some-value")
        with patch.object(
            persist_storage, "set", wraps=persist_storage.set
        ) as mock_persist_set:
            wrapped_storage.set("some-key", b"some-value")
            mock_persist_set.assert_called_once_with("some-key", b"some-value")

        assert wrapped_storage.get("some-key") == b"some-value"

    def test_in_memory_cache_storage_wrapper_delete(self):
        """
        Test that storage.delete() deletes value both in in-memory cache
        and in persist storage
        """
        context = self.get_storage_context()
        persist_storage = LocalDiskCacheStorage(context)
        wrapped_storage = InMemoryCacheStorageWrapper(
            persist_storage=persist_storage, context=context
        )

        wrapped_storage.set("some-key", b"some-value")
        with patch.object(
            persist_storage, "delete", wraps=persist_storage.delete
        ) as mock_persist_delete:
            wrapped_storage.delete("some-key")
            mock_persist_delete.assert_called_once_with("some-key")

        with pytest.raises(CacheStorageKeyNotFoundError):
            wrapped_storage.get("some-key")

    def test_in_memory_cache_storage_wrapper_close(self):
        """
        Test that storage.close() closes the underlying persist storage
        """
        context = self.get_storage_context()
        persist_storage = LocalDiskCacheStorage(context)
        wrapped_storage = InMemoryCacheStorageWrapper(
            persist_storage=persist_storage, context=context
        )

        with patch.object(
            persist_storage, "close", wraps=persist_storage.close
        ) as mock_persist_close:
            wrapped_storage.close()
            mock_persist_close.assert_called_once()

    def test_max_size_and_max_entries_are_both_enforced(self) -> None:
        """Byte and entry-count limits are enforced together."""
        context = CacheStorageContext(
            function_key="func-key",
            function_display_name="func-display-name",
            max_entries=2,
            max_size_bytes=5,
        )
        wrapped_storage = InMemoryCacheStorageWrapper(
            persist_storage=DummyCacheStorage(), context=context
        )

        wrapped_storage.set("a", b"aaa")
        wrapped_storage.set("b", b"bb")
        wrapped_storage.set("c", b"c")

        with pytest.raises(CacheStorageKeyNotFoundError):
            wrapped_storage._read_from_mem_cache("a")
        assert wrapped_storage._read_from_mem_cache("b") == b"bb"
        assert wrapped_storage._read_from_mem_cache("c") == b"c"

    def test_oversized_entry_is_retained_and_warns_once(self) -> None:
        """A lone oversized entry is retained and warns only once."""
        context = CacheStorageContext(
            function_key="func-key",
            function_display_name="func-display-name",
            max_size_bytes=2,
        )
        wrapped_storage = InMemoryCacheStorageWrapper(
            persist_storage=DummyCacheStorage(), context=context
        )

        with patch(
            "streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper."
            "_LOGGER.warning"
        ) as warning:
            wrapped_storage.set("first", b"large")
            wrapped_storage.set("second", b"larger")

        assert wrapped_storage.get("second") == b"larger"
        warning.assert_called_once()

    def test_byte_eviction_preserves_persisted_entry(self) -> None:
        """Byte eviction leaves the persisted copy available for reload."""
        context = CacheStorageContext(
            function_key="func-key",
            function_display_name="func-display-name",
            persist="disk",
            max_size_bytes=3,
        )
        persist_storage = LocalDiskCacheStorage(context)
        wrapped_storage = InMemoryCacheStorageWrapper(
            persist_storage=persist_storage, context=context
        )
        wrapped_storage.set("a", b"aa")
        wrapped_storage.set("b", b"bb")

        with patch.object(
            persist_storage, "get", wraps=persist_storage.get
        ) as persist_get:
            assert wrapped_storage.get("a") == b"aa"
            persist_get.assert_called_once_with("a")

    def test_set_if_present_does_not_repopulate_evicted_entry(self) -> None:
        """Conditional writes cannot repopulate an entry after eviction."""
        context = CacheStorageContext(
            function_key="func-key",
            function_display_name="func-display-name",
            max_entries=1,
        )
        wrapped_storage = InMemoryCacheStorageWrapper(
            persist_storage=DummyCacheStorage(), context=context
        )
        wrapped_storage.set("old", b"old")
        wrapped_storage.set("new", b"new")

        assert wrapped_storage.set_if_present("old", b"refreshed") is False
        with pytest.raises(CacheStorageKeyNotFoundError):
            wrapped_storage.get("old")
