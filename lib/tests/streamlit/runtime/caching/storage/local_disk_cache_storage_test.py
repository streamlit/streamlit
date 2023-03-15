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

"""Unit tests for LocalDiskCacheStorage and LocalDiskCacheStorageManager"""
import logging
import math
import os.path
import shutil
import unittest
from unittest.mock import MagicMock, patch

from testfixtures import TempDirectory

from streamlit import util
from streamlit.logger import get_logger
from streamlit.runtime.caching.storage import (
    CacheStorageContext,
    CacheStorageError,
    CacheStorageKeyNotFoundError,
)
from streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper import (
    InMemoryCacheStorageWrapper,
)
from streamlit.runtime.caching.storage.local_disk_cache_storage import (
    LocalDiskCacheStorage,
    LocalDiskCacheStorageManager,
)


class LocalDiskCacheStorageManagerTest(unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.tempdir = TempDirectory(create=True)
        self.patch_get_cache_folder_path = patch(
            "streamlit.runtime.caching.storage.local_disk_cache_storage.get_cache_folder_path",
            return_value=self.tempdir.path,
        )
        self.patch_get_cache_folder_path.start()

    def tearDown(self) -> None:
        super().tearDown()
        self.patch_get_cache_folder_path.stop()
        self.tempdir.cleanup()

    def test_create_persist_context(self):
        """Tests that LocalDiskCacheStorageManager.create()
        returns a LocalDiskCacheStorage with correct parameters from context, if
        persist="disk"
        """
        context = CacheStorageContext(
            function_key="func-key",
            function_display_name="func-display-name",
            persist="disk",
            ttl_seconds=60,
            max_entries=100,
        )
        manager = LocalDiskCacheStorageManager()
        storage = manager.create(context)
        self.assertIsInstance(storage, InMemoryCacheStorageWrapper)
        self.assertEqual(storage.ttl_seconds, 60)
        self.assertEqual(storage.max_entries, 100)

    def test_create_not_persist_context(self):
        """Tests that LocalDiskCacheStorageManager.create()
        returns a LocalDiskCacheStorage with correct parameters from context, if
        persist is None
        """
        context = CacheStorageContext(
            function_key="func-key",
            function_display_name="func-display-name",
            persist=None,
            ttl_seconds=None,
            max_entries=None,
        )
        manager = LocalDiskCacheStorageManager()
        storage = manager.create(context)
        self.assertIsInstance(storage, InMemoryCacheStorageWrapper)
        self.assertEqual(storage.ttl_seconds, math.inf)
        self.assertEqual(storage.max_entries, math.inf)

    def test_check_context_with_persist_and_ttl(self):
        """Tests that LocalDiskCacheStorageManager.check_context() writes a warning
        in logs when persist="disk" and ttl_seconds is not None
        """
        context = CacheStorageContext(
            function_key="func-key",
            function_display_name="func-display-name",
            persist="disk",
            ttl_seconds=60,
            max_entries=100,
        )

        with self.assertLogs(
            "streamlit.runtime.caching.storage.local_disk_cache_storage",
            level=logging.WARNING,
        ) as logs:
            manager = LocalDiskCacheStorageManager()
            manager.check_context(context)

            output = "".join(logs.output)
            self.assertIn(
                "The cached function 'func-display-name' has a TTL that will be "
                "ignored. Persistent cached functions currently don't support TTL.",
                output,
            )

    def test_check_context_without_persist(self):
        """Tests that LocalDiskCacheStorageManager.check_context() does not
        write a warning in logs when persist is None and ttl_seconds is NOT None.
        """
        context = CacheStorageContext(
            function_key="func-key",
            function_display_name="func-display-name",
            persist=None,
            ttl_seconds=60,
            max_entries=100,
        )

        with self.assertLogs(
            "streamlit.runtime.caching.storage.local_disk_cache_storage",
            level=logging.WARNING,
        ) as logs:
            manager = LocalDiskCacheStorageManager()
            manager.check_context(context)

            # assertLogs is being used as a context manager, but it also checks
            # that some log output was captured, so we have to let it capture something
            get_logger(
                "streamlit.runtime.caching.storage.local_disk_cache_storage"
            ).warning("irrelevant warning so assertLogs passes")

            output = "".join(logs.output)
            self.assertNotIn(
                "The cached function 'func-display-name' has a TTL that will be "
                "ignored. Persistent cached functions currently don't support TTL.",
                output,
            )

    @patch("shutil.rmtree", wraps=shutil.rmtree)
    def test_clear_all(self, mock_rmtree):
        """Tests that LocalDiskCacheStorageManager.clear_all() calls shutil.rmtree
        to remove the cache folder
        """
        manager = LocalDiskCacheStorageManager()
        manager.clear_all()
        mock_rmtree.assert_called_once()


class LocalDiskPersistCacheStorageTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.context = CacheStorageContext(
            function_key="func-key",
            function_display_name="func-display-name",
            persist="disk",
        )
        self.storage = LocalDiskCacheStorage(self.context)
        self.tempdir = TempDirectory(create=True)
        self.patch_get_cache_folder_path = patch(
            "streamlit.runtime.caching.storage.local_disk_cache_storage.get_cache_folder_path",
            return_value=self.tempdir.path,
        )
        self.patch_get_cache_folder_path.start()

    def tearDown(self):
        super().tearDown()
        self.storage.clear()
        self.patch_get_cache_folder_path.stop()
        self.tempdir.cleanup()

    def test_storage_get_not_found(self):
        """Test that storage.get() returns the correct value."""

        with self.assertRaises(CacheStorageKeyNotFoundError):
            self.storage.get("some-key")

    def test_storage_get_found(self):
        """Test that storage.get() returns the correct value."""
        self.storage.set("some-key", b"some-value")
        self.assertEqual(self.storage.get("some-key"), b"some-value")

    def test_storage_set(self):
        """Test that storage.set() writes the correct value to disk."""
        self.storage.set("new-key", b"new-value")
        self.assertTrue(os.path.exists(self.tempdir.path + "/func-key-new-key.memo"))

        with open(self.tempdir.path + "/func-key-new-key.memo", "rb") as f:
            self.assertEqual(f.read(), b"new-value")

    @patch(
        "streamlit.runtime.caching.storage.local_disk_cache_storage.streamlit_write",
        MagicMock(side_effect=util.Error("mock exception")),
    )
    def test_storage_set_error(self):
        """Test that storage.set() raises an exception when it fails to write to disk."""
        with self.assertRaises(CacheStorageError) as e:
            self.storage.set("uniqueKey", b"new-value")
        self.assertEqual(str(e.exception), "Unable to write to cache")

    def test_storage_set_override(self):
        """Test that storage.set() overrides the value of an existing key."""
        self.storage.set("another_key", b"another_value")
        self.storage.set("another_key", b"new_value")
        self.assertEqual(self.storage.get("another_key"), b"new_value")

    def test_storage_delete(self):
        """Test that storage.delete() removes the correct file from disk."""
        self.storage.set("new-key", b"new-value")
        self.assertTrue(os.path.exists(self.tempdir.path + "/func-key-new-key.memo"))
        self.storage.delete("new-key")
        self.assertFalse(os.path.exists(self.tempdir.path + "/func-key-new-key.memo"))

        with self.assertRaises(CacheStorageKeyNotFoundError):
            self.storage.get("new-key")

    def test_storage_clear(self):
        """Test that storage.clear() removes all storage files from disk."""
        self.storage.set("some-key", b"some-value")
        self.storage.set("another-key", b"another-value")
        self.assertTrue(os.path.exists(self.tempdir.path + "/func-key-some-key.memo"))
        self.assertTrue(
            os.path.exists(self.tempdir.path + "/func-key-another-key.memo")
        )

        self.storage.clear()

        self.assertFalse(os.path.exists(self.tempdir.path + "/func-key-some-key.memo"))
        self.assertFalse(
            os.path.exists(self.tempdir.path + "/func-key-another-key.memo")
        )

        with self.assertRaises(CacheStorageKeyNotFoundError):
            self.storage.get("some-key")

        with self.assertRaises(CacheStorageKeyNotFoundError):
            self.storage.get("another-key")

        # test that cache folder is empty
        self.assertEqual(os.listdir(self.tempdir.path), [])

    def test_storage_clear_missing_directory(self):
        """Test that storage.clear() not crush if cache directory does not exist."""
        self.tempdir.cleanup()
        self.storage.clear()

    def test_storage_close(self):
        """Test that storage.close() does not raise any exception."""
        self.storage.close()
