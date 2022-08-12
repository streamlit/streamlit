import unittest

import requests
import requests_mock

from streamlit import net_util


class UtilTest(unittest.TestCase):
    def setUp(self):
        net_util._external_ip = None

    def test_get_external_ip(self):
        # Test success
        with requests_mock.mock() as m:
            m.get(net_util._AWS_CHECK_IP, text="1.2.3.4")
            self.assertEqual("1.2.3.4", net_util.get_external_ip())

        net_util._external_ip = None

        # Test failure
        with requests_mock.mock() as m:
            m.get(net_util._AWS_CHECK_IP, exc=requests.exceptions.ConnectTimeout)
            self.assertEqual(None, net_util.get_external_ip())

    def test_get_external_ip_html(self):
        # This tests the case where the external URL returns a web page.
        # https://github.com/streamlit/streamlit/issues/554#issuecomment-604847244

        response_text = """
        <html>
            ... stuff
        </html>
        """

        with requests_mock.mock() as m:
            m.get(net_util._AWS_CHECK_IP, text=response_text)
            self.assertEqual(None, net_util.get_external_ip())

        net_util._external_ip = None
