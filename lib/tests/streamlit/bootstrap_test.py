# Copyright 2018-2020 Streamlit Inc.
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

import sys
import unittest

import matplotlib
from mock import patch

try:
    # Python 2
    from StringIO import StringIO
except ImportError:
    # Python 3
    from io import StringIO

from streamlit import bootstrap
from streamlit import config
from streamlit.Report import Report
from tests import testutil

report = Report("the/path", "test command line")


class BootstrapTest(unittest.TestCase):
    @patch("streamlit.bootstrap.tornado.ioloop")
    @patch("streamlit.bootstrap.Server")
    def test_fix_matplotlib_crash(self, _1, _2):
        """Test that bootstrap.run sets the matplotlib backend to
        "Agg" if config.runner.fixMatplotlib=True.
        """
        # TODO: Find a proper way to mock sys.platform
        ORIG_PLATFORM = sys.platform

        for platform, do_fix in [("darwin", True), ("linux2", True)]:
            sys.platform = platform

            matplotlib.use("pdf", force=True)

            config._set_option("runner.fixMatplotlib", True, "test")
            bootstrap.run("/not/a/script", "", [])
            if do_fix:
                self.assertEqual("agg", matplotlib.get_backend().lower())
            else:
                self.assertEqual("pdf", matplotlib.get_backend().lower())

            # Reset
            matplotlib.use("pdf", force=True)

            config._set_option("runner.fixMatplotlib", False, "test")
            bootstrap.run("/not/a/script", "", [])
            self.assertEqual("pdf", matplotlib.get_backend().lower())

        sys.platform = ORIG_PLATFORM


class BootstrapPrintTest(unittest.TestCase):
    """Test bootstrap.py's printing functions."""

    def setUp(self):
        self.orig_stdout = sys.stdout
        sys.stdout = StringIO()

    def tearDown(self):
        sys.stdout.close()  # sys.stdout is a StringIO at this point.
        sys.stdout = self.orig_stdout

    def test_print_urls_configured(self):
        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": True}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {"browser.serverAddress": "the-address"}
        )

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url()

        out = sys.stdout.getvalue()
        self.assertTrue("URL: http://the-address" in out)

    @patch("streamlit.net_util.get_external_ip")
    @patch("streamlit.net_util.get_internal_ip")
    def test_print_urls_remote(self, mock_get_internal_ip, mock_get_external_ip):

        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": False}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {"server.headless": True}
        )

        mock_get_internal_ip.return_value = "internal-ip"
        mock_get_external_ip.return_value = "external-ip"

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url()

        out = sys.stdout.getvalue()
        self.assertTrue("Network URL: http://internal-ip" in out)
        self.assertTrue("External URL: http://external-ip" in out)

    @patch("streamlit.net_util.get_external_ip")
    @patch("streamlit.net_util.get_internal_ip")
    def test_print_urls_remote_no_external(
        self, mock_get_internal_ip, mock_get_external_ip
    ):

        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": False}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {"server.headless": True}
        )

        mock_get_internal_ip.return_value = "internal-ip"
        mock_get_external_ip.return_value = None

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url()

        out = sys.stdout.getvalue()
        self.assertTrue("Network URL: http://internal-ip" in out)
        self.assertTrue("External URL: http://external-ip" not in out)

    @patch("streamlit.net_util.get_external_ip")
    @patch("streamlit.net_util.get_internal_ip")
    def test_print_urls_remote_no_internal(
        self, mock_get_internal_ip, mock_get_external_ip
    ):

        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": False}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {"server.headless": True}
        )

        mock_get_internal_ip.return_value = None
        mock_get_external_ip.return_value = "external-ip"

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url()

        out = sys.stdout.getvalue()
        self.assertTrue("Network URL: http://internal-ip" not in out)
        self.assertTrue("External URL: http://external-ip" in out)

    @patch("streamlit.net_util.get_internal_ip")
    def test_print_urls_local(self, mock_get_internal_ip):
        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": False}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {"server.headless": False}
        )

        mock_get_internal_ip.return_value = "internal-ip"

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url()

        out = sys.stdout.getvalue()
        self.assertTrue("Local URL: http://localhost" in out)
        self.assertTrue("Network URL: http://internal-ip" in out)

    @patch("streamlit.net_util.get_internal_ip")
    def test_print_urls_port(self, mock_get_internal_ip):
        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": False}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {"server.headless": False, "server.port": 9988, "global.useNode": False}
        )

        mock_get_internal_ip.return_value = "internal-ip"

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url()

        out = sys.stdout.getvalue()
        self.assertTrue("Local URL: http://localhost:9988" in out)
        self.assertTrue("Network URL: http://internal-ip:9988" in out)

    @patch("streamlit.net_util.get_internal_ip")
    def test_print_urls_base(self, mock_get_internal_ip):
        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": False}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {
                "server.headless": False,
                "server.baseUrlPath": "foo",
                "server.port": 8501,
                "global.useNode": False,
            }
        )

        mock_get_internal_ip.return_value = "internal-ip"

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url()

        out = sys.stdout.getvalue()
        self.assertTrue("Local URL: http://localhost:8501/foo" in out)
        self.assertTrue("Network URL: http://internal-ip:8501/foo" in out)

    @patch("streamlit.net_util.get_internal_ip")
    def test_print_urls_base_no_internal(self, mock_get_internal_ip):
        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": False}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {
                "server.headless": False,
                "server.baseUrlPath": "foo",
                "server.port": 8501,
                "global.useNode": False,
            }
        )

        mock_get_internal_ip.return_value = None

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url()

        out = sys.stdout.getvalue()
        self.assertTrue("Local URL: http://localhost:8501/foo" in out)
        self.assertTrue("Network URL: http://internal-ip:8501/foo" not in out)
