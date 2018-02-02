"""Loads the configuration data."""

import yaml

__GLOBAL_CONFIG = {}

def get_config(build_type):
    """
    Returns a configuration object for the build type which is one of:

    development - For local development builds.
    production  - <not implemented>
    """
    def to_obj(x):
        """Converts a dict to an object."""
        obj = Object()
        for key, value in x.items():
            setattr(obj, key, to_obj(value))

    assert build_type in ['development'], 'Build type not understood.'
    if not __GLOBAL_CONFIG:
        with open('config.yaml') as config_file:
            for build_type_key, build_config in yaml.load(config_file).items():
                __GLOBAL_CONFIG[build_type_key] = to_obj(build_config)
    return __GLOBAL_CONFIG[build_type]
