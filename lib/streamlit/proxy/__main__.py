"""Main handler for proxy."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from streamlit.logger import get_logger, set_this_is_proxy
set_this_is_proxy()
LOGGER = get_logger()

from streamlit.proxy import Proxy

def main():
    """Run Proxy main handler.

    Creates a proxy server and launches the browser to connect to it.
    The proxy server will close when the browswer connection closes (or if
    it times out waiting for the browser connection.)
    """
    proxy_server = Proxy()
    LOGGER.debug('Instantiated the proxy server. About to call run_app()')
    proxy_server.run_app()
    LOGGER.debug('Finished calling run app.')

if __name__ == '__main__':
    main()
