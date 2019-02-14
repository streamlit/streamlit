from mock import patch, mock_open
import hashlib
import sys
import unittest

from streamlit.proxy import proxy_util

is_python_2 = sys.version_info[0] == 2


class ProxyUtilTest(unittest.TestCase):
    def test_url_is_from_allowed_origins_allowed_domains(self):
        with patch(
                'streamlit.proxy.proxy_util.config.get_option',
                side_effect=[True, None, None]):
            self.assertTrue(
                proxy_util.url_is_from_allowed_origins('localhost'))
            self.assertTrue(
                proxy_util.url_is_from_allowed_origins('127.0.0.1'))

    def test_url_is_from_allowed_origins_CORS_off(self):
        with patch(
                'streamlit.proxy.proxy_util.config.get_option',
                side_effect=[False]):
            self.assertTrue(
                proxy_util.url_is_from_allowed_origins('does not matter'))

    def test_url_is_from_allowed_origins_s3_bucket(self):
        with patch(
                'streamlit.proxy.proxy_util.config.get_option',
                side_effect=[True, 'mybucket', 's3.amazon.com']):
            self.assertTrue(
                proxy_util.url_is_from_allowed_origins('mybucket'))

    def test_url_is_from_allowed_origins_s3_url(self):
        with patch(
                'streamlit.proxy.proxy_util.config.get_option',
                side_effect=[True, 'mybucket', 's3.amazon.com']):
            self.assertTrue(
                proxy_util.url_is_from_allowed_origins('s3.amazon.com'))

    def test_url_is_from_allowed_origins_browser_proxyAddress(self):
        with patch('streamlit.proxy.proxy_util.config.is_manually_set'
                   ) as b, patch(
                       'streamlit.proxy.proxy_util.config.get_option',
                       side_effect=[
                           True, 'mybucket', 's3.amazon.com',
                           'browser.proxy.address'
                       ]):
            b.return_value = True
            self.assertTrue(proxy_util.url_is_from_allowed_origins(
                'browser.proxy.address'))

    def test_md5_calculation_succeeds_with_bytes_input(self):
        with patch('streamlit.proxy.proxy_util.open',
                   mock_open(read_data=b'hello')) as m:
            md5 = proxy_util.calc_md5_with_blocking_retries('foo')
            self.assertEqual(md5, '5d41402abc4b2a76b9719d911017c592')

    def test_md5_calculation_opens_file_with_rb(self):
        # This tests implementation :( . But since the issue this is addressing
        # could easily come back to bite us if a distracted coder tweaks the
        # implementation, I'm putting this here anyway.
        with patch('streamlit.proxy.proxy_util.open',
                   mock_open(read_data=b'hello')) as m:
            md5 = proxy_util.calc_md5_with_blocking_retries('foo')
            m.assert_called_once_with('foo', 'rb')



if __name__ == '__main__':
    unittest.main()
