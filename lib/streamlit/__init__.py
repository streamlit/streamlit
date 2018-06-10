# -*- coding: future_fstrings -*-

"""Module documentation here."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.future import setup_2_3_compatibility
setup_2_3_compatibility(globals())

from . import logger
logger.init_tornado_logs()
logger.get_logger('root')
logger.set_log_level('DEBUG')

# Defe
import pkg_resources
__version__ = pkg_resources.require("streamlit")[0].version

# Import some files directly from this module
from streamlit.Chart import *
from streamlit.caching import cache
from streamlit import io
