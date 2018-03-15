"""
Constructs the protobuf module.

Takes symbols from ./*_pb2.py and re-exports them in this module.
"""

import os
import sys

# Append the current path to the paths to get imports working properly.
dir_path = os.path.dirname(os.path.realpath(__file__))
sys.path.append(dir_path)

from Chart_pb2 import Chart
from Div_pb2 import Div
from Element_pb2 import Element
from Delta_pb2 import Delta, DeltaList
from DataFrame_pb2 import DataFrame, Index, Table, AnyArray
from Text_pb2 import Text
# from ObjectId_pb2 import ObjectId
from StreamlitMsg_pb2 import StreamlitMsg

# Clear out all temporary variables.
sys.path.pop()
del os, sys
