import unittest

from mock import patch

from streamlit.proxy.proxy_util import url_is_from_allowed_origins


class ProxyUtilTest(unittest.TestCase):
    def test_url_is_from_allowed_origins_allowed_domains(self):
        with patch(
                'streamlit.proxy.proxy_util.config.get_option',
                side_effect=[True, None, None]):
            self.assertTrue(url_is_from_allowed_origins('localhost'))
            self.assertTrue(url_is_from_allowed_origins('127.0.0.1'))

    def test_url_is_from_allowed_origins_CORS_off(self):
        with patch(
                'streamlit.proxy.proxy_util.config.get_option',
                side_effect=[False]):
            self.assertTrue(url_is_from_allowed_origins('does not matter'))

    def test_url_is_from_allowed_origins_s3_bucket(self):
        with patch(
                'streamlit.proxy.proxy_util.config.get_option',
                side_effect=[True, 'mybucket', 's3.amazon.com']):
            self.assertTrue(url_is_from_allowed_origins('mybucket'))

    def test_url_is_from_allowed_origins_s3_url(self):
        with patch(
                'streamlit.proxy.proxy_util.config.get_option',
                side_effect=[True, 'mybucket', 's3.amazon.com']):
            self.assertTrue(url_is_from_allowed_origins('s3.amazon.com'))

    def test_url_is_from_allowed_origins_browser_proxyAddress(self):
        with patch('streamlit.proxy.proxy_util.config.is_manually_set'
                   ) as b, patch(
                       'streamlit.proxy.proxy_util.config.get_option',
                       side_effect=[
                           True, 'mybucket', 's3.amazon.com',
                           'browser.proxy.address'
                       ]):
            b.return_value = True
            self.assertTrue(
                url_is_from_allowed_origins('browser.proxy.address'))


if __name__ == '__main__':
    unittest.main()
