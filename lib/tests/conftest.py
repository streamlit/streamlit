"""Pytest fixtures.

Everything in this file applies to all tests.  This basically makes the
tests not READ from your local home directory but instead this mock
config.
"""
import copy
import textwrap
import os

from contextlib import contextmanager
from mock import patch, mock_open


@contextmanager
def set_fake_home():
    """Set fake home.

    So that we guarantee we dont read our own home directory while testing.
    """
    os.environ['HOME'] = '/does/not/exist'
    yield


DEFAULT_CONFIG = textwrap.dedent('''
    [global]
    sharingMode = "off"

    [browser]
    remotelyTrackUsage = false
''')

with set_fake_home(), patch(
        'streamlit.config.os.path.exists',
        side_effect=[False, True]) as p, patch(
            "streamlit.config.open",
            mock_open(read_data=DEFAULT_CONFIG)) as mock_file:

    from streamlit import config

    config._parse_config_file()

SECTION_DESCRIPTIONS = copy.deepcopy(config._section_descriptions)
CONFIG_OPTIONS = copy.deepcopy(config._config_options)
