"""streamlit.credentials module.

Copyright 2019 Streamlit Inc. All rights reserved.
"""
import os


class Credentials(object):
    """Credentials class."""
    _singleton = None

    @classmethod
    def get_current(cls):
        """Return the singleton instance."""
        if cls._singleton is None:
            Credentials()

        return Credentials._singleton

    def __init__(self):
        """Initialize class."""
        if Credentials._singleton is not None:
            raise RuntimeError(
                'Credentials already initialized. Use .get_current() instead')

        self.activation = None
        self._conf_file = os.path.join(os.path.expanduser('~'), '.streamlit',
                                       'credentials.toml')

        Credentials._singleton = self
