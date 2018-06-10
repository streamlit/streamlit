# -*- coding: future_fstrings -*-

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import functools

def janky_test(func):
    @functools.wraps(func)
    def wrapped():
        print(func.__name__)
        func()
        print('Passed.\n')
    return wrapped

@janky_test
def test_print_function():
    from io import BytesIO
    string_buffer = BytesIO()
    print(1, 2, file=string_buffer)
    assert string_buffer.getvalue() == '1 2\n'

@janky_test
def test_builtin_types():
    import abc, itertools, future.types
    assert type(range) == abc.ABCMeta
    assert map == itertools.imap
    assert str == future.types.newstr
    assert dict == future.types.newdict
    assert object == future.types.newobject
    assert zip == itertools.izip
    assert int == future.types.newint
    assert open.__module__ == '_io'

if __name__ == '__main__':
    test_print_function()
    test_builtin_types()
    print('All tests passed!')
