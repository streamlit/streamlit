# Copyright 2018 Streamlit Inc. All rights reserved.

"""Loads the configuration data."""

# Package Imports
import ast
import json
import os
import platform
import socket
import yaml
import urllib

# Streamlit imports
from streamlit.ConfigOption import ConfigOption
from streamlit import util

from streamlit.logger import get_logger
LOGGER = get_logger()

### Config System Global State ###

# Descriptions of each of the possible config sections.
_config_sections = dict(
    _test = 'Special test section just used for unit tests.',
)

# Stores the config options as key value pairs in a flat dict.
_config_options = dict()

def _create_section(section, description):
    """Create a config section and store it globally in this module."""
    assert section not in _config_sections, (
        'Cannot define section "%s" twice.' % section)
    _config_sections[section] = description

def _create_option(key, description=None, default_val=None):
    """Create a ConfigOption and stores it globally in this module.

    Exactly follows ConfigOption arguments.
    """
    option = ConfigOption(key, description=description, default_val=default_val)
    assert option.section in _config_sections, (
        'Section "%s" must be one of %s.' %
        (option.section, ', '.join(_config_sections.keys())))
    assert key not in _config_options, (
        'Cannot define option "%s" twice.' % key)
    _config_options[key] = option
    return option



### Config Section: Global ###

_create_section('global', 'Global options that apply across all of Streamlit.')

@_create_option('global.developmentMode')
def _global_development_mode():
    """Are we in development mode? (Only for developers of Streamlit.)

    This option defaults to True if and only if Streamlit wasn't installed
    normally.
    """
    return ('site-packages' not in __file__)

@_create_option('global.logLevel')
def _global_log_level():
    """What level of logging, 'error', 'warning', 'info', or 'debug'?

    By default, this is 'debug' in development mode, and 'info' otherwise.
    """
    if get_option('global.developmentMode'):
        return 'debug'
    else:
        return 'info'



### Config Section: Local ###

_create_section('local', 'Settings for users to connect to Streamlit.')

_create_option('local.waitForProxySecs',
    description = 'How long to wait for the proxy server to start up.',
    default_val = 3.0)

_create_option('local.throttleSecs',
    description = 'How long to wait between draining the local queue.',
    default_val= 0.01)



### Config Section: Proxy ###

_create_section('proxy', 'Configuration of the proxy server.')

_create_option('proxy.server',
    description = 'Internet address of the proxy server.',
    default_val = 'localhost')

_create_option('proxy.port',
    description = 'Port for the proxy server.',
    default_val = 8501)

_create_option('proxy.autoCloseDelaySecs',
    description = (
        'How long the proxy should stay open when there are '
        'no connections. Can be set to .inf for "infinity". '
        'This delay only starts counting after the '
        'reportExpirationSecs delay transpires.'),
    default_val = 0)

# TODO: In new config system, allow us to specify ranges
# for numeric values, so anything outside that range is
# considered invalid.
_create_option('proxy.reportExpirationSecs',
    description = (
        'How long reports should be stored in memory for when '
        'script is done and there are no viewers. '
        'For best results make sure this is >= 3.'),
    default_val = 10.1)

@_create_option('proxy.useNode')
def _proxy_use_node():
    """Whether to use the node server. (Only for developers of Streamlit.)"""
    return get_option('global.developmentMode')

@_create_option('proxy.isRemote')
@util.memoize
def _proxy_is_remote():
    """Is the proxy running remotely.

    By default, this option is False unless we are on a headless Linux box.
    """
    is_linux = platform.system() == 'Linux'
    is_headless = not os.getenv('DISPLAY')
    return is_linux and is_headless

_create_option('proxy.saveOnExit',
    description = """
        Should we save this report to S3 after the script copletes.

        DEPRECATION WARNING: I think we should get rid of this, and fold a
        single option that makes sense for the Flotilla use case.
        """,
    default_val = False)

_create_option('proxy.watchFileSystem',
    description = 'Watch for filesystem changes and rerun reports.',
    default_val = True)


### Public Interface ###

def get_option(key):
    if key not in _config_options:
        # return old_get_option(key) # REMOVE THIS
        raise RuntimeError, 'Config key "%s" not defined.' % key
    return _config_options[key].value

def old_get_option(opt):
    c = Config().Get()
    config = dict()
    _flatten(c, config)
    return config.get('%s' % opt, None)

class Config(object):

    _config = None

    @classmethod
    def Get(cls):
        if not cls._config:
            c = Config()

            c._make_streamlit_dir()

            if os.path.isfile(c._configfile):
                config = c._load_yaml()
                if config is not None:
                    _update(c._config, config)
            else:
                c.dumps()

            cls._config = c

            # if bucket is not set then use default credentials.
            if (c._config['storage']['s3']['bucket'] is None and
                c._config['storage'].get('useDefault') is not False):
                get_default_creds()

        return cls._config._config

    def _load_yaml(self):
        with open(self._configfile) as f:
            return yaml.load(f.read())

    def _make_streamlit_dir(self):
        homedir = os.getenv('HOME', None)
        if not homedir:
            raise Exception('no home dir')

        try:
            os.mkdir(os.path.join(homedir, '.streamlit'))
        except OSError:
            pass
        self._configfile = os.path.join(homedir, '.streamlit', 'config.yaml')

    def __init__(self):
        self._development = ('site-packages' not in __file__)
        self._raw_config = dict(
            development = dict(
                _comment = 'Enable development configuration',
                value = self._development,
            ),
            log_level = dict(
                _comment = 'error, warning, info, debug',
                value = 'warning',
            ),
            proxy = dict(

                useNode = dict(
                    _comment = 'Whether to use the node server or not.',
                    value = False,
                ),
                externalIP = dict(
                    _comment = ('IP address of the machine where Streamlit is '
                        'running.'),
                    # Must be None, so the autodetection in Proxy.py takes
                    # place
                    value = None,
                ),
            ),
            s3 = dict(
                _comment = 'S3 Configuration',
                bucketname = dict(
                    value = None,
                ),
                region = dict(
                    _comment = 'ie. us-west-2',
                    value = None,
                ),
                url = dict(
                    value = None,
                ),
                key_prefix = dict(
                    value = None,
                ),
            ),
            storage = dict(
                _comment = 'Remote Storage options',
                s3 = dict(
                    bucket = dict(
                        value = None,
                    ),
                ),
            ),
            client = dict(
                remotelyTrackUsage = dict(
                    _comment = (
                        'Whether Streamlit should remotely record usage '
                        'stats.'),
                    value = True,
                ),
            ),
        )
        self._config = yaml.load(self._dump())

    def _enable_development(self):
        self._raw_config['proxy']['useNode'] = True
        self._raw_config['log_level']['value'] = 'debug'

    def _dump(self):
        if self._development:
            self._enable_development()

        out = []

        foo = yaml.dump(self._raw_config, default_flow_style=False,
                width=float('inf'))

        for line in foo.split('\n'):
            if '_comment:' in line:
                prev_line = out.pop(-1)
                line = line.replace('  _comment:', '#')
                out.append('\n' + line)
                out.append(prev_line)
            elif 'value:' in line:
                prev_line = out.pop(-1)
                line = line.replace('value:', '').strip()
                line = ' '.join([prev_line, line])
                out.append(line)
            else:
                out.append(line)

        return '\n'.join(out).lstrip()

    def dumps(self):
        # Skipping writing self._configfile
        return
        # with open(self._configfile, 'w') as f:
        #     f.write(self._dump())
        #     LOGGER.info('Wrote out configuration file to "%s"', self._configfile)

def _update(first_dict, second_dict):
    """Updates the first dict to contain information from the second dict. This
    function is recursive on nested dicts."""
    for key in second_dict.keys():
        if key not in first_dict:
            first_dict[key] = second_dict[key]
        else:
            try:
                _update(first_dict[key], second_dict[key])
            except AttributeError:
                first_dict[key] = second_dict[key]

def _flatten(nested_dict, flat_dict, prefix=[]):
    for k, v in nested_dict.items():
        subprefix = prefix + [k]
        if isinstance(v, dict):
            _flatten(v, flat_dict, subprefix)
        else:
            flat_dict['.'.join(subprefix)] = v

def get_s3_option(option):
    """This function gets an s3 option and returns it. It supports both new
    and old ways of getting these options. Options can be one of:
      - profile
      - bucket
      - keyPrefix
      - url
    """
    # Maps s3 options to the new and old option name displaying
    # a deprecation warning if the old option name is used.
    s3_option_table = dict(
        # name      # new location         # old location
        profile   = ('storage.s3.profile'  , None           ),
        bucket    = ('storage.s3.bucket'   , 's3.bucketname'),
        keyPrefix = ('storage.s3.keyPrefix', 's3.key_prefix'),
        url       = ('storage.s3.url'      , 's3.url'       ),
        region    = ('storage.s3.region'   , 's3.region'    ),

        accessKeyId = ('storage.s3.accessKeyId', None),
        secretAccessKey = ('storage.s3.secretAccessKey', None),
    )
    try:
        new_option, old_option = s3_option_table[option]
        LOGGER.debug('Getting option "%s" which maps to "%s" or "%s".' \
            % (option, new_option, old_option))
    except KeyError:
        raise RuntimeError('S3 Option "%s" not recognized.' % option)
    if get_option(new_option) is not None:
        return get_option(new_option)
    elif old_option is None:
        return None
    elif get_option(old_option) is None:
        return None
    else:
        LOGGER.warning(
            'DEPRECATION: Please update ~/.streamlit/config.yaml by '
            'renaming "%s" to "%s".' % (old_option, new_option))
        return get_option(old_option)

def saving_is_configured():
    """Returns true if S3 (and eventually GCS?) saving is configured properly
    for this session."""
    return (get_s3_option('bucket') is not None)


def remotely_track_usage():
    """Returns true if we should log user events remotely for our own stats"""
    val = get_option('client.remotelyTrackUsage')
    LOGGER.debug('remotelyTrackUsage: %s' % val)

    if type(val) is bool:
        return val

    return True  # default to True. See also /frontend/src/remotelogging.js


STREAMLIT_CREDENTIALS_URL = 'http://streamlit.io/tmp/st_pub_write.json'

def get_default_creds():
    # TODO(armando): Should we always fetch this or should we write
    # credentials to disk and then if the user deletes it, refetch?
    http_client = None
    try:
        response = urllib.request.urlopen(
            STREAMLIT_CREDENTIALS_URL, timeout=0.5).read()

        # Strip unicode
        creds = ast.literal_eval(response.decode('utf-8'))
        # LOGGER.debug(response.body)

        c = Config._config._config
        if c['storage'].get('s3') is None:
            c['storage']['s3'] = {}

        # Replace whatever is in the config with the default credentials
        c['storage']['s3'].update(creds)

    # Catch all types of exceptions here, since we want Streamlit to fail
    # gracefully: an error in loading the credentials shouldn't stop the user
    # from using Streamlit.
    except Exception as e:
        LOGGER.info(
            'Error getting Streamlit credentials. Sharing will be '
            'disabled. %s', e)
    finally:
        if http_client is not None:
            http_client.close()
