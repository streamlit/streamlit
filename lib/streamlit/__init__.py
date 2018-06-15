# -*- coding: future_fstrings -*-

"""Module documentation here."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from . import logger
logger.init_tornado_logs()
logger.get_logger('root')
# Defe
import pkg_resources
__version__ = pkg_resources.require("streamlit")[0].version

# Import some files directly from this module
from streamlit.Chart import *
from streamlit.caching import cache
from streamlit import st
from streamlit import config

logger.set_log_level(config.get_option('log_level').upper())
