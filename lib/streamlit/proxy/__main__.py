"""Main handler for proxy."""

# Python 2/3 compatibility
from __future__ import print_function
from __future__ import division
from __future__ import unicode_literals
from __future__ import absolute_import
from builtins import range, map, str, dict, object, zip, int
from io import open
from future.standard_library import install_aliases
install_aliases()

from streamlit.proxy import Proxy
from streamlit.logger import get_logger

LOGGER = get_logger()

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
