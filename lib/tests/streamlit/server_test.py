import sys
import unittest
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

report = Report('the/path', ['arg0', 'arg1'])

class BootstrapPrintTest(unittest.TestCase):
    """Test bootstrap.py's printing functions."""

    def setUp(self):
        self.orig_stdout = sys.stdout
        sys.stdout = StringIO()

    def tearDown(self):
        sys.stdout.close()  # sys.stdout is a StringIO at this point.
        sys.stdout = self.orig_stdout

    def test_print_urls_configured(self):
        orig_get_option = config.get_option
        orig_is_manually_set = config.is_manually_set

        def mock_get_option(arg):
            if arg == 'browser.proxyAddress':
                return 'the-address'
            return orig_get_option(arg)

        def mock_is_manually_set(arg):
            if arg == 'browser.proxyAddress':
                return True
            return orig_is_manually_set(arg)

        with patch.object(config, 'get_option', new=mock_get_option), \
            patch.object(
                config, 'is_manually_set', new=mock_is_manually_set):
            bootstrap._print_url(report)

        out = sys.stdout.getvalue()
        self.assertTrue('URL: http://the-address' in out)

    @patch('streamlit.bootstrap.util.get_external_ip')
    @patch('streamlit.bootstrap.util.get_internal_ip')
    def test_print_urls_remote(
        self, mock_get_internal_ip, mock_get_external_ip):
        orig_get_option = config.get_option
        orig_is_manually_set = config.is_manually_set

        def mock_is_manually_set(arg):
            if arg == 'browser.proxyAddress':
                return False
            return orig_is_manually_set(arg)

        def mock_get_option(arg):
            if arg == 'proxy.isRemote':
                return True
            return orig_get_option(arg)

        mock_get_internal_ip.return_value = 'internal-ip'
        mock_get_external_ip.return_value = 'external-ip'

        with patch.object(config, 'get_option', new=mock_get_option), \
            patch.object(
                config, 'is_manually_set', new=mock_is_manually_set):
            bootstrap._print_url(report)

        out = sys.stdout.getvalue()
        self.assertTrue('Network URL: http://internal-ip' in out)
        self.assertTrue('External URL: http://external-ip' in out)

    @patch('streamlit.bootstrap.util.get_internal_ip')
    def test_print_urls_local(self, mock_get_internal_ip):
        orig_get_option = config.get_option
        orig_is_manually_set = config.is_manually_set

        def mock_is_manually_set(arg):
            if arg == 'browser.proxyAddress':
                return False
            return orig_is_manually_set(arg)

        def mock_get_option(arg):
            if arg == 'proxy.isRemote':
                return False
            return orig_get_option(arg)

        mock_get_internal_ip.return_value = 'internal-ip'

        with patch.object(config, 'get_option', new=mock_get_option), \
            patch.object(
                config, 'is_manually_set', new=mock_is_manually_set):
            bootstrap._print_url(report)

        out = sys.stdout.getvalue()
        self.assertTrue('Local URL: http://localhost' in out)
        self.assertTrue('Network URL: http://internal-ip' in out)
