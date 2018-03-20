"""Loads the configuration data."""

import collections
import copy
import os
import sys
import yaml

# Default configuration for developemnt builds.
__DEVELOPMENT_DEFAULTS = {
    'proxy.useNode': True,
}

# Default configuration for deployed builds.
__DEPLOYED_DEFAULTS = {
    'proxy.useNode': False,
}

# Global object that memoizes the configuration data.
__global_config = None

def _flatten(nested_dict, flat_dict, prefix=[]):
    """Flattens the dictionary in nested_dict into a flattened dict in flat_dict
    so that, for example:

        {'a': {'b': 123}}

    becomes:

        {'a.b': 123}
    """
    for k, v in nested_dict.items():
        subprefix = prefix + [k]
        if isinstance(v, collections.Mapping):
            _flatten(v, flat_dict, subprefix)
        else:
            flat_dict['.'.join(subprefix)] = v

def _load_config(default_config):
    """
    Loads the config file at the given path. The dafalts are specified as a
    list of dot-separated configuration options as follows:
        {'proxy.useNode': False}
    """
    config = copy.deepcopy(default_config)
    config_file_name = \
        os.path.join(config['local.root'], config['local.config'])
    with open(config_file_name) as config_file:
        yaml_config = yaml.load(config_file)
        _flatten(yaml_config, config)
    return config

def get_option(option):
    """
    Returns a configuration setting, e.g. get_config('local.throttleSecs').
    We first assume a deployment build and look for the config file there.
    If it's not found, we assume a development build and look for that config
    file.
    """
    global __global_config
    if not __global_config:
        try:
            # First we assume that this is a deployed version and we look in
            # sys.prefix for config.yaml.
            __global_config = _load_config({
                'local.root': sys.prefix,
                'local.config': 'streamlit/config/config.yaml',
                'proxy.useNode': False,
                'proxy.staticRoot': 'streamlit/proxy_static/',
            })
        except FileNotFoundError:
            # If that didn't work, then use the development path.
            __global_config = _load_config({
                'local.root': '/'.join(__file__.split('/')[:-5]),
                'local.config': 'config.yaml',
                'proxy.useNode': True,
                'proxy.staticRoot': 'local/client/build/',
            })
    return __global_config[option]

def get_path(option):
    """
    Returns the path given by the config option relative to local.root.
    """
    return os.path.join(get_option('local.root'), get_option(option))
