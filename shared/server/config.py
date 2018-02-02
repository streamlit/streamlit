"""Loads the configuration data."""

import yaml

__CONFIG_PATH = 'config.yaml'
__GLOBAL_CONFIG = {}

def get_config(build_type):
    """
    Returns a configuration object for the build type which is one of:

    development - For local development builds.
    production  - <not implemented>
    """
    assert build_type in ['development'], 'Build type not understood.'
    if not __GLOBAL_CONFIG:
        with open(__CONFIG_PATH) as config_file:
            __GLOBAL_CONFIG.update(yaml.load(config_file))
    return __GLOBAL_CONFIG[build_type]
