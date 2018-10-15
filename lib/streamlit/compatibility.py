# -*- coding: future_fstrings -*-

"""Smooths out some differences between python 2 and 3. It is meant to
be called as follows:

from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())
"""

import sys
import os

def setup_2_3_shims(caller_globals):
    """
    Meant to be called as follows:

    setup_2_3_shims(globals())

    And sets up a bunch of compatibility aliases to make python 2 more like
    python 3.
    """
    if running_py3():
        caller_globals['dict_types'] = (type({}),)
        caller_globals['string_types'] = (type(''),)
    else:
        # These are the symbols we will export to the calling package.
        export_symbols = []

        # Override basic types.
        from builtins import range, map, str, dict, object, zip, int
        export_symbols += ['range', 'map', 'str', 'dict', 'object', 'zip', 'int']

        # Oerride the open function.
        from io import open
        export_symbols += ['open']

        from six import string_types
        export_symbols += ['string_types']

        # Export these symbols to the calling function's symbol table.
        for symbol in export_symbols:
            caller_globals[symbol] = locals()[symbol]

        # Special Cases
        caller_globals['FileNotFoundError'] = IOError
        caller_globals['dict_types'] = (dict, type({}))

        # Before we can call future.stanard_library, we need to make sure we're not
        # overriding any of the packages that it monkey patches or this can cause
        # some screwyness.
        illegal_package_names = ['urllib', 'test', 'dbm']
        current_directory_files = os.listdir('.')
        for illegal_package_name in illegal_package_names:
            illegal_source_file = illegal_package_name + '.py'
            assert illegal_source_file not in current_directory_files, \
                f'File "{illegal_source_file}" overrides a built-in package name.' \
                ' Please rename it.'

        # Do a bunch of dark monkey patching magic.
        from future.standard_library import install_aliases
        install_aliases()

def running_py3():
    """Returns True iff we're running 3 or above."""
    return sys.version_info >= (3, 0)
