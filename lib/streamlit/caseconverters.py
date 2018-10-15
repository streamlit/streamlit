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
        fooBar -> foobar
    """
    titleCaseWords = [w for w in snake_case_str.title().split('_')]
    if titleCaseWords:
        return titleCaseWords[0].lower() + ''.join(titleCaseWords[1:])
    else:
        return ''

def to_lower_camel_case_if_no_underscores(snake_case_str):
    """Converts snake_case to lowerCamelCase if there is no "_" in input.

    If input has underscores, does nothing.

    Example:
        foo_bar -> fooBar
        fooBar -> fooBar
    """
    if '_' in snake_case_str:
        return to_lower_camel_case(snake_case_str)
    return snake_case_str

def to_snake_case(camel_case_str):
    """Converts UpperCamelCase and lowerCamelCase to snake_case.

    Examples:
        fooBar -> foo_bar
        BazBang -> baz_bang
    """
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', camel_case_str)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

def convert_dict_keys(func, dic):
    """Applies a conversion function to all keys in a dict.

    Args 
    ----
    func : a conversion function from string to string.
    dic : the dictionary to convert in place.
    """
    for k, v in dic.items():
        converted_key = func(k)
        if converted_key == k: continue

        dic.pop(k)

        if type(v) is dict:
            dic[converted_key] = convert_dict_keys(func, v)
        else:
            dic[converted_key] = v
