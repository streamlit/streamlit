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

import unittest
from unittest.mock import patch, mock_open, MagicMock

from streamlit import metrics_util

MAC = "mac"
UUID = "uuid"
FILENAME = "/some/id/file"
mock_get_path = MagicMock(return_value=FILENAME)


class MetricsUtilTest(unittest.TestCase):
    def setUp(self):
        self.patch1 = patch("streamlit.file_util.os.stat")
        self.os_stat = self.patch1.start()

    def tearDown(self):
        self.patch1.stop()

    def test_machine_id_from_etc(self):
        """Test getting the machine id from /etc"""
        file_data = "etc"

        with patch("streamlit.metrics_util.platform.system", return_value=False), patch(
            "streamlit.metrics_util.uuid.getnode", return_value=MAC
        ), patch(
            "streamlit.metrics_util.open", mock_open(read_data=file_data), create=True
        ), patch(
            "streamlit.metrics_util.os.path.isfile"
        ) as path_isfile:

            path_isfile = lambda path: path == "/etc/machine-id"

            machine_id = metrics_util._get_machine_id()
        self.assertEqual(machine_id, file_data)

    def test_machine_id_from_dbus(self):
        """Test getting the machine id from /var/lib/dbus"""
        file_data = "dbus"

        with patch("streamlit.metrics_util.platform.system", return_value=False), patch(
            "streamlit.metrics_util.uuid.getnode", return_value=MAC
        ), patch(
            "streamlit.metrics_util.open", mock_open(read_data=file_data), create=True
        ), patch(
            "streamlit.metrics_util.os.path.isfile"
        ) as path_isfile:

            path_isfile = lambda path: path == "/var/lib/dbus/machine-id"

            machine_id = metrics_util._get_machine_id()
        self.assertEqual(machine_id, file_data)

    def test_machine_id_from_node(self):
        """Test getting the machine id as the mac address"""

        with patch("streamlit.metrics_util.platform.system", return_value=False), patch(
            "streamlit.metrics_util.uuid.getnode", return_value=MAC
        ), patch("streamlit.metrics_util.os.path.isfile", return_value=False):

            machine_id = metrics_util._get_machine_id()
        self.assertEqual(machine_id, MAC)

    def test_machine_id_v3_from_etc(self):
        """Test getting the machine id from /etc"""
        file_data = "etc"

        with patch("streamlit.metrics_util.platform.system", return_value=False), patch(
            "streamlit.metrics_util.uuid.getnode", return_value=MAC
        ), patch(
            "streamlit.metrics_util.open", mock_open(read_data=file_data), create=True
        ), patch(
            "streamlit.metrics_util.os.path.isfile"
        ) as path_isfile:

            path_isfile = lambda path: path == "/etc/machine-id"

            machine_id = metrics_util._get_machine_id_v3()
        self.assertEqual(machine_id, file_data)

    def test_machine_id_v3_from_dbus(self):
        """Test getting the machine id from /var/lib/dbus"""
        file_data = "dbus"

        with patch("streamlit.metrics_util.platform.system", return_value=False), patch(
            "streamlit.metrics_util.uuid.getnode", return_value=MAC
        ), patch(
            "streamlit.metrics_util.open", mock_open(read_data=file_data), create=True
        ), patch(
            "streamlit.metrics_util.os.path.isfile"
        ) as path_isfile:

            path_isfile = lambda path: path == "/var/lib/dbus/machine-id"

            machine_id = metrics_util._get_machine_id_v3()
        self.assertEqual(machine_id, file_data)

    def test_machine_id_v3_from_node(self):
        """Test getting the machine id as the mac address"""

        with patch("streamlit.metrics_util.platform.system", return_value=False), patch(
            "streamlit.metrics_util.uuid.getnode", return_value=MAC
        ), patch("streamlit.metrics_util.os.path.isfile", return_value=False):

            machine_id = metrics_util._get_machine_id_v3()
        self.assertEqual(machine_id, MAC)

    @patch("streamlit.metrics_util.file_util.get_streamlit_file_path", mock_get_path)
    def test_stable_id_not_exists(self):
        """Test creating a stable id """

        with patch("streamlit.metrics_util.os.path.exists", return_value=False), patch(
            "streamlit.metrics_util.uuid.uuid4", return_value=UUID
        ), patch("streamlit.file_util.open", mock_open()) as open, patch(
            "streamlit.util.os.makedirs"
        ) as makedirs:

            machine_id = metrics_util._get_stable_random_id()
            open().write.assert_called_once_with(UUID)
        self.assertEqual(machine_id, UUID)

    @patch("streamlit.metrics_util.file_util.get_streamlit_file_path", mock_get_path)
    def test_stable_id_exists_and_valid(self):
        """Test getting a stable valid id """

        with patch("streamlit.metrics_util.os.path.exists", return_value=True), patch(
            "streamlit.file_util.open", mock_open(read_data=UUID)
        ) as open:

            machine_id = metrics_util._get_stable_random_id()
            open().read.assert_called_once()
        self.assertEqual(machine_id, UUID)

    @patch("streamlit.metrics_util.file_util.get_streamlit_file_path", mock_get_path)
    def test_stable_id_exists_and_invalid(self):
        """Test getting a stable invalid id """

        with patch("streamlit.metrics_util.os.path.exists", return_value=True), patch(
            "streamlit.metrics_util.uuid.uuid4", return_value=UUID
        ), patch("streamlit.file_util.open", mock_open(read_data="")) as open, patch(
            "streamlit.util.os.makedirs"
        ) as makedirs:

            machine_id = metrics_util._get_stable_random_id()
            open().read.assert_called_once()
            open().write.assert_called_once_with(UUID)
        self.assertEqual(machine_id, UUID)
