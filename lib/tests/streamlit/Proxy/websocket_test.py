"""App Unittest."""
try:
    import http.client as status
except ImportError:
    import httplib as status

from tornado.testing import AsyncHTTPTestCase

from streamlit.Proxy import Proxy


class ClientWebSocketTest(AsyncHTTPTestCase):
    """Unittest class for streamlit.Proxy.websocket.ClientWebSocket."""

    def get_app(self):
        """Get app."""
        proxy = Proxy()
        return proxy._app

    def test_ClientWebSocket_class(self):
        """Test ClientWebSocket class."""
        path = '/'
        resp = self.fetch(path, method='GET')
        self.assertEquals(resp.code, status.NOT_FOUND)
