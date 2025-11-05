# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""Tests for deferred download functionality."""

import unittest
from unittest.mock import patch

import pytest

from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.media_file_storage import MediaFileStorageError
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage


class DeferredDownloadTest(unittest.TestCase):
    """Test deferred download functionality in MediaFileManager."""

    def setUp(self):
        """Set up test fixtures."""
        self.storage = MemoryMediaFileStorage("/media")
        self.manager = MediaFileManager(self.storage)

    @patch("streamlit.runtime.media_file_manager._get_session_id")
    def test_register_deferred(self, mock_get_session_id):
        """Test registering a deferred callable."""
        mock_get_session_id.return_value = "test_session"

        def test_callable():
            return b"test data"

        file_id = self.manager.register_deferred(
            element_id="test_element",
            callable_fn=test_callable,
            mimetype="text/plain",
            coordinates="1.2.3",
            file_name="test.txt",
        )

        # Verify file_id was generated
        assert file_id is not None
        assert isinstance(file_id, str)

        # Verify callable was stored
        assert file_id in self.manager._deferred_callables
        deferred = self.manager._deferred_callables[file_id]
        assert deferred["callable"] == test_callable
        assert deferred["mimetype"] == "text/plain"
        assert deferred["filename"] == "test.txt"
        assert deferred["session_id"] == "test_session"

    @patch("streamlit.runtime.media_file_manager._get_session_id")
    def test_execute_deferred_success(self, mock_get_session_id):
        """Test executing a deferred callable successfully."""
        mock_get_session_id.return_value = "test_session"

        test_data = b"generated data"

        def test_callable():
            return test_data

        # Register deferred callable
        file_id = self.manager.register_deferred(
            element_id="test_element",
            callable_fn=test_callable,
            mimetype="text/plain",
            coordinates="1.2.3",
            file_name="test.txt",
        )

        # Execute deferred callable
        url = self.manager.execute_deferred(file_id)

        # Verify URL was returned
        assert url is not None
        assert "/media/" in url

        # Verify callable was cleaned up
        assert file_id not in self.manager._deferred_callables

        # Verify file was stored
        # Extract file_id from URL
        actual_file_id = url.split("/media/")[1].split(".")[0]
        assert actual_file_id in self.manager._file_metadata

    @patch("streamlit.runtime.media_file_manager._get_session_id")
    def test_execute_deferred_callable_error(self, mock_get_session_id):
        """Test executing a deferred callable that raises an error."""
        mock_get_session_id.return_value = "test_session"

        def failing_callable():
            raise ValueError("Test error")

        # Register deferred callable
        file_id = self.manager.register_deferred(
            element_id="test_element",
            callable_fn=failing_callable,
            mimetype="text/plain",
            coordinates="1.2.3",
        )

        # Execute should raise MediaFileStorageError
        with pytest.raises(MediaFileStorageError) as exc_info:
            self.manager.execute_deferred(file_id)

        assert "Callable execution failed" in str(exc_info.value)
        assert "Test error" in str(exc_info.value)

    @patch("streamlit.runtime.media_file_manager._get_session_id")
    def test_execute_deferred_not_found(self, mock_get_session_id):
        """Test executing a deferred callable that doesn't exist."""
        mock_get_session_id.return_value = "test_session"

        # Try to execute non-existent file_id
        with pytest.raises(MediaFileStorageError) as exc_info:
            self.manager.execute_deferred("nonexistent_id")

        assert "Deferred file nonexistent_id not found" in str(exc_info.value)

    @patch("streamlit.runtime.media_file_manager._get_session_id")
    def test_clear_session_refs_removes_deferred(self, mock_get_session_id):
        """Test that clearing session refs removes deferred callables."""
        mock_get_session_id.return_value = "test_session"

        def test_callable():
            return b"test data"

        # Register deferred callable
        file_id = self.manager.register_deferred(
            element_id="test_element",
            callable_fn=test_callable,
            mimetype="text/plain",
            coordinates="1.2.3",
        )

        # Verify callable was stored
        assert file_id in self.manager._deferred_callables

        # Clear session refs
        self.manager.clear_session_refs("test_session")

        # Verify callable was removed
        assert file_id not in self.manager._deferred_callables


if __name__ == "__main__":
    unittest.main()
