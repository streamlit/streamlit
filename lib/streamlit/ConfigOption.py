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
    when connecting to the proxy. There are two ways to create a ConfigOption:

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

    NOTE: For compplex config options, the function is called each time the
    option.value is evaluated!

    Properties
    ----------

        key: string
            The fully qualified section.name
        value:
            The value for this option. If this is a a complex config option then
            the callback is called EACH TIME value is evaluated.
        section: string
            The section of this option.
        name : string
            The name of this option.
        description: string
            A "commment" for this option.
        where_defined: string
            Indicates which file set this config option.
            ConfigOption.DEFAULT_DEFINITION means this file.

    '''

    # This is a special value for ConfigOption.where_defined which indicates
    # that the option default was not overridden.
    DEFAULT_DEFINITION = '<default>'

    def __init__(self, key, description=None, default_val=None):
        """Create a ConfigOption with the given name.

        Parameters
        ----------
        key : string
            Should be of the form "section.optionName"
        description : string
            Like a comment for the config option.
        default_val : anything
            The value for this config option.

        """
        # Parse out the section and name.
        self.key = key
        key_format = \
            r'(?P<section>\_?[a-z][a-z0-9]*)\.(?P<name>[a-z][a-zA-Z0-9]*)$'
        match = re.match(key_format, self.key)
        assert match, ('Key "%s" must match section.optionName.' % self.key) + str(match)
        self.section, self.name = match.group('section'), match.group('name')

        # This string is like a comment. If None, it should be set in __call__.
        self.description = description

        # Function which returns the value of this option.
        self._get_val_func = lambda: default_val

        # This indicates that (for now) we're using the default definition.
        self.where_defined = ConfigOption.DEFAULT_DEFINITION

    def __call__(self, get_val_func):
        """This method is called when ConfigOption is used as a decorator.

        Parameters
        ----------
        get_val_func : function
            A function which will be called to get the value of this parameter.
            We will use its docString as the description.

        Return
        ------
        Returns self, which makes testing easier. See config_test.py.

        """
        self.description = get_val_func.__doc__
        self._get_val_func = get_val_func
        return self

    @property
    def value(self):
        return self._get_val_func()
