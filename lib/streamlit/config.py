# -*- coding: future_fstrings -*-

# Copyright 2018 Streamlit Inc. All rights reserved.

"""Loads the configuration data."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import ast
import os
import sys
import platform
import toml
import urllib
import collections

from streamlit.ConfigOption import ConfigOption
from streamlit import util
from streamlit import development

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


# Config System Global State #

# Descriptions of each of the possible config sections.
# (We use OrderedDict to make the order in which sections are declared in this
# file be the same order as the sections appear with `streamlit show_config`)
_section_descriptions = collections.OrderedDict(
    _test='Special test section just used for unit tests.',
)

# Stores the config options as key value pairs in a flat dict.
_config_options = dict()


def _create_section(section, description):
    """Create a config section and store it globally in this module."""
    assert section not in _section_descriptions, (
        'Cannot define section "%s" twice.' % section)
    _section_descriptions[section] = description


def _create_option(
        key, description=None, default_val=None, visibility='visible'):
    '''Create a ConfigOption and store it globally in this module.

    There are two ways to create a ConfigOption:

        (1) Simple, constant config options are created as follows:

            _create_option('section.optionName',
                description = 'Put the description here.',
                default_val = 12345)

        (2) More complex, programmable config options use decorator syntax to
        resolve thier values at runtime:

            @_create_option('section.optionName')
            def _section_option_name():
                """Put the description here."""
                return 12345

    To achieve this sugar, _create_option() returns a *callable object* of type
    ConfigObject, which then decorates the function.

    NOTE: ConfigObjects call their evaluation functions *every time* the option
    is requested. To prevent this, use the `streamlit.util.memoize` decorator as
    follows:

            @_create_option('section.memoizedOptionName')
            @util.memoize
            def _section_memoized_option_name():
                """Put the description here."""

                (This function is only called once.)
                """
                return 12345

    '''
    option = ConfigOption(
        key, description=description, default_val=default_val,
        visibility=visibility)
    assert option.section in _section_descriptions, (
        'Section "%s" must be one of %s.' %
        (option.section, ', '.join(_section_descriptions.keys())))
    assert key not in _config_options, (
        'Cannot define option "%s" twice.' % key)
    _config_options[key] = option
    return option


def _delete_option(key):
    """Remove option ConfigOption by key from global store.

    For use in testing.
    """
    try:
        del _config_options[key]
    except Exception:
        pass


# Config Section: Global #

_create_section('global', 'Global options that apply across all of Streamlit.')


@_create_option('global.developmentMode', visibility='hidden')
def _global_development_mode():
    """Are we in development mode.

    This option defaults to True if and only if Streamlit wasn't installed
    normally.
    """
    return ('site-packages' not in __file__ and
            'dist-packages' not in __file__)


@_create_option('global.logLevel')
def _global_log_level():
    """Level of logging: 'error', 'warning', 'info', or 'debug'.

    Default: 'info'
    """
    if get_option('global.developmentMode'):
        return 'debug'
    else:
        return 'info'


# Config Section: Client #

_create_section('client', 'Settings for users to connect to Streamlit.')

_create_option(
    'client.caching',
    description='Whether to enable caching to ./.streamlit/cache.',
    default_val=True)

_create_option(
    'client.displayEnabled',
    description='''If false, makes your Streamlit script not sent data to a
        Streamlit report.''',
    default_val=True)

_create_option(
    'client.waitForProxySecs',
    description='How long to wait for the proxy server to start up.',
    default_val=3.0)

_create_option(
    'client.throttleSecs',
    description='How long to wait between draining the client queue.',
    default_val=0.01)

_create_option(
    'client.tryToOutliveProxy',
    description='''
        If true, waits for the proxy to close before exiting the client script.
        And if the proxy takes too long (10s), just exits the script. This is
        useful when running a Streamlit script in a container, to allow the
        proxy to shut itself down cleanly.
        ''',
    default_val=False)

_create_option(
    'client.proxyAddress',
    description='''
        Internet address of the proxy server that the client should connect
        to. Can be IP address or DNS name.''',
    default_val='localhost')


@_create_option('client.proxyPort')
def _client_proxy_port():
    """Port that the client should use to connect to the proxy.

    Default: whatever value is set in proxy.port.
    """
    return get_option('proxy.port')


# Config Section: Proxy #

_create_section('proxy', 'Configuration of the proxy server.')

_create_option(
    'proxy.autoCloseDelaySecs',
    description=(
        'How long the proxy should stay open when there are '
        'no connections. Can be set to inf for "infinity". '
        'This delay only starts counting after the '
        'reportExpirationSecs delay transpires.'),
    default_val=0)

# TODO: In new config system, allow us to specify ranges
# for numeric values, so anything outside that range is
# considered invalid.
_create_option(
    'proxy.reportExpirationSecs',
    description=(
        'How long reports should be stored in memory for when '
        'script is done and there are no viewers. '
        'For best results make sure this is >= 3.'),
    default_val=10.1)


@_create_option('proxy.useNode', visibility='hidden')
def _proxy_use_node():
    """Whether to use the node server."""
    return get_option('global.developmentMode')


@_create_option('proxy.isRemote')
@util.memoize
def _proxy_is_remote():
    """Is the proxy running remotely.

    Default: false unless we are on a Linux box where DISPLAY is unset.
    """
    live_save = get_option('proxy.liveSave')
    is_linux = (platform.system() == 'Linux')
    is_headless = (not os.getenv('DISPLAY'))
    return live_save or (is_linux and is_headless)


_create_option(
    'proxy.liveSave',
    description='''
        Immediately save the report to S3 in such a way that enables live
        monitoring.
        ''',
    default_val=False)

_create_option(
    'proxy.watchFileSystem',
    description='Watch for filesystem changes and rerun reports.',
    default_val=True)

# NOTE: We should make this a computed option by bringing
# util.get_external_ip into this function.
_create_option(
    'proxy.externalIP',
    description='''
        An address for the proxy which can be accessed on the public Internet.
        ''',
    default_val=None)

_create_option(
    'proxy.enableCORS',
    description='''
        Enables support for Cross-Origin Request Sharing, for added security.
        ''',
    default_val=True)

_create_option(
    'proxy.port',
    description='''
        The port where the proxy will listen for client and browser
        connections.
        ''',
    default_val=8501)


# Config Section: Browser #

_create_section('browser', 'Configuration of browser front-end.')

_create_option(
    'browser.remotelyTrackUsage',
    description='Whether to send usage statistics to Streamlit.',
    default_val=True)

_create_option(
    'browser.proxyAddress',
    description='''
        Internet address of the proxy server that the browser should connect
        to. Can be IP address or DNS name.''',
    default_val=None)


@_create_option('browser.proxyPort')
@util.memoize
def _browser_proxy_port():
    """Port that the browser should use to connect to the proxy.

    Default: whatever value is set in proxy.port.
    """
    return get_option('proxy.port')


# Config Section: S3 #

_create_section('s3', 'Configuration for report saving.')


@_create_option('s3.sharingEnabled')
def _s3_sharing_enabled():
    """Whether Streamlit is allowed tosave reports to s3.

    Default: false. But is automatically set ot true if s3.bucket is defined,
    either by the user or using the default Streamlit credentials.
    """
    # Sharing is enabled if the user overrode 's3.bucket'.
    using_default_bucket = (
        _config_options['s3.bucket'].where_defined ==
        ConfigOption.DEFAULT_DEFINITION)
    if not using_default_bucket:
        return True

    # Sharing is also enabled if successfully parse default credentials.
    return _get_default_credentials() is not None


@_create_option('s3.bucket')
def _s3_bucket():
    """Name of the AWS S3 bucket to save reports.

    Default: if s3.sharingEnabled is set, defaults to "share.streamlit.io".
    Disabled otherwise.
    """
    if not get_option('s3.sharingEnabled'):
        return None
    return _get_default_credentials()['bucket']


@_create_option('s3.url')
def _s3_url():
    """URL root for external view of Streamlit reports.

    Default: if s3.sharingEnabled is set, uses credentials for
    share.streamlit.io. Disabled otherwise.
    """
    if not get_option('s3.sharingEnabled'):
        return None
    return _get_default_credentials()['url']


@_create_option('s3.accessKeyId', visibility='obfuscated')
def _s3_access_key_id():
    """Access key to write to the S3 bucket.

    Default: if s3.sharingEnabled is set, uses credentials for
    share.streamlit.io. Disabled otherwise.
    """
    if not get_option('s3.sharingEnabled'):
        return None
    return _get_default_credentials()['accessKeyId']


@_create_option('s3.secretAccessKey', visibility='obfuscated')
def _s3_secret_access_key():
    """Secret access key to write to the S3 bucket.

    Default: if s3.sharingEnabled is set, uses credentials for
    share.streamlit.io. Disabled otherwise.
    """
    if not get_option('s3.sharingEnabled'):
        return None
    return _get_default_credentials()['secretAccessKey']


_create_option(
    's3.keyPrefix',
    description='''"Subdirectory" within the S3 bucket to save reports.
        S3 calls paths "keys" which is why the keyPrefix is like a
        subdirectory. Use "" to mean the root directory.
        ''',
    default_val='')

_create_option(
    's3.region',
    description='''AWS region where the bucket is located, e.g. "us-west-2".

        Default: (unset)
        ''',
    default_val=None)

_create_option(
    's3.profile',
    description='''AWS credentials profile to use for saving data.

        Default: (unset)
        ''',
    default_val=None)


@util.memoize
def _get_default_credentials():
    STREAMLIT_CREDENTIALS_URL = 'http://streamlit.io/tmp/st_pub_write.json'
    LOGGER.debug('Getting remote Streamlit credentials.')
    try:
        response = urllib.request.urlopen(
            STREAMLIT_CREDENTIALS_URL, timeout=0.5).read()
        return ast.literal_eval(response.decode('utf-8'))
    except Exception as e:
        LOGGER.warning(
            'Error getting Streamlit credentials. Sharing will be '
            'disabled. %s', e)
        return None


# Public Interface #

def set_option(key, value):
    """Set the config option.

    Note that some config parameters depend on others, so changing one parameter
    may affect others in unexpected ways.

    Parameters
    ----------
    key : str
        The config option key of the form "section.optionName"
    value
        The new value of the parameter.

    """
    _set_option(key, value, _USER_DEFINED)


def get_option(key):
    """Return the config option with the given key.

    Parameters
    ----------
    key : str
        The config option key of the form "section.optionName"

    """
    if key not in _config_options:
        raise RuntimeError('Config key "%s" not defined.' % key)
    return _config_options[key].value


def get_where_defined(key):
    """Indicate where (e.g. in which file) this option was defined.

    Parameters
    ----------
    key : str
        The config option key of the form "section.optionName"

    """
    if key not in _config_options:
        raise RuntimeError('Config key "%s" not defined.' % key)
    return _config_options[key].where_defined


def show_config():
    """Show all the config options."""
    SKIP_SECTIONS = ('_test',)

    out = []
    out.append(_clean('''
        Below are all the sections and options you can have in
        ~/.streamlit/config.toml. The values shown below are the current values
        that are set for your system.
    '''))

    for section, section_description in _section_descriptions.items():
        if section in SKIP_SECTIONS:
            continue

        out.append('')
        out.append(f'[{section}]')
        out.append('')

        for key, option in _config_options.items():
            if option.section != section:
                continue

            if option.visibility == 'hidden':
                continue

            key = option.key.split('.')[1]
            description_paragraphs = _clean_paragraphs(option.description)

            for txt in description_paragraphs:
                out.append(f'# {txt}')

            toml_default = toml.dumps({'default': option.default_val})
            toml_default = toml_default[10:].strip()

            if len(toml_default) > 0:
                out.append(f'# Default: {toml_default}')

            is_manually_set = option.where_defined != ConfigOption.DEFAULT_DEFINITION

            if is_manually_set:
                out.append(
                    f'# The value below was set in {option.where_defined}')

            if option.visibility == 'obfuscated' and not is_manually_set:
                out.append(f'{key} = (value hidden)')

            else:
                toml_setting = toml.dumps({key: option.value})

                if len(toml_setting) == 0:
                    out.append(f'#{key} =\n')

                else:
                    out.append(toml_setting)

    print('\n'.join(out))

# Load Config Files #


# Indicates that this was defined by the user.
_USER_DEFINED = '<user defined>'


def _set_option(key, value, where_defined):
    """Set a config option by key / value pair.

    Parameters
    ----------
    key : str
        The key of the option, like "global.logLevel".
    value
        The value of the option.
    where_defined : str
        Tells the config system where this was set.

    """
    assert key in _config_options, 'Key "%s" is not defined.' % key
    _config_options[key].set_value(value, where_defined)


def _update_config_with_toml(raw_toml, where_defined):
    """Update the config system by parsing this string.

    Parameters
    ----------
    raw_toml : str
        The TOML file to parse to update the config values.
    where_defined : str
        Tells the config system where this was set.

    """
    parsed_config_file = toml.loads(raw_toml)

    for section, options in parsed_config_file.items():
        for name, value in options.items():
            value = _maybe_read_env_variable(value)
            _set_option(f'{section}.{name}', value, where_defined)


def _maybe_read_env_variable(value):
    """If value is "env:foo", return value of environment variable "foo".

    If value is not in the shape above, returns the value right back.

    Parameters
    ----------
    value : any
        The value to check

    Returns
    -------
    any
        Either returns value right back, or the value of the environment
        variable.

    """
    if isinstance(value, string_types) and value.startswith('env:'):  # noqa F821
        var_name = value[len('env:'):]
        env_var = os.environ.get(var_name)

        if env_var is None:
            LOGGER.error('No environment variable called %s' % var_name)
        else:
            return _maybe_convert_to_number(env_var)

    return value


def _maybe_convert_to_number(v):
    """Convert v to int or float, or leave it as is."""
    try:
        return int(v)
    except Exception:
        pass

    try:
        return float(v)
    except Exception:
        pass

    return v


def _parse_config_file():
    """Parse the config file and update config parameters."""
    # Find the path to the config file.
    home = os.getenv('HOME', None)
    if home is None:
        raise RuntimeError('No home directory.')
    config_filename = os.path.join(home, '.streamlit', 'config.toml')

    # DEPRECATION WARNINGL: Eventually we should get rid of this code.
    old_config_file_exists = os.path.exists(
        os.path.join(home, '.streamlit', 'config.yaml'))
    this_may_be_proxy = False
    if sys.argv[0] in ('-m', '-c'):
        this_may_be_proxy = True
    elif os.path.split(sys.argv[0])[1] == 'streamlit':
        this_may_be_proxy = True
    if old_config_file_exists and not this_may_be_proxy:
        sys.stderr.write(
            'Config ~/.streamlit/config.yaml is DEPRECATED. '
            'Please remove it and use ~/.streamlit/config.toml instead. For '
            'any questions, please contact Streamlit support over Slack. <3\n')

    # Parse the config file.
    if not os.path.exists(config_filename):
        return

    with open(config_filename) as input:
        _update_config_with_toml(input.read(), config_filename)

    _check_conflicts()


def _check_conflicts():
    if (get_option('client.tryToOutliveProxy')
            and not get_option('proxy.isRemote')):
        LOGGER.warning(
            'The following combination of settings...\n'
            '  client.tryToOutliveProxy = true\n'
            '  proxy.isRemote = false\n'
            '...will cause scripts to block until the proxy is closed.')

    # When using the Node server, we must always connect to 8501 (this is
    # hard-coded in JS). Otherwise, the browser would decide what port to
    # connect to based on either:
    #   1. window.location.port, which in dev is going to be (3000)
    #   2. the proxyPort value in manifest.json, which would work, but only
    #   exists with proxy.liveSave.

    proxyPortManuallySet = (
            get_where_defined('proxy.port')
            != ConfigOption.DEFAULT_DEFINITION)

    browserPortManuallySet = (
            get_where_defined('browser.proxyPort')
            != ConfigOption.DEFAULT_DEFINITION)

    clientPortManuallySet = (
            get_where_defined('client.proxyPort')
            != ConfigOption.DEFAULT_DEFINITION)

    assert not (proxyPortManuallySet and get_option('proxy.useNode')), (
        'proxy.port does not work when proxy.useNode is true. ')

    assert not (browserPortManuallySet and get_option('proxy.useNode')), (
        'browser.proxyPort does not work when proxy.useNode is true. ')

    assert not (clientPortManuallySet and get_option('proxy.useNode')), (
        'client.proxyPort does not work when proxy.useNode is true. ')


def _clean_paragraphs(txt):
    paragraphs = txt.split('\n\n')
    cleaned_paragraphs = [_clean(x) for x in paragraphs]
    return cleaned_paragraphs


def _clean(txt):
    """Replace all whitespace with a single space."""
    return ' '.join(txt.split()).strip()


# Acually parse the config file.
_parse_config_file()
development.is_development_mode = get_option('global.developmentMode')
