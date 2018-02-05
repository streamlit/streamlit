"""Loads the configuration data."""

import yaml

__CONFIG_PATH = 'config.yaml'
__GLOBAL_CONFIG = None

def get_config():
    """
    Returns a configuration object for the build type which is one of:

    development - For local development builds.
    production  - <not implemented>
    """
    global __GLOBAL_CONFIG
    if __GLOBAL_CONFIG:
        print('Using cached config file.')
    if not __GLOBAL_CONFIG:
        print('Loading config file.')
        with open(__CONFIG_PATH) as config_file:
            __GLOBAL_CONFIG = yaml.load(config_file)
    return __GLOBAL_CONFIG
