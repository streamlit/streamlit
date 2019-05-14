# Copyright 2019 Streamlit Inc. All rights reserved.

"""Utility functions to use in our tests."""

from streamlit import config

def build_mock_config_get_option(overrides_dict):
    orig_get_option = config.get_option

    def mock_config_get_option(name):
        if name in overrides_dict:
            return overrides_dict[name]
        return orig_get_option(name)

    return mock_config_get_option


def build_mock_config_is_manually_set(overrides_dict):
    orig_is_manually_set = config.is_manually_set

    def mock_config_is_manually_set(name):
        if name in overrides_dict:
            return overrides_dict[name]
        return orig_is_manually_set(name)

    return mock_config_is_manually_set
