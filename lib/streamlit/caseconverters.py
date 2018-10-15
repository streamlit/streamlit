# -*- coding: future_fstrings -*-

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import re

def to_upper_camel_case(snake_case_str):
    """Converts snake_case to UpperCamelCase.
    Example:
        foo_bar -> FooBar
    """
    return ''.join(map(str.title, snake_case_str.split('_')))

def to_lower_camel_case(snake_case_str):
    """Converts snake_case to lowerCamelCase.

    Example:
        foo_bar -> fooBar
    """
    upperCamelCase = to_upper_camel_case(snake_case_str)
    if upperCamelCase:
        return upperCamelCase[0].lower() + upperCamelCase[1:]
    else:
        return ''

def to_snake_case(camel_case_str):
    """Converts UpperCamelCase and lowerCamelCase to snake_case.

    Examples:
        fooBar -> foo_bar
        BazBang -> baz_bang
    """
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', camel_case_str)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()
