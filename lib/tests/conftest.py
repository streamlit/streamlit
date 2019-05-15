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

from streamlit import config


os.environ['HOME'] = '/mock/home/folder'

CONFIG_FILE_CONTENTS = '''
[global]
sharingMode = "off"
unitTest = true

[browser]
gatherUsageStats = false
'''

config._parse_config_file(CONFIG_FILE_CONTENTS)
