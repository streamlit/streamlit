from mock import patch
import unittest

from streamlit import Server


class ServerUtilsTest(unittest.TestCase):
    def test_is_url_from_allowed_origins_allowed_domains(self):
        with patch(
                'streamlit.Server.config.get_option',
                side_effect=[True, None, None]):
            self.assertTrue(
                Server._is_url_from_allowed_origins('localhost'))
            self.assertTrue(
                Server._is_url_from_allowed_origins('127.0.0.1'))

    def test_is_url_from_allowed_origins_CORS_off(self):
        with patch(
                'streamlit.Server.config.get_option',
                side_effect=[False]):
            self.assertTrue(
                Server._is_url_from_allowed_origins('does not matter'))

    def test_is_url_from_allowed_origins_s3_bucket(self):
        with patch(
                'streamlit.Server.config.get_option',
                side_effect=[True, 'mybucket', 's3.amazon.com']):
            self.assertTrue(
                Server._is_url_from_allowed_origins('mybucket'))

    def test_is_url_from_allowed_origins_s3_url(self):
        with patch(
                'streamlit.Server.config.get_option',
                side_effect=[True, 'mybucket', 's3.amazon.com']):
            self.assertTrue(
                Server._is_url_from_allowed_origins('s3.amazon.com'))

    def test_is_url_from_allowed_origins_browser_proxyAddress(self):
        with patch('streamlit.Server.config.is_manually_set'
                   ) as b, patch(
                       'streamlit.Server.config.get_option',
                       side_effect=[
                           True, 'mybucket', 's3.amazon.com',
                           'browser.server.address'
                       ]):
            b.return_value = True
            self.assertTrue(Server._is_url_from_allowed_origins(
                'browser.server.address'))
