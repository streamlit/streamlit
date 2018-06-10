"""Main handler for proxy."""

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
