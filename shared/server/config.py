"""Loads the configuration data."""

import yaml

__CONFIG_PATH = 'config.yaml'
__GLOBAL_CONFIG = None

def get_config(path=''):
    """
    Returns a configuration object. You can drill down into the object
    by specifying a path as arguments. So, for example:

    get_config('local.throttleSecs')

    is equivalent to:

    get_config()['local']['throttleSecs']
    """
    global __GLOBAL_CONFIG
    if __GLOBAL_CONFIG:
        print('Using cached config file.')
    if not __GLOBAL_CONFIG:
        print('Loading config file.')
        with open(__CONFIG_PATH) as config_file:
            __GLOBAL_CONFIG = yaml.load(config_file)
    config = __GLOBAL_CONFIG
    for key in path.split('.'):
        if key:
            config = config[key]
    return config
