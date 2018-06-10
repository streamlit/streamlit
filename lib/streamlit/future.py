# -*- coding: future_fstrings -*-

"""Smooths out some differences between python 2 and 3. It is meant to
be called as follows:

from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit import future
future.setup_2_3_compatibility(globals())
"""

import sys

def setup_2_3_compatibility(caller_globals):
    """
    Meant to be called as follows:

    setup_2_3_compatibility(globals())

    And sets up a bunch of compatibility aliases to make python 2 more like
    python 3.
    """
    if sys.version_info >= (3, 0):
        assert False, "TODO: Delete this assertion after verifying it triggers in python 3. ~ Adrien"
        return

    # These are the symbols we will export to the calling package.
    export_symbols = []

    # Override basic types.
    from builtins import range, map, str, dict, object, zip, int
    export_symbols += ['range', 'map', 'str', 'dict', 'object', 'zip', 'int']

    # Oerride the open function.
    from io import open
    export_symbols += ['open']

    # Export these symbols to the calling function's symbol table.
    for symbol in export_symbols:
        caller_globals[symbol] = locals()[symbol]

    import urllib, test, dbm
    print(urllib)
    print(test)
    print(dbm)
    sys.exit(-1)

    # # Do a bunch of dark monkey patching magic.
    # from future.standard_library import install_aliases
    # install_aliases()
