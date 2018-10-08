# -*- coding: future_fstrings -*-

"""
Constructs the protobuf module.

Takes symbols from ./*_pb2.py and re-exports them in this module.
"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import os
import sys

# Append the current path to the paths to get imports working properly.
dir_path = os.path.dirname(os.path.realpath(__file__))
sys.path.append(dir_path)

from BackMsg_pb2 import BackMsg  # noqa: F401
from Balloons_pb2 import Balloons  # noqa: F401
from Chart_pb2 import Chart  # noqa: F401
from DataFrame_pb2 import DataFrame, Index, Table, AnyArray  # noqa: F401
from Delta_pb2 import Delta  # noqa: F401
from Element_pb2 import Element  # noqa: F401
from ForwardMsg_pb2 import ForwardMsg  # noqa: F401
from Text_pb2 import Text  # noqa: F401

import DataTransform_pb2 as DataTransform  # noqa: F401

# Clear out all temporary variables.
sys.path.pop()
del os, sys
