"""Loads the configuration data."""

# Package Imports
import ast
import json
import os
import socket
import yaml

from tornado import gen, httpclient
from tornado.concurrent import run_on_executor, futures

import streamlit
from streamlit.logger import get_logger

LOGGER = get_logger()

class Config(object):

    executor = futures.ThreadPoolExecutor(5)

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
                    _comment = 'How long to wait for the proxy server to start up.',
                    value = 3.0,
                ),
            ),
            proxy = dict(
                _comment = 'Configuration of the proxy server',
                port = dict(
                    value = 8501,
                ),
                server = dict(
                    value = 'localhost',
                ),
                waitForConnectionSecs = dict(
                    _comment = 'How many seconds the proxy waits for the connection before timing out.',
                    value = 10.1,
                ),
                useNode = dict(
                    _comment = 'Whether to use the node server or not.',
                    value = False,
                ),
                isRemote = dict(
                    _comment = 'Is the proxy running remotely.',
                    value = False,
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
                        'Whether Streamlit should remotely record usage stats'),
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
        foo = yaml.dump(self._raw_config, default_flow_style=False)
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
        LOGGER.warning('DEPRECATION: Please update ~/.streamlit/config.yaml by renaming "%s" to "%s".' \
            % (old_option, new_option))
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


def get_default_creds():
    # TODO(armando): Should we always fetch this or should we write
    # credentials to disk and then if the user deletes it, refetch?
    http_client = None
    try:
        http_client = httpclient.HTTPClient()
        endpoint = 'http://streamlit.io/tmp/st_pub_write.json'
        response = http_client.fetch(endpoint, request_timeout=5)
        # Strip unicode
        creds = ast.literal_eval(response.body.decode('utf-8'))
        # LOGGER.debug(response.body)

        c = Config._config._config
        if c['storage'].get('s3') is None:
            c['storage']['s3'] = {}

        # Replace whatever is in the config with the default credentials
        c['storage']['s3'].update(creds)

    except (httpclient.HTTPError, RuntimeError, socket.gaierror) as e:
        LOGGER.debug('Not using default credentials.  Error getting default credentials from %s: %s', endpoint, e)
    finally:
        if http_client is not None:
            http_client.close()
