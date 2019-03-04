# Copyright 2018 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

"""This class stores a key-value pair for the config system."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import datetime
import re

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


class ConfigOption(object):
    '''Stores a Streamlit configuration option.

    A configuration option, like 'client.proxyPort', which indicates which port
    to use when connecting to the proxy. There are two ways to create a
    ConfigOption:

    Simple ConfigOptions are created as follows:

        ConfigOption('client.proxyPort',
            description = 'Connect to the proxy at this port.',
            default_val = 8501)

    More complex config options resolve thier values at runtime as follows:

        @ConfigOption('client.proxyPort')
        def _proxy_port():
            """Connect to the proxy at this port.

            Defaults to 8501.
            """
            return 8501

    NOTE: For complex config options, the function is called each time the
    option.value is evaluated!

    Attributes
    ----------
    key : str
        The fully qualified section.name
    value
        The value for this option. If this is a a complex config option then
        the callback is called EACH TIME value is evaluated.
    section : str
        The section of this option.
    name : str
        The name of this option.
    description : str
        A "commment" for this option.
    where_defined : str
        Indicates which file set this config option.
        ConfigOption.DEFAULT_DEFINITION means this file.
    visibility : {'visible', 'hidden', 'obfuscated'}
        If 'hidden', will not include this when listing all options to users.
        If 'obfuscated', will list it, but will not print out its actual value.
    deprecated: bool
        Whether this config option is deprecated.
    deprecation_text : str or None
        If this config option is deprecated, set to a string explaining what to
        use instead.
    expiration_date : str or None
        If this config option is deprecated, this is the date at which it
        will no longer be accepted. Format: 'YYYY-MM-DD'.

    '''

    # This is a special value for ConfigOption.where_defined which indicates
    # that the option default was not overridden.
    DEFAULT_DEFINITION = '<default>'

    def __init__(
            self, key, description=None, default_val=None,
            visibility='visible', deprecated=False, deprecation_text=None,
            expiration_date=None):
        """Create a ConfigOption with the given name.

        Parameters
        ----------
        key : str
            Should be of the form "section.optionName"
        description : str
            Like a comment for the config option.
        default_val : anything
            The value for this config option.
        visibility : {'visible', 'hidden', 'obfuscated'}
            Whether this option should be shown to users.
        deprecated: bool
            Whether this config option is deprecated.
        deprecation_text : str or None
            If this config option is deprecated, set to a string explaining what to
            use instead.
        expiration_date : str or None
            If this config option is deprecated, this is the date at which it
            will no longer be accepted. Format: 'YYYY-MM-DD'.

        """
        # Parse out the section and name.
        self.key = key
        key_format = \
            r'(?P<section>\_?[a-z][a-z0-9]*)\.(?P<name>[a-z][a-zA-Z0-9]*)$'
        match = re.match(key_format, self.key)
        assert match, 'Key "%s" has invalid format.' % self.key
        self.section, self.name = match.group('section'), match.group('name')

        # This string is like a comment. If None, it should be set in __call__.
        self.description = description

        self.visibility = visibility
        self.default_val = default_val
        self.deprecated = deprecated

        if self.deprecated:
            assert expiration_date, \
                'expiration_date is required for deprecated items'
            assert deprecation_text, \
                'deprecation_text is required for deprecated items'
            self.expiration_date = expiration_date
            self.deprecation_text = deprecation_text

        # Set the value.
        self._get_val_func = None
        self.where_defined = None
        self.set_value(default_val, ConfigOption.DEFAULT_DEFINITION)

    def __call__(self, get_val_func):
        """Assign a function to compute the value for this option.

        This method is called when ConfigOption is used as a decorator.

        Parameters
        ----------
        get_val_func : function
            A function which will be called to get the value of this parameter.
            We will use its docString as the description.

        Returns
        -------
        ConfigOption
            Returns self, which makes testing easier. See config_test.py.

        """
        assert get_val_func.__doc__, (
            'Complex config options require doc strings for their description.')
        self.description = get_val_func.__doc__
        self._get_val_func = get_val_func
        return self

    @property
    def value(self):
        """Get the value of this config option."""
        return self._get_val_func()

    def set_value(self, value, where_defined):
        """Set the value of this option.

        Parameters
        ----------
        value
            The new value for this parameter.
        where_defined : str
            New value to remember where this parameter was set.

        """
        self._get_val_func = lambda: value
        self.where_defined = where_defined

        if (self.deprecated and
                where_defined != ConfigOption.DEFAULT_DEFINITION):

            details = {
                'key': self.key,
                'file': self.where_defined,
                'explanation': self.deprecation_text,
                'date': self.expiration_date,
            }

            if self.is_expired():
                raise DeprecationError(
                    '\n'
                    '════════════════════════════════════════════════\n'
                    '%(key)s IS NO LONGER SUPPORTED.\n'
                    '%(explanation)s\n'
                    'Please update %(file)s.\n'
                    '════════════════════════════════════════════════\n'
                    % details)
            else:
                LOGGER.warning(
                    '\n'
                    '════════════════════════════════════════════════\n'
                    '%(key)s IS DEPRECATED.\n'
                    '%(explanation)s\n'
                    'This option will be removed on or after %(date)s.\n'
                    'Please update %(file)s.\n'
                    '════════════════════════════════════════════════\n'
                    % details)

    def is_expired(self):
        """Returns true if expiration_date is in the past."""
        if not self.deprecated:
            return False

        expiration_date = _parse_yyyymmdd_str(self.expiration_date)
        now = datetime.datetime.now()
        return now > expiration_date


def _parse_yyyymmdd_str(date_str):
    return datetime.datetime(*[int(token) for token in date_str.split('-')])


class Error(Exception):
    pass


class DeprecationError(Error):
    pass
