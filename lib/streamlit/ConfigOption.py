# -*- coding: future_fstrings -*-

# Copyright 2018 Streamlit Inc. All rights reserved.

"""This classs stores a key-value pair for the config system."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import re

class ConfigOption(object):
    '''Stores a Streamlit configuration option.

    A configuration option, like 'proxy.port', which indicates which port to use
    when connecting to the proxy. ConfigurationOptions are stored globally
    in the sreamlit.config module.

    There are two ways to create a ConfigOption.

    Simple ConfigOptions are created as follows:

        ConfigOption('proxy.port',
            description = 'Connect to the proxy at this port.',
            default_val = 8501)

    More complex config options resolve thier values at runtime as follows:

        @ConfigOption('proxy.port')
        def _proxy_port():
            """Connect to the proxy at this port.

            Defaults to 8501.
            """
            return 8501

    This "magic" uses the __call__ function to make the class behave like a
    decorator. An important constraint on thise more complex config options
    is that they have no side effects, i.e.

        get_config('x.y') == get_config('x.y')
    '''

    # This is a special value for ConfigOption._where_defined which indicates
    # that the option default was not overridden.
    DEFAULT_DEFINITION = '<default>'

    # Descriptions of each of the possible config sections.
    SECTION_DESCRIPTIONS = dict(
        all = 'Global options apply across all of Streamlit.',
        proxy = 'Configuration of the proxy server.',
        _test = 'Special test section just used for unit tests.',
    )

    def __init__(self, section_dot_name, description=None, default_val=None):
        """Create a ConfigOption with the given name.

        Parameters
        ----------
        section_dot_name : string
            Should be of the form "section.optionName"
        description : string
            Like a comment for the config option.
        default_val : anything
            The value for this config option.

        """
        # Verify that the name is copacetic.
        name_format = \
            r'(?P<section>\_?[a-z][a-z0-9]+)\.(?P<name>[a-z][a-zA-Z0-9]*)$'
        match = re.match(name_format, section_dot_name)
        assert match, (
            'Name "%s" must match section.optionName.' % section_dot_name)
        section, name = match.group('section'), match.group('name')
        assert section in ConfigOption.SECTION_DESCRIPTIONS, (
            'Section "%s" must be one of %s.' %
            (section, ', '.join(ConfigOption.SECTION_DESCRIPTIONS.keys())))

        # This string is like a comment. If None, it should be set in __call__.
        self._description = description

        # Function which returns the value of this option.
        self._get_val_func = lambda: default_val

        # This indicates that (for now) we're using the default definition.
        self._where_defined = ConfigOption.DEFAULT_DEFINITION

    def __call__(self, get_val_func):
        """This method is called when ConfigOption is used as a decorator.

        Parameters
        ----------
        get_val_func : function
            A functieon which will be called to get the value of this parameter.
            We will use its docString as the description.

        Return
        ------
        Returns self, which makes testing easier. See config_test.py.

        """
        self._description = get_val_func.__doc__
        self._get_val_func = get_val_func
        return self

    def get_value(self):
        """Gets the value of this config option."""
        # Memoize the result in a property called _val
        if not hasattr(self, '_val'):
            self._val = self._get_val_func()
        return self._val

    def get_description(self):
        """Gets the value of this config option."""
        return self._description
