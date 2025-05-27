# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Class to store a key-value pair for the config system."""

from __future__ import annotations

import datetime
import re
import textwrap
from typing import Any, Callable

from streamlit.string_util import to_snake_case
from streamlit.util import repr_


class ConfigOption:
    '''Stores a Streamlit configuration option.

    A configuration option, like 'browser.serverPort', which indicates which port
    to use when connecting to the proxy. There are two ways to create a
    ConfigOption:

    Simple ConfigOptions are created as follows:

        ConfigOption('browser.serverPort',
            description = 'Connect to the proxy at this port.',
            default_val = 8501)

    More complex config options resolve their values at runtime as follows:

        @ConfigOption('browser.serverPort')
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
    value : any
        The value for this option. If this is a complex config option then
        the callback is called EACH TIME value is evaluated.
    section : str
        The section of this option. Example: 'global'.
    name : str
        See __init__.
    description : str
        See __init__.
    where_defined : str
        Indicates which file set this config option.
        ConfigOption.DEFAULT_DEFINITION means this file.
    is_default: bool
        True if the config value is equal to its default value.
    visibility : {"visible", "hidden"}
        See __init__.
    scriptable : bool
        See __init__.
    deprecated: bool
        See __init__.
    deprecation_text : str or None
        See __init__.
    expiration_date : str or None
        See __init__.
    replaced_by : str or None
        See __init__.
    sensitive : bool
        See __init__.
    env_var: str
        The name of the environment variable that can be used to set the option.
    '''

    # This is a special value for ConfigOption.where_defined which indicates
    # that the option default was not overridden.
    DEFAULT_DEFINITION = "<default>"

    # This is a special value for ConfigOption.where_defined which indicates
    # that the options was defined by Streamlit's own code.
    STREAMLIT_DEFINITION = "<streamlit>"

    def __init__(
        self,
        key: str,
        description: str | None = None,
        default_val: Any | None = None,
        visibility: str = "visible",
        scriptable: bool = False,
        deprecated: bool = False,
        deprecation_text: str | None = None,
        expiration_date: str | None = None,
        replaced_by: str | None = None,
        type_: type = str,
        sensitive: bool = False,
    ) -> None:
        """Create a ConfigOption with the given name.

        Parameters
        ----------
        key : str
            Should be of the form "section.optionName"
            Examples: server.name, deprecation.v1_0_featureName
        description : str
            Like a comment for the config option.
        default_val : any
            The value for this config option.
        visibility : {"visible", "hidden"}
            Whether this option should be shown to users.
        scriptable : bool
            Whether this config option can be set within a user script.
        deprecated: bool
            Whether this config option is deprecated.
        deprecation_text : str or None
            Required if deprecated == True. Set this to a string explaining
            what to use instead.
        expiration_date : str or None
            Required if deprecated == True. set this to the date at which it
            will no longer be accepted. Format: 'YYYY-MM-DD'.
        replaced_by : str or None
            If this is option has been deprecated in favor or another option,
            set this to the path to the new option. Example:
            'server.runOnSave'. If this is set, the 'deprecated' option
            will automatically be set to True, and deprecation_text will have a
            meaningful default (unless you override it).
        type_ : one of str, int, float or bool
            Useful to cast the config params sent by cmd option parameter.
        sensitive: bool
            Sensitive configuration options cannot be set by CLI parameter.
        """
        # Parse out the section and name.
        self.key = key
        key_format = (
            # Capture a group called "section"
            r"(?P<section>"
            # Matching text comprised of letters and numbers that begins
            # with a lowercase letter with an optional "_" preceding it.
            # Examples: "_section", "section1"
            r"\_?[a-z][a-zA-Z0-9]*"
            # Handling zero or additional parts, separated by period
            # Examples: "_section.subsection", "section1._section2"
            r"(\.[a-z][a-zA-Z0-9]*)*"
            r")"
            # The final period, separating section and name
            r"\."
            # Capture a group called "name"
            r"(?P<name>"
            # Match text comprised of letters and numbers beginning with a
            # lowercase letter.
            # Examples: "name", "nameOfConfig", "config1"
            r"[a-z][a-zA-Z0-9]*"
            r")$"
        )
        match = re.match(key_format, self.key)
        if match is None:
            raise ValueError(f'Key "{self.key}" has invalid format.')
        self.section, self.name = match.group("section"), match.group("name")

        self.description = description

        self.visibility = visibility
        self.scriptable = scriptable
        self.default_val = default_val
        self.deprecated = deprecated
        self.replaced_by = replaced_by
        self.is_default = True
        self._get_val_func: Callable[[], Any] | None = None
        self.where_defined = ConfigOption.DEFAULT_DEFINITION
        self.type = type_
        self.sensitive = sensitive
        # infer multiple values if the default value is a list or tuple
        self.multiple = isinstance(default_val, (list, tuple))

        if self.replaced_by:
            self.deprecated = True
            if deprecation_text is None:
                deprecation_text = f"Replaced by {self.replaced_by}."

        if self.deprecated:
            if not expiration_date:
                raise ValueError("expiration_date is required for deprecated items.")
            if not deprecation_text:
                raise ValueError("deprecation_text is required for deprecated items.")
            self.expiration_date = expiration_date
            self.deprecation_text = textwrap.dedent(deprecation_text)

        self.set_value(default_val)

    def __repr__(self) -> str:
        return repr_(self)

    def __call__(self, get_val_func: Callable[[], Any]) -> ConfigOption:
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
        if get_val_func.__doc__ is None:
            raise RuntimeError(
                "Complex config options require doc strings for their description."
            )
        self.description = get_val_func.__doc__
        self._get_val_func = get_val_func
        return self

    @property
    def value(self) -> Any:
        """Get the value of this config option."""
        if self._get_val_func is None:
            return None
        return self._get_val_func()

    def set_value(self, value: Any, where_defined: str | None = None) -> None:
        """Set the value of this option.

        Parameters
        ----------
        value
            The new value for this parameter.
        where_defined : str
            New value to remember where this parameter was set.

        """
        self._get_val_func = lambda: value

        if where_defined is None:
            self.where_defined = ConfigOption.DEFAULT_DEFINITION
        else:
            self.where_defined = where_defined

        self.is_default = value == self.default_val

        if self.deprecated and self.where_defined != ConfigOption.DEFAULT_DEFINITION:
            if self.is_expired():
                # Import here to avoid circular imports
                from streamlit.logger import get_logger

                get_logger(__name__).error(
                    textwrap.dedent(
                        f"""
                    ════════════════════════════════════════════════
                    {self.key} IS NO LONGER SUPPORTED.

                    {self.deprecation_text}

                    Please update {self.where_defined}.
                    ════════════════════════════════════════════════
                    """
                    )
                )
            else:
                # Import here to avoid circular imports
                from streamlit.logger import get_logger

                get_logger(__name__).warning(
                    textwrap.dedent(
                        f"""s
                    ════════════════════════════════════════════════
                    {self.key} IS DEPRECATED.
                    {self.deprecation_text}

                    This option will be removed on or after {self.expiration_date}.

                    Please update {self.where_defined}.
                    ════════════════════════════════════════════════
                    """
                    )
                )

    def is_expired(self) -> bool:
        """Returns true if expiration_date is in the past."""
        if not self.deprecated:
            return False

        expiration_date = _parse_yyyymmdd_str(self.expiration_date)
        now = datetime.datetime.now()
        return now > expiration_date

    @property
    def env_var(self) -> str:
        """Get the name of the environment variable that can be used to set the option."""
        name = self.key.replace(".", "_")
        return f"STREAMLIT_{to_snake_case(name).upper()}"


def _parse_yyyymmdd_str(date_str: str) -> datetime.datetime:
    year, month, day = (int(token) for token in date_str.split("-", 2))
    return datetime.datetime(year, month, day)
