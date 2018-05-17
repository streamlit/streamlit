# Defe
import pkg_resources
__version__ = pkg_resources.require("streamlit")[0].version

# Import some files directly from this module
from streamlit.Chart import *
from streamlit.caching import cache
from streamlit import io
