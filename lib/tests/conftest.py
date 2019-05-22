"""Pytest fixtures.

Everything in this file applies to all tests.  This basically makes the
tests not READ from your local home directory but instead this mock
config.
"""
__copyright__ = 'Copyright 2019 Streamlit Inc. All rights reserved.'
import os

from contextlib import contextmanager
from mock import patch, mock_open


@contextmanager
def set_fake_home():
    """Set fake home.
    So that we guarantee we dont read our own home directory while testing.
    """
    os.environ['HOME'] = '/mock/home/folder'
    yield

CONFIG_FILE_CONTENTS = '''
[global]
sharingMode = "off"
unitTest = true

[browser]
gatherUsageStats = false
'''

with set_fake_home(), patch(
        'streamlit.config.os.path.exists', side_effect=[True]) as p, patch(
            'streamlit.config.open',
            mock_open(read_data=CONFIG_FILE_CONTENTS)) as mock_file:

    from streamlit import config

    config._parse_config_file()
