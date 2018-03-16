"""Loads the local config file."""

import yaml
import bson

__LOCAL_CONFIG_PATH = '.streamlit.yaml'
__LOCAL_CONFIG = {}

def get_config():
    """Gets the local config file."""
    if not __LOCAL_CONFIG:
        reload_config()
    return __LOCAL_CONFIG

def append_to_config(key, value, comment=None):
    if key in __LOCAL_CONFIG:
        raise RuntimeError("Cannot append a key that's already in config.")
    try:
        with open(__LOCAL_CONFIG_PATH) as config_stream:
            config_data = config_stream.read()
    except FileNotFoundError:
        config_data = ''

    # Make sure that all nonempty documents end with two newlines.
    config_data = config_data.strip()
    if config_data == '':
        pass
    else:
        config_data = config_data + '\n\n'

    # Format the comment.
    if comment:
        comment = f'# {comment}\n'
    else:
        comment = ''

    # Update the config yaml string and write it out.
    config_data = f'{config_data}{comment}{key}: {value}\n'
    with open(__LOCAL_CONFIG_PATH, 'w') as config_stream:
        config_stream.write(config_data)
        config_stream.flush()

    # Reload the configuration.
    reload_config()

def reload_config():
    """Reloads the config file."""
    config = __LOCAL_CONFIG
    config.clear()
    try:
        with open(__LOCAL_CONFIG_PATH) as config_stream:
            config.update(yaml.load(config_stream))

            # Add types where necessary.
            if 'localId' in config:
                config['localId'] = bson.ObjectId(config['localId'])
    except FileNotFoundError:
        pass
    return __LOCAL_CONFIG

def get_local_id():
    if 'localId' not in get_config():
        append_to_config('localId', bson.ObjectId().binary.hex(),
            'Auto-generated local ID.')
    return __LOCAL_CONFIG['localId']
