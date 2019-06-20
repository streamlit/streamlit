# Copyright 2018 Streamlit Inc. All rights reserved.

"""This is a script which is run when the Streamlit package is executed."""

# Python 2/3 compatibility
from __future__ import print_function, division, absolute_import
# Not importing unicode_literals from __future__ because click doesn't like it.
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import click

from streamlit.credentials import Credentials
from streamlit import config


LOG_LEVELS = ['error', 'warning', 'info', 'debug']


@click.group()
@click.option('--log_level', show_default=True, type=click.Choice(LOG_LEVELS))
@click.version_option(prog_name='Streamlit')
@click.pass_context
def main(ctx, log_level='info'):
    """Try out a demo with:

        $ streamlit hello

    Or use the line below to run your own script:

        $ streamlit run your_script.py
    """

    if log_level:
        import streamlit.logger
        streamlit.logger.set_log_level(log_level.upper())


@main.command('help')
@click.pass_context
def help(ctx):
    """Print this help message."""
    # Pretend user typed 'streamlit --help' instead of 'streamlit help'.
    import sys
    assert len(sys.argv) == 2  # This is always true, but let's assert anyway.
    sys.argv[1] = '--help'
    main()


@main.command('version')
@click.pass_context
def main_version(ctx):
    """Print Streamlit's version number."""
    # Pretend user typed 'streamlit --version' instead of 'streamlit version'
    import sys
    assert len(sys.argv) == 2  # This is always true, but let's assert anyway.
    sys.argv[1] = '--version'
    main()


@main.command('docs')
def main_docs():
    """Show help in browser."""
    print('Showing help page in browser...')
    from streamlit import util
    util.open_browser('https://streamlit.io/secret/docs')


@main.command('hello')
def main_hello():
    """Runs the Hello World script."""
    print('Showing Hello World script in browser...')
    import streamlit.hello

    filename = streamlit.hello.__file__

    # For Python 2 when Streamlit is actually installed (make install rather
    # than make develop).
    if filename.endswith('.pyc'):
        filename = '%s.py' % filename[:-4]

    _main_run(filename)


@main.command('run')
@click.argument('file', type=click.Path(exists=True))
@click.argument('args', nargs=-1)
def main_run(file, args):
    """Run a Python script, piping stderr to Streamlit."""
    _main_run(file, args)

def _main_run(file, args=[]):
    Credentials.get_current().check_activated(auto_resolve=True)
    import streamlit.bootstrap as bootstrap
    import sys

    # We don't use args ourselves. We just allow people to pass them so their
    # script can handle them via sys.argv or whatever.
    # IMPORTANT: This means we should treat argv carefully inside our code!
    sys.argv = [file] + list(args)

    bootstrap.run(file)


# DEPRECATED

# TODO: Remove after 2019-09-01
@main.command('clear_cache', deprecated=True, hidden=True)
@click.pass_context
def main_clear_cache(ctx):
    """Deprecated."""
    click.echo(click.style('Use "cache clear" instead.', fg='red'))
    ctx.invoke(cache_clear)


# TODO: Remove after 2019-09-01
@main.command('show_config', deprecated=True, hidden=True)
@click.pass_context
def main_show_config(ctx):
    """Deprecated."""
    click.echo(click.style('Use "config show" instead.', fg='red'))
    ctx.invoke(config_show)


# SUBCOMMAND: cache

@main.group('cache')
def cache():
    """Manage the Streamlit cache."""
    pass


@cache.command('clear')
def cache_clear():
    """Clear the Streamlit on-disk cache."""
    import streamlit.caching
    result = streamlit.caching.clear_cache()
    cache_path = streamlit.caching.get_cache_path()
    if result:
        print('Cleared directory %s.' % cache_path)
    else:
        print('Nothing to clear at %s.' % cache_path)


# SUBCOMMAND: config

@main.group('config')
def config():
    """Manage Streamlit's config settings."""
    pass


@config.command('show')
def config_show():
    """Show all of Streamlit's config settings."""
    from streamlit import config
    config.show_config()


# SUBCOMMAND: activate

@main.group('activate', invoke_without_command=True)
@click.pass_context
def activate(ctx):
    """Activate Streamlit by entering your email."""
    if not ctx.invoked_subcommand:
        Credentials.get_current().activate()


@activate.command('reset')
def activate_reset():
    """Reset Activation Credentials."""
    Credentials.get_current().reset()


if __name__ == '__main__':
    main()
