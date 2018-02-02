"""The tiny_notebook module exports one class, Notebook, which can be used
to create and interact with printed elements."""

import os
import sys
from functools import reduce


# Set shared_lib_path to "../../shared/server" using an absolute path.
path = __file__
split_path = ['/']
while path != '/':
    path, new_path = os.path.split(path)
    split_path.insert(1, new_path)
shared_lib_path = reduce(os.path.join, split_path[:-2] + ['shared', 'server'])

# Import submodules from ../../shared/sever.
try:
    sys.path.append(shared_lib_path)
    import protobuf
finally:
    assert shared_lib_path in sys.path, 'Path should include shared_lib_path.'
    sys.path.remove(shared_lib_path)

# Import some files directly from this module
from .Notebook import Notebook
from .Chart import Chart

# Clean things up and export symbols.
del os, sys, reduce
__all__ = ['Notebook', 'Chart', 'protobuf']
