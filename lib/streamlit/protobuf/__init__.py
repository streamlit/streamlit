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

from Chart_pb2 import Chart
from Element_pb2 import Element
from Delta_pb2 import Delta
from DataFrame_pb2 import DataFrame, Index, Table, AnyArray
import DataTransform_pb2 as DataTransform
from Text_pb2 import Text
from Balloons_pb2 import Balloons
from ForwardMsg_pb2 import ForwardMsg
from BackMsg_pb2 import BackMsg

# Clear out all temporary variables.
sys.path.pop()
del os, sys
