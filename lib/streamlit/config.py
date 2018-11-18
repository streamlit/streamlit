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

import re

from streamlit.logger import get_logger
LOGGER = get_logger()

# Descriptions of each of the possible config sections.
SECTION_DESCRIPTIONS = dict(
    all = 'Global options apply across all of Streamlit.',
    proxy = 'Configuration of the proxy server.',
    _test = 'Special test section just used for unit tests.',
)

class _ConfigOption(object):
    '''Stores a Streamlit configuration option.

    A configuration option, like 'proxy.port', which indicates which port to use
    when connecting to the proxy. ConfigurationOptions are stored globally
    in the sreamlit.config module.

    There are two ways to create a _ConfigOption.

    Simple _ConfigOptions are created as follows:

        _ConfigOption('proxy.port',
            description = 'Connect to the proxy at this port.',
            default_val = 8501)

    More complex config options resolve thier values at runtime as follows:

        @_ConfigOption('proxy.port')
        def _proxy_port():
            """Connect to the proxy at this port.

            Defaults to 8501.
            """
            return 8501

    This "magic" uses the __call__ function to make the class behave like a
    decorator. An important constraint on thise more complex config options
    is that they have no side effects, i.e.

        get_config('x.y') == get_config('x.y')
    '''

    # This is a special value for _ConfigOption._where_defined which indicates
    # that the option default was not overridden.
    DEFAULT_DEFINITION = '<default>'

    def __init__(self, section_dot_name, description=None, default_val=None):
        """Create a _ConfigOption with the given name.

        Parameters
        ----------
        section_dot_name : string
            Should be of the form "section.optionName"
        description : string
            Like a comment for the config option.
        default_val : anything
            The value for this config option.

        """
        # Verify that the name is copacetic.
        name_format = \
            r'(?P<section>\_?[a-z][a-z0-9]+)\.(?P<name>[a-z][a-zA-Z0-9]*)$'
        match = re.match(name_format, section_dot_name)
        assert match, (
            'Name "%s" must match section.optionName.' % section_dot_name)
        section, name = match.group('section'), match.group('name')
        assert section in _Config.SECTION_DESCRIPTIONS, (
            'Section "%s" must be one of %s.' %
            (section, ', '.join(_SECTION_DESCRIPTIONS.keys())))

        # This string is like a comment. If None, it should be set in __call__.
        self._description = description

        # Function which returns the value of this option.
        self._get_val_func = lambda: default_val

        # This indicates that (for now) we're using the default definition.
        self._where_defined = _ConfigOption.DEFAULT_DEFINITION

    def __call__(self, get_val_func):
        """This method is called when _ConfigOption is used as a decorator.

        Parameters
        ----------
        get_val_func : function
            A functieon which will be called to get the value of this parameter.
            We will use its docString as the description.

        Return
        ------
        Returns self, which makes testing easier. See config_test.py.

        """
        self._description = get_val_func.__doc__
        self._get_val_func = get_val_func
        return self

    def get_value(self):
        """Gets the value of this config option."""
        # Memoize the result in a property called _val
        if not hasattr(self, '_val'):
            self._val = self._get_val_func()
        return self._val

    def get_description(self):
        """Gets the value of this config option."""
        return self._description

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
            local = dict(
                _comment = 'Configuration for the local server',
                throttleSecs = dict(
                    value = 0.01,
                ),
                waitForProxySecs = dict(
                    _comment = (
                        'How long to wait for the proxy server to start up.'),
                    value = 3.0,
                ),
            ),
            proxy = dict(
                _comment = 'Configuration of the proxy server.',
                port = dict(
                    value = 8501,
                ),
                server = dict(
                    value = 'localhost',
                ),
                autoCloseDelaySecs = dict(
                    _comment = (
                        'How long the proxy should stay open when there are '
                        'no connections. Can be set to .inf for "infinity". '
                        'This delay only starts counting after the '
                        'reportExpirationSecs delay transpires.'),
                    value = 0,
                ),
                reportExpirationSecs = dict(
                    # TODO: In new config system, allow us to specify ranges
                    # for numeric values, so anything outside that range is
                    # considered invalid.
                    _comment = (
                        'How long reports should be stored in memory for when '
                        'script is done and there are no viewers. '
                        'For best results make sure this is >= 3.'),
                    value = 10.1,
                ),
                useNode = dict(
                    _comment = 'Whether to use the node server or not.',
                    value = False,
                ),
                isRemote = dict(
                    _comment = 'Is the proxy running remotely.',
                    value = autodetect_remote_machine(),
                ),
                externalIP = dict(
                    _comment = ('IP address of the machine where Streamlit is '
                        'running.'),
                    # Must be None, so the autodetection in Proxy.py takes
                    # place
                    value = None,
                ),
                watchFileSystem = dict(
                    _comment = (
                        'Watch for filesystem changes and rerun reports'),
                    value = True,
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

def get_option(opt):
    c = Config().Get()
    config = dict()
    _flatten(c, config)
    return config.get('%s' % opt, None)

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


def autodetect_remote_machine():
    is_linux = platform.system() == 'Linux'
    is_headless = not os.getenv('DISPLAY')
    return is_linux and is_headless
