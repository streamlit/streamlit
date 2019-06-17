# Copyright 2018 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

"""Loads the configuration data."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import os
import sys
import platform
import toml
import urllib
import collections

import click
from blinker import Signal

from streamlit import development
from streamlit import util
from streamlit.ConfigOption import ConfigOption

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


# Config System Global State #

# Descriptions of each of the possible config sections.
# (We use OrderedDict to make the order in which sections are declared in this
# file be the same order as the sections appear with `streamlit config show`)
_section_descriptions = collections.OrderedDict(
    _test='Special test section just used for unit tests.',
)

# Stores the config options as key value pairs in a flat dict.
_config_options = dict()

# Makes sure we only parse the config file once.
config_file_has_been_parsed = False

# Allow outside modules to wait for the config file to be parsed before doing
# something.
_on_config_parsed = Signal(doc='Emitted when the config file is parsed.')


def set_option(key, value):
    """Set config option.

    Note that some config parameters depend on others, so changing one parameter
    may affect others in unexpected ways.

    Parameters
    ----------
    key : str
        The config option key of the form "section.optionName". To see all
        available options, run `streamlit config show` on a terminal.

    value
        The new value to assign to this config option.

    """
    _set_option(key, value, _USER_DEFINED)


def get_option(key):
    """Return the current value of a given Streamlit config option.

    Parameters
    ----------
    key : str
        The config option key of the form "section.optionName". To see all
        available options, run `streamlit config show` on a terminal.

    """
    # Don't worry, this call cached and only runs once:
    parse_config_file()

    if key not in _config_options:
        raise RuntimeError('Config key "%s" not defined.' % key)
    return _config_options[key].value


def _create_section(section, description):
    """Create a config section and store it globally in this module."""
    assert section not in _section_descriptions, (
        'Cannot define section "%s" twice.' % section)
    _section_descriptions[section] = description


def _create_option(
        key, description=None, default_val=None, visibility='visible',
        deprecated=False, deprecation_text=None, expiration_date=None,
        replaced_by=None):
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
        visibility=visibility, deprecated=deprecated,
        deprecation_text=deprecation_text, expiration_date=expiration_date,
        replaced_by=replaced_by)
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


PROXY_DEPRECATION_TEXT = '''This configuration option does not do anything
anymore, since Streamlit no longer has a proxy. Please remove it from your
config file.'''
PROXY_DEPRECATION_EXPIRATION = '2019-06-30'


# Config Section: Global #

_create_section('global', 'Global options that apply across all of Streamlit.')


_create_option(
    'global.sharingMode',
    description='''
        Configure the ability to share reports to the cloud.

        Should be set to one of these values:
        - "off" : turn off sharing.
        - "streamlit-public" : share to Streamlit's public cloud. Shared reports
           will be viewable by anyone with the URL.
        - "s3" : share to S3, based on the settings under the [s3] section of
          this config file.
        ''',
    default_val='streamlit-public')


_create_option(
    'global.showWarningOnDirectExecution',
    description='''
        If True, will show a warning when you run a Streamlit-enabled script
        via "python my_script.py".
        ''',
    default_val=True)


@_create_option('global.developmentMode', visibility='hidden')
def _global_development_mode():
    """Are we in development mode.

    This option defaults to True if and only if Streamlit wasn't installed
    normally.
    """
    return (
        not util.is_pex()
        and 'site-packages' not in __file__
        and 'dist-packages' not in __file__
    )


@_create_option('global.logLevel')
def _global_log_level():
    """Level of logging: 'error', 'warning', 'info', or 'debug'.

    Default: 'info'
    """
    if get_option('global.developmentMode'):
        return 'debug'
    else:
        return 'info'


@_create_option('global.unitTest', visibility='hidden')
def _global_unit_test():
    """Are we in a unit test?

    This option defaults to False.
    """
    return False

_create_option(
    'global.useNode',
    description='''Whether to serve static content from node. Only applies when
        developmentMode is True.''',
    visibility='hidden',
    default_val=True)


# Config Section: Client #

_create_section('client', 'Settings for scripts that use Streamlit.')

_create_option(
    'client.caching',
    description='Whether to enable st.cache.',
    default_val=True)

_create_option(
    'client.displayEnabled',
    description='''If false, makes your Streamlit script not draw to a
        Streamlit report.''',
    default_val=True)

_create_option(
    'client.waitForProxySecs',
    description='How long to wait for the proxy server to start up.',
    default_val=3.0,
    deprecated=True,
    deprecation_text=PROXY_DEPRECATION_TEXT,
    expiration_date=PROXY_DEPRECATION_EXPIRATION)

_create_option(
    'client.throttleSecs',
    description='How long to wait between draining the client queue.',
    default_val=0.01,
    deprecated=True,
    deprecation_text=PROXY_DEPRECATION_TEXT,
    expiration_date=PROXY_DEPRECATION_EXPIRATION)

_create_option(
    'client.tryToOutliveProxy',
    description='''
        If true, waits for the proxy to close before exiting the client script.
        And if the proxy takes too long (10s), just exits the script.

        This is useful when running a Streamlit script in a container, to allow
        the proxy to shut itself down cleanly.
        ''',
    default_val=False,
    deprecated=True,
    deprecation_text=PROXY_DEPRECATION_TEXT,
    expiration_date=PROXY_DEPRECATION_EXPIRATION)

_create_option(
    'client.proxyAddress',
    description='''
        Internet address of the proxy server that the client should connect
        to. Can be IP address or DNS name.''',
    default_val='localhost',
    deprecated=True,
    deprecation_text=PROXY_DEPRECATION_TEXT,
    expiration_date=PROXY_DEPRECATION_EXPIRATION)


@_create_option(
    'client.proxyPort',
    deprecated=True,
    deprecation_text=PROXY_DEPRECATION_TEXT,
    expiration_date=PROXY_DEPRECATION_EXPIRATION)
def _client_proxy_port():
    """Port that the client should use to connect to the proxy.

    Default: whatever value is set in proxy.port.
    """
    return get_option('proxy.port')


# Config Section: Proxy #

_create_section('proxy', 'Configuration of the proxy server.')

_create_option(
    'proxy.autoCloseDelaySecs',
    description='''
        How long the proxy should stay open when there are no connections.

        Can be set to inf for "infinity".

        Note: this delay only starts counting after the reportExpirationSecs
        delay transpires.
        ''',
    default_val=0,
    deprecated=True,
    deprecation_text=PROXY_DEPRECATION_TEXT,
    expiration_date=PROXY_DEPRECATION_EXPIRATION)

_create_option(
    'proxy.reportExpirationSecs',
    description=(
        'How long reports should be stored in memory for when the '
        'script is done and there are no viewers. '
        'For best results make sure this is >= 3.'),
    default_val=60,
    deprecated=True,
    deprecation_text=PROXY_DEPRECATION_TEXT,
    expiration_date=PROXY_DEPRECATION_EXPIRATION)

_create_option(
    'proxy.isRemote',
    description='''Is the proxy running remotely.

        Default: false unless we are on a Linux box where DISPLAY is unset.
        ''',
    replaced_by='server.headless',
    expiration_date=PROXY_DEPRECATION_EXPIRATION)

_create_option(
    'proxy.liveSave',
    description='''
        Immediately share the report in such a way that enables live
        monitoring, and post-run analysis.

        Default: whatever value is set in server.liveSave.
        ''',
    replaced_by='server.liveSave',
    expiration_date=PROXY_DEPRECATION_EXPIRATION)

_create_option(
    'proxy.runOnSave',
    description='''
        Watch for filesystem changes and rerun reports.

        Default: whatever value is set in server.runOnSave.
        ''',
    replaced_by='server.runOnSave',
    expiration_date=PROXY_DEPRECATION_EXPIRATION)

_create_option(
    'proxy.watchFileSystem',
    description='Watch for filesystem changes and rerun reports.',
    replaced_by='server.runOnSave',
    expiration_date=PROXY_DEPRECATION_EXPIRATION)

_create_option(
    'proxy.enableCORS',
    description='''
        Enables support for Cross-Origin Request Sharing, for added security.

        Default: whatever value is set in server.enableCORS.
        ''',
    replaced_by='server.enableCORS',
    expiration_date=PROXY_DEPRECATION_EXPIRATION)

_create_option(
    'proxy.port',
    description='''
        The port where the proxy will listen for client and browser
        connections.

        Default: whatever value is set in server.port.
        ''',
    replaced_by='server.port',
    expiration_date=PROXY_DEPRECATION_EXPIRATION)


# Config Section: Runner #

_create_section('runner', 'Settings for how Streamlit executes your script')

_create_option(
    'runner.magicEnabled',
    description='''
        Allows you to type a variable or string by itself in a single line of
        Python code to write it to the report.
        ''',
    default_val=False)

_create_option(
    'runner.installTracer',
    description='''
        Install a Python tracer to allow you to stop or pause your script at
        any point and introspect it. As a side-effect, this slows down your
        script's execution.
        ''',
    default_val=False)


# Config Section: Server #

_create_section('server', 'Settings for the Streamlit server')


@_create_option('server.headless')
@util.memoize
def _server_headless():
    """If false, will attempt to open a browser window on start.

    Default: false unless (1) we are on a Linux box where DISPLAY is unset, or
    (2) server.liveSave is set.
    """
    if is_manually_set('proxy.isRemote'):
        return get_option('proxy.isRemote')

    is_live_save_on = get_option('proxy.liveSave')
    is_linux = (platform.system() == 'Linux')
    has_display_env = (not os.getenv('DISPLAY'))
    is_running_in_editor_plugin = (
        os.getenv('IS_RUNNING_IN_STREAMLIT_EDITOR_PLUGIN') is not None)
    return (
        is_live_save_on or
        (is_linux and has_display_env) or
        is_running_in_editor_plugin
    )


@_create_option('server.liveSave')
def _server_live_save():
    """Immediately share the report in such a way that enables live
    monitoring, and post-run analysis.

    Default: false
    """
    if is_manually_set('proxy.liveSave'):
        return get_option('proxy.liveSave')
    return False


@_create_option('server.runOnSave')
def _server_run_on_save():
    """Automatically rerun script when the file is modified on disk.

    Default: false
    """
    if is_manually_set('proxy.runOnSave'):
        return get_option('proxy.runOnSave')
    if is_manually_set('proxy.watchFileSystem'):
        return get_option('proxy.watchFileSystem')
    return False


@_create_option('server.port')
def _server_port():
    """The port where the server will listen for client and browser
    connections.

    Default: 8501
    """
    if is_manually_set('proxy.port'):
        return get_option('proxy.port')
    return 8501


@_create_option('server.enableCORS')
def _server_enable_cors():
    """Enables support for Cross-Origin Request Sharing, for added security.

    Default: true
    """
    if is_manually_set('proxy.enableCORS'):
        return get_option('proxy.enableCORS')
    return True


# Config Section: Browser #

_create_section('browser', 'Configuration of browser front-end.')

_create_option(
    'browser.remotelyTrackUsage',
    description='''
        Whether to send usage statistics to Streamlit.

        Default: whatever is set in browser.gatherUsageStats.
        ''',
    replaced_by='browser.gatherUsageStats',
    expiration_date='2019-06-28')

_create_option(
    'browser.proxyAddress',
    description='''
        Internet address of the proxy server that the browser should connect
        to. Can be IP address or DNS name.

        Default: whatever value is set in browser.serverAddress.
        ''',
    replaced_by='browser.serverAddress',
    expiration_date=PROXY_DEPRECATION_EXPIRATION)


@_create_option('browser.serverAddress')
def _browser_server_address():
    """Internet address of the server server that the browser should connect
    to. Can be IP address or DNS name.

    Default: 'localhost'
    """
    if is_manually_set('browser.proxyAddress'):
        return get_option('browser.proxyAddress')
    return 'localhost'


@_create_option('browser.gatherUsageStats')
def _gather_usage_stats():
    """Whether to send usage statistics to Streamlit.

    Default: true
    """
    if is_manually_set('browser.remotelyTrackUsage'):
        return get_option('browser.remotelyTrackUsage')
    return True


_create_option(
    'browser.proxyPort',
    description='''
        Port that the browser should use to connect to the server.

        Default: whatever value is set in browser.serverPort.
    ''',
    deprecation_text='Use browser.serverPort instead.',
    replaced_by='browser.serverPort',
    expiration_date=PROXY_DEPRECATION_EXPIRATION)


@_create_option('browser.serverPort')
@util.memoize
def _browser_server_port():
    """Port that the browser should use to connect to the server.

    Default: whatever value is set in server.port.
    """
    if is_manually_set('browser.proxyPort'):
        return get_option('browser.proxyPort')
    return get_option('server.port')


# Config Section: S3 #

_create_section(
    's3', 'Configuration for when global.sharingMode is set to "s3".')


@_create_option('s3.bucket')
def _s3_bucket():
    """Name of the AWS S3 bucket to save reports.

    Default: (unset)
    """
    if get_option('global.sharingMode') == 'streamlit-public':
        creds = _get_public_credentials()
        return creds['bucket'] if creds else None
    return None


@_create_option('s3.url')
def _s3_url():
    """URL root for external view of Streamlit reports.

    Default: (unset)
    """
    if get_option('global.sharingMode') == 'streamlit-public':
        creds = _get_public_credentials()
        return creds['url'] if creds else None
    return None


@_create_option('s3.accessKeyId', visibility='obfuscated')
def _s3_access_key_id():
    """Access key to write to the S3 bucket.

    Leave unset if you want to use an AWS profile.

    Default: (unset)
    """
    if get_option('global.sharingMode') == 'streamlit-public':
        creds = _get_public_credentials()
        return creds['accessKeyId'] if creds else None
    return None


@_create_option('s3.secretAccessKey', visibility='obfuscated')
def _s3_secret_access_key():
    """Secret access key to write to the S3 bucket.

    Leave unset if you want to use an AWS profile.

    Default: (unset)
    """
    if get_option('global.sharingMode') == 'streamlit-public':
        creds = _get_public_credentials()
        return creds['secretAccessKey'] if creds else None
    return None


_create_option(
    's3.requireLoginToView',
    description='''Make the shared report visible only to users who have been
        granted view permission. If you are interested in this option, contact
        us at support@streamlit.io.
        ''',
    default_val=False)

_create_option(
    's3.keyPrefix',
    description='''The "subdirectory" within the S3 bucket where to save
        reports.

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
    description='''AWS credentials profile to use.

        Leave unset to use your default profile.

        Default: (unset)
        ''',
    default_val=None)  # If changing the default, change S3Storage.py too.


# TODO: Don't memoize! Otherwise, if the internet is down momentarily when this
# function is first called then we'll have no credentials forever while the
# proxy is up.
@util.memoize
def _get_public_credentials():
    STREAMLIT_CREDENTIALS_URL = 'https://streamlit.io/tmp/st_pub_write.json'
    LOGGER.debug('Getting remote Streamlit credentials.')
    try:
        response = urllib.request.urlopen(
            STREAMLIT_CREDENTIALS_URL, timeout=0.5).read()
        import ast
        return ast.literal_eval(response.decode('utf-8'))
    except Exception as e:
        LOGGER.warning(
            'Error getting Streamlit credentials. Sharing will be '
            'disabled. %s', e)
        return None


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


def _is_unset(option_name):
    """Check if a given option has not been set by the user.

    Parameters
    ----------
    option_name : str
        The option to check


    Returns
    -------
    bool
        True if the option has not been set by the user.

    """
    return get_where_defined(option_name) == ConfigOption.DEFAULT_DEFINITION


def is_manually_set(option_name):
    """Check if a given option was actually defined by the user.

    Parameters
    ----------
    option_name : str
        The option to check


    Returns
    -------
    bool
        True if the option has been set by the user.

    """
    return get_where_defined(option_name) != ConfigOption.DEFAULT_DEFINITION


def show_config():
    """Show all the config options."""
    SKIP_SECTIONS = ('_test',)

    out = []
    out.append(_clean('''
        Below are all the sections and options you can have in
        ~/.streamlit/config.toml. The values shown below are the current values
        that are set for your system.
    '''))

    def append_desc(text):
        out.append(click.style(text, bold=True))

    def append_comment(text):
        out.append(click.style(text))

    def append_section(text):
        out.append(click.style(text, bold=True, fg='green'))

    def append_setting(text):
        out.append(click.style(text, fg='green'))

    def append_newline():
        out.append('')

    for section, section_description in _section_descriptions.items():
        if section in SKIP_SECTIONS:
            continue

        append_newline()
        append_section('[%s]' % section)
        append_newline()

        for key, option in _config_options.items():
            if option.section != section:
                continue

            if option.visibility == 'hidden':
                continue

            if option.is_expired():
                continue

            key = option.key.split('.')[1]
            description_paragraphs = _clean_paragraphs(option.description)

            for i, txt in enumerate(description_paragraphs):
                if i == 0:
                    append_desc('# %s' % txt)
                else:
                    append_comment('# %s' % txt)

            toml_default = toml.dumps({'default': option.default_val})
            toml_default = toml_default[10:].strip()

            if len(toml_default) > 0:
                append_comment('# Default: %s' % toml_default)
            else:
                # Don't say "Default: (unset)" here because this branch applies
                # to complex config settings too.
                pass

            if option.deprecated:
                append_comment('#')
                append_comment('# ' + click.style('DEPRECATED.', fg='yellow'))
                append_comment(
                    '# %s' %
                    '\n'.join(_clean_paragraphs(option.deprecation_text)))
                append_comment(
                    '# This option will be removed on or after %s.'
                    % option.expiration_date)
                append_comment('#')

            option_is_manually_set = (
                option.where_defined != ConfigOption.DEFAULT_DEFINITION)

            if option_is_manually_set:
                append_comment(
                    '# The value below was set in %s' % option.where_defined)

            toml_setting = toml.dumps({key: option.value})

            if (len(toml_setting) == 0 or
                    option.visibility == 'obfuscated'):
                toml_setting = '#%s =\n' % key

            elif option.visibility == 'obfuscated':
                toml_setting = '%s = (value hidden)\n' % key

            append_setting(toml_setting)

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
            _set_option(
                '%(section)s.%(name)s' % {'section': section, 'name': name},
                value, where_defined)


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
    if (isinstance(value, string_types) and
            value.startswith('env:')):  # noqa F821
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


def parse_config_file(file_contents=None):
    """Parse the config file and update config parameters.

    Parameters
    ----------
    file_contents : string or None
        The contents of the config file (for use in tests) or None to load the
        config from ~/.streamlit/config.toml.
    """
    global config_file_has_been_parsed

    if config_file_has_been_parsed:
        return

    if file_contents:
        config_filename = 'mock_config_file'
    else:
        config_filename = util.get_streamlit_file_path('config.toml')

        # Parse the config file.
        if not os.path.exists(config_filename):
            return

        with open(config_filename) as input:
            file_contents = input.read()

    _update_config_with_toml(file_contents, config_filename)

    config_file_has_been_parsed = True
    _on_config_parsed.send()


def _clean_paragraphs(txt):
    paragraphs = txt.split('\n\n')
    cleaned_paragraphs = [_clean(x) for x in paragraphs]
    return cleaned_paragraphs


def _clean(txt):
    """Replace all whitespace with a single space."""
    return ' '.join(txt.split()).strip()


def _check_conflicts():
    # Node-related conflicts

    # When using the Node server, we must always connect to 8501 (this is
    # hard-coded in JS). Otherwise, the browser would decide what port to
    # connect to based on either:
    #   1. window.location.port, which in dev is going to be (3000)
    #   2. the proxyPort value in manifest.json, which would work, but only
    #   exists with proxy.liveSave.

    if get_option('global.developmentMode'):
        assert (
            _is_unset('server.port') and
            _is_unset('proxy.port')), (
            'server.port does not work when global.developmentMode is true.')

        assert (
            _is_unset('browser.serverPort') and
            _is_unset('browser.proxyPort')), (
            'browser.serverPort does not work when global.developmentMode is '
            'true.')

    # Sharing-related conflicts

    if get_option('global.sharingMode') == 's3':
        assert is_manually_set('s3.bucket'), (
            'When global.sharingMode is set to "s3", '
            's3.bucket must also be set')
        both_are_set = (
            is_manually_set('s3.accessKeyId') and
            is_manually_set('s3.secretAccessKey'))
        both_are_unset = (
            _is_unset('s3.accessKeyId') and
            _is_unset('s3.secretAccessKey'))
        assert both_are_set or both_are_unset, (
            'In config.toml, s3.accessKeyId and s3.secretAccessKey must '
            'either both be set or both be unset.')

    if get_option('global.sharingMode') == 'streamlit-public':
        WARNING_STR = (
            'In config.toml, S3 should not be configured when '
            'global.sharingMode is set to "streamlit-public".')
        assert _is_unset('s3.bucket'), WARNING_STR
        assert _is_unset('s3.url'), WARNING_STR
        assert _is_unset('s3.accessKeyId'), WARNING_STR
        assert _is_unset('s3.secretAccessKey'), WARNING_STR
        assert _is_unset('s3.keyPrefix'), WARNING_STR
        assert _is_unset('s3.region'), WARNING_STR
        assert _is_unset('s3.profile'), WARNING_STR


def _set_development_mode():
    development.is_development_mode = get_option('global.developmentMode')


def on_config_parsed(func):
    """Wait for the config file to be parsed then call func.

    If the config file has already been parsed, just calls fun immediately.

    """
    if config_file_has_been_parsed:
        func()
    else:
        _on_config_parsed.connect(lambda _: func())


# Run _check_conflicts only once the config file is parsed in order to avoid
# loops.
on_config_parsed(_check_conflicts)
on_config_parsed(_set_development_mode)
