"""
Constructs the protobuf module.

Takes symbols from notebook_pb2 and re-exports them in this module.
"""

# We filter throug the notebook_pb2 and export all CamelCase names.
from . import notebook_pb2
import re, sys

# Filter through the classes to find those in CamelCase
camel_case_name = re.compile('([A-Z][a-z0-9]*)+')
module = sys.modules[__name__]
for name in filter(camel_case_name.match, dir(notebook_pb2)):
    setattr(module, name, getattr(notebook_pb2, name))

# Clear out all temporary variables.
del notebook_pb2, re, sys, camel_case_name, module
