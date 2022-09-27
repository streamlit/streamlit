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

from unittest import mock
import unittest

from streamlit.watcher import polling_path_watcher


class PollingPathWatcherTest(unittest.TestCase):
    """Test PollingPathWatcher."""

    def setUp(self):
        super(PollingPathWatcherTest, self).setUp()
        self.util_patch = mock.patch("streamlit.watcher.polling_path_watcher.util")
        self.util_mock = self.util_patch.start()

        # Patch PollingPathWatcher's thread pool executor. We want to do
        # all of our test polling on the test thread, so we accumulate
        # tasks here and run them manually via `_run_executor_tasks`.
        self._executor_tasks = []
        self.executor_patch = mock.patch(
            "streamlit.watcher.polling_path_watcher.PollingPathWatcher._executor",
        )
        executor_mock = self.executor_patch.start()
        executor_mock.submit = self._submit_executor_task

        # Patch PollingPathWatcher's `time.sleep` to no-op, so that the tasks
        # submitted to our mock executor don't block.
        self.sleep_patch = mock.patch(
            "streamlit.watcher.polling_path_watcher.time.sleep"
        )
        self.sleep_patch.start()

    def tearDown(self):
        super(PollingPathWatcherTest, self).tearDown()
        self.util_patch.stop()
        self.executor_patch.stop()
        self.sleep_patch.stop()

    def _submit_executor_task(self, task):
        """Submit a new task to our mock executor."""
        self._executor_tasks.append(task)

    def _run_executor_tasks(self):
        """Run all tasks that have been submitted to our mock executor."""
        tasks = self._executor_tasks
        self._executor_tasks = []
        for task in tasks:
            task()

    def test_file_watch_and_callback(self):
        """Test that when a file is modified, the callback is called."""
        callback = mock.Mock()

        self.util_mock.path_modification_time = lambda *args: 101.0
        self.util_mock.calc_md5_with_blocking_retries = lambda _, **kwargs: "1"

        watcher = polling_path_watcher.PollingPathWatcher(
            "/this/is/my/file.py", callback
        )

        self._run_executor_tasks()
        callback.assert_not_called()

        self.util_mock.path_modification_time = lambda *args: 102.0
        self.util_mock.calc_md5_with_blocking_retries = lambda _, **kwargs: "2"

        self._run_executor_tasks()
        callback.assert_called_once()

        watcher.close()

    def test_callback_not_called_if_same_mtime(self):
        """Test that we ignore files with same mtime."""
        callback = mock.Mock()

        self.util_mock.path_modification_time = lambda *args: 101.0
        self.util_mock.calc_md5_with_blocking_retries = lambda _, **kwargs: "1"

        watcher = polling_path_watcher.PollingPathWatcher(
            "/this/is/my/file.py", callback
        )

        self._run_executor_tasks()
        callback.assert_not_called()

        # Same mtime!
        self.util_mock.calc_md5_with_blocking_retries = lambda _, **kwargs: "2"

        # This is the test:
        self._run_executor_tasks()
        callback.assert_not_called()

        watcher.close()

    def test_callback_not_called_if_same_md5(self):
        """Test that we ignore files with same md5."""
        callback = mock.Mock()

        self.util_mock.path_modification_time = lambda *args: 101.0
        self.util_mock.calc_md5_with_blocking_retries = lambda _, **kwargs: "1"

        watcher = polling_path_watcher.PollingPathWatcher(
            "/this/is/my/file.py", callback
        )

        self._run_executor_tasks()
        callback.assert_not_called()

        self.util_mock.path_modification_time = lambda *args: 102.0
        # Same MD5

        # This is the test:
        self._run_executor_tasks()
        callback.assert_not_called()

        watcher.close()

    def test_kwargs_plumbed_to_calc_md5(self):
        """Test that we pass the glob_pattern and allow_nonexistent kwargs to
        calc_md5_with_blocking_retries.

        `PollingPathWatcher`s can be created with optional kwargs allowing
        the caller to specify what types of files to watch (when watching a
        directory) and whether to allow watchers on paths with no files/dirs.
        This test ensures that these optional parameters make it to our hash
        calculation helpers across different on_changed events.
        """
        callback = mock.Mock()

        self.util_mock.path_modification_time = lambda *args: 101.0
        self.util_mock.calc_md5_with_blocking_retries = mock.Mock(return_value="1")

        watcher = polling_path_watcher.PollingPathWatcher(
            "/this/is/my/dir",
            callback,
            glob_pattern="*.py",
            allow_nonexistent=True,
        )

        self._run_executor_tasks()
        callback.assert_not_called()
        _, kwargs = self.util_mock.calc_md5_with_blocking_retries.call_args
        assert kwargs == {"glob_pattern": "*.py", "allow_nonexistent": True}

        self.util_mock.path_modification_time = lambda *args: 102.0
        self.util_mock.calc_md5_with_blocking_retries = mock.Mock(return_value="2")

        self._run_executor_tasks()
        callback.assert_called_once()
        _, kwargs = self.util_mock.calc_md5_with_blocking_retries.call_args
        assert kwargs == {"glob_pattern": "*.py", "allow_nonexistent": True}

        watcher.close()

    def test_multiple_watchers_same_file(self):
        """Test that we can have multiple watchers of the same file."""
        filename = "/this/is/my/file.py"

        mod_count = [0.0]

        def modify_mock_file():
            self.util_mock.path_modification_time = lambda *args: mod_count[0]
            self.util_mock.calc_md5_with_blocking_retries = (
                lambda _, **kwargs: "%d" % mod_count[0]
            )

            mod_count[0] += 1.0

        modify_mock_file()

        callback1 = mock.Mock()
        callback2 = mock.Mock()

        watcher1 = polling_path_watcher.PollingPathWatcher(filename, callback1)
        watcher2 = polling_path_watcher.PollingPathWatcher(filename, callback2)

        self._run_executor_tasks()

        callback1.assert_not_called()
        callback2.assert_not_called()

        # "Modify" our file
        modify_mock_file()
        self._run_executor_tasks()

        self.assertEqual(callback1.call_count, 1)
        self.assertEqual(callback2.call_count, 1)

        # Close watcher1. Only watcher2's callback should be called after this.
        watcher1.close()

        # Modify our file again
        modify_mock_file()
        self._run_executor_tasks()

        self.assertEqual(callback1.call_count, 1)
        self.assertEqual(callback2.call_count, 2)

        watcher2.close()

        # Modify our file a final time
        modify_mock_file()

        # Both watchers are now closed, so their callback counts
        # should not have increased.
        self.assertEqual(callback1.call_count, 1)
        self.assertEqual(callback2.call_count, 2)
