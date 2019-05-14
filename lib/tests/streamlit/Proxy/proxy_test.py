import unittest
from mock import patch

from streamlit import config
from streamlit.proxy import Proxy
from streamlit.proxy.ClientConnection import ClientConnection
import streamlit.forward_msg_proto as forward_msg_proto

msg = forward_msg_proto.new_report_msg(
    'report_id', 'cwd', ['command_line'], 'source_file_path')

connection = ClientConnection(msg.new_report, 'report_name')

class StreamlitTest(unittest.TestCase):
    """Test Streamlit.proxy.Proxy"""

    @patch('streamlit.proxy.Proxy.LOGGER.info')
    def test_print_urls1(self, mock_logger):
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

        with patch.object(config, 'get_option', new=mock_get_option):
            with patch.object(
                config, 'is_manually_set', new=mock_is_manually_set):

                Proxy._print_urls(connection, float('inf'))

        string = mock_logger.call_args[0][0]
        dikt = mock_logger.call_args[0][1]
        out = string % dikt
        self.assertTrue('REPORT URL: http://the-address' in out)
        self.assertTrue('within' not in out)

    @patch('streamlit.proxy.Proxy.LOGGER.info')
    def test_print_urls2(self, mock_logger):
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

        with patch.object(config, 'get_option', new=mock_get_option):
            with patch.object(
                config, 'is_manually_set', new=mock_is_manually_set):

                Proxy._print_urls(connection, 10)

        string = mock_logger.call_args[0][0]
        dikt = mock_logger.call_args[0][1]
        out = string % dikt
        self.assertTrue('REPORT URL: http://the-address' in out)
        self.assertTrue('within 10 seconds' in out)

    @patch('streamlit.proxy.Proxy.LOGGER.info')
    @patch('streamlit.proxy.Proxy.util.get_external_ip')
    @patch('streamlit.proxy.Proxy.util.get_internal_ip')
    def test_print_urls3(
        self, mock_get_internal_ip, mock_get_external_ip, mock_logger):

        orig_is_manually_set = config.is_manually_set

        def mock_is_manually_set(arg):
            if arg == 'browser.proxyAddress':
                return False
            return orig_is_manually_set(arg)

        mock_get_internal_ip.return_value = 'internal-ip'
        mock_get_external_ip.return_value = 'external-ip'

        with patch.object(
            config, 'is_manually_set', new=mock_is_manually_set):

            Proxy._print_urls(connection, float('inf'))

        string = mock_logger.call_args[0][0]
        dikt = mock_logger.call_args[0][1]
        out = string % dikt
        self.assertTrue('INTERNAL REPORT URL: http://internal-ip' in out)
        self.assertTrue('EXTERNAL REPORT URL: http://external-ip' in out)
        self.assertTrue('within' not in out)

    @patch('streamlit.proxy.Proxy.LOGGER.info')
    @patch('streamlit.proxy.Proxy.util.get_external_ip')
    @patch('streamlit.proxy.Proxy.util.get_internal_ip')
    def test_print_urls4(
        self, mock_get_internal_ip, mock_get_external_ip, mock_logger):

        orig_is_manually_set = config.is_manually_set

        def mock_is_manually_set(arg):
            if arg == 'browser.proxyAddress':
                return False
            return orig_is_manually_set(arg)

        mock_get_internal_ip.return_value = 'internal-ip'
        mock_get_external_ip.return_value = 'external-ip'

        with patch.object(
            config, 'is_manually_set', new=mock_is_manually_set):

            Proxy._print_urls(connection, 10)

        string = mock_logger.call_args[0][0]
        dikt = mock_logger.call_args[0][1]
        out = string % dikt
        self.assertTrue('INTERNAL REPORT URL: http://internal-ip' in out)
        self.assertTrue('EXTERNAL REPORT URL: http://external-ip' in out)
        self.assertTrue('within 10 seconds' in out)
