"""Proxy Unittest."""
from tornado.testing import AsyncHTTPTestCase

from streamlit.Proxy import Proxy


class ProxyTest(AsyncHTTPTestCase):
    """Proxy unittest class."""

    def get_app(self):
        """Get app."""
        proxy = Proxy()
        return proxy._app

    def test_Proxy_class(self):
        """Test streamlit.Proxy.Proxy class."""
        # For now do nothing, just setup the scaffolding.
        self.assertTrue(True)
