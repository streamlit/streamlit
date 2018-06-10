"""The package which includes all files related to the Streamlit proxy
server."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from .ClientWebSocket import ClientWebSocket
from .LocalWebSocket import LocalWebSocket
from .Proxy import Proxy
from .ProxyConnection import ProxyConnection
