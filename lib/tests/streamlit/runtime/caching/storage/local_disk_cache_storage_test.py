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
import os.path
import unittest
from unittest.mock import MagicMock, patch

from testfixtures import TempDirectory

from streamlit import util
from streamlit.runtime.caching.storage import (
    CacheStorageContext,
    CacheStorageError,
    CacheStorageKeyNotFoundError,
)
from streamlit.runtime.caching.storage.local_disk_cache_storage import (
    LocalDiskCacheStorage,
)


class LocalDiskPersistCacheStorageTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.context = CacheStorageContext(
            function_key="func-key",
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
        self.storage.set("new-key", b"new-value")
        self.assertTrue(os.path.exists(self.tempdir.path + "/func-key-new-key.memo"))

        with open(self.tempdir.path + "/func-key-new-key.memo", "rb") as f:
            self.assertEqual(f.read(), b"new-value")

    @patch(
        "streamlit.runtime.caching.storage.local_disk_cache_storage.streamlit_write",
        MagicMock(side_effect=util.Error("mock exception")),
    )
    def test_storage_set_error(self):
        with self.assertRaises(CacheStorageError) as e:
            self.storage.set("uniqueKey", b"new-value")
        self.assertEqual(str(e.exception), "Unable to write to cache")

    def test_storage_set_override(self):
        self.storage.set("another_key", b"another_value")
        self.storage.set("another_key", b"new_value")
        self.assertEqual(self.storage.get("another_key"), b"new_value")

    def test_storage_delete(self):
        self.storage.set("new-key", b"new-value")
        self.assertTrue(os.path.exists(self.tempdir.path + "/func-key-new-key.memo"))
        self.storage.delete("new-key")
        self.assertFalse(os.path.exists(self.tempdir.path + "/func-key-new-key.memo"))

        with self.assertRaises(CacheStorageKeyNotFoundError):
            self.storage.get("new-key")

    def test_storage_clear(self):
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

    def test_storage_close(self):
        # Test that close does not raise any exception
        self.storage.close()
