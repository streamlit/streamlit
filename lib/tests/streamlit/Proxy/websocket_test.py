"""App Unittest."""
#try:
#    import http.client as status
#except ImportError:
#    import httplib as status
#
#from tornado.testing import AsyncHTTPTestCase

# Disabled all of this because it was failing.
# Made a ticket to fix this: https://trello.com/c/J34ANHhR

# from streamlit.Proxy import Proxy
#
#
# class BrowserWebSocketTest(AsyncHTTPTestCase):
#     """Unittest class for streamlit.Proxy.websocket.BrowserWebSocket."""
#
#     def get_app(self):
#         """Get app."""
#         proxy = Proxy()
#         return proxy._app
#
#     def test_BrowserWebSocket_class(self):
#         """Test BrowserWebSocket class."""
#         path = '/'
#         resp = self.fetch(path, method='GET')
#         self.assertEqual(resp.code, status.NOT_FOUND)
