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

# Clear out all temporary variables.
sys.path.pop()
del os, sys


# import importlib.util
# import os
# import re
# import sys
#
# # Append the current path to the paths to get imports working properly.
# dir_path = os.path.dirname(os.path.realpath(__file__))
# sys.path.append(dir_path)
#
# # Extract this modules
# this_module = sys.modules[__name__]
#
# # Filter the symbols in each module by this regular expression
# camel_case_name = re.compile('(?!(DESCRIPTOR)|(.*__pb2))(([A-Z][a-z0-9]*)+)')
#
# # Search the current path for all possible modules.
# modules = [name for name in os.listdir(dir_path) if name.endswith('_pb2.py')]
# for module in modules:
#     module_name = f'protobuf.{module[:-3]}'
#     module_path = os.path.join(dir_path, module)
#     spec = importlib.util.spec_from_file_location(module_name, module_path)
#     module = importlib.util.module_from_spec(spec)
#     spec.loader.exec_module(module)
#     for name in filter(camel_case_name.match, dir(module)):
#         setattr(this_module, name, getattr(module, name))
#
# # Clear out all temporary variables.
# sys.path.pop()
# del importlib, os, re, sys, this_module, camel_case_name, modules
