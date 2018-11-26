# -*- coding: future_fstrings -*-

"""This is a script which is run when the Streamlit package is executed."""

# Python 2/3 compatibility
from __future__ import print_function, division, absolute_import
# Not importing unicode_literals from __future__ because click doesn't like it.
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())


import click


def print_usage(args):
    """Print this help message."""
    print("\nWhere [MODE] is one of:")
    for command, handler in COMMAND_HANDLERS.items():
        print(f'  {command:<13} - {handler.__doc__}')


def clear_cache(args):
    """Clear the Streamlit cache."""
    import streamlit.caching
    streamlit.caching.clear_cache(True)


def help(args):
    """Show help in browser."""
    print('Showing help page in browser...')
    import streamlit.reference
    streamlit.reference.display_reference()


def run(args):
    """Run a Python script, piping stderr to Streamlit."""
    import streamlit.proxy.process_runner as process_runner
    import sys

    assert len(args) > 0, 'You must specify a file to run'

    source_file_path = args[0]
    cmd = [sys.executable] + list(args)
    process_runner.run_assuming_outside_proxy_process(
        cmd=cmd,
        source_file_path=source_file_path)


def kill_proxy(*args):
    """Kill the Streamlit proxy."""
    import psutil
    import getpass

    found_proxy = False

    for p in psutil.process_iter(attrs=['name', 'username']):
        if ('python' in p.name()
                and 'streamlit.proxy' in p.cmdline()
                and getpass.getuser() == p.info['username']):
            print('Killing proxy with PID %d' % p.pid)
            p.kill()
            found_proxy = True
    if not found_proxy:
        print('No Streamlit proxies found.')


def version(*args):
    """Print the version number."""
    import streamlit
    print('Streamlit v' + streamlit.__version__)


def show_config(*args):
    """Show all of Streamlit's config settings."""
    from streamlit import config
    config.show_config()


COMMAND_HANDLERS = dict(
    clear_cache = clear_cache,
    help = help,
    kill_proxy = kill_proxy,
    run = run,
    show_config = show_config,
    usage = print_usage,
    version = version,
)


COMMANDS = list(COMMAND_HANDLERS.keys())


LOG_LEVELS = ['error', 'warning', 'info', 'debug']


@click.command()
@click.pass_context
@click.argument('mode', default='usage', type=click.Choice(COMMANDS))
@click.argument('args', type=str, nargs=-1)
@click.option('--log_level', show_default=True, type=click.Choice(LOG_LEVELS))
def main(ctx, mode, args, log_level):  # pragma: no cover  # noqa: D401
    """Main app entrypoint."""
    if log_level:
        import streamlit.logger
        streamlit.logger.set_log_level(log_level)

    if mode == 'usage':
        click.echo(ctx.get_help())

    COMMAND_HANDLERS[mode](args)


if __name__ == '__main__':
    main()
