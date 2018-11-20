# Copyright 2018 Streamlit Inc. All rights reserved.

"""This is a script which is run when the Streamlit package is executed."""

import click


def print_usage(args):
    """Print a help message."""
    USAGE = """
        Where [MODE] is one of:
          clear_cache - Clear the memoization cache.
          help        - Show help in browser.
          kill_proxy  - Kill proxy.
          usage       - Print this help message.
          version     - Print the version number.
    """
    import textwrap
    print("\n" + textwrap.dedent(USAGE).strip())


def clear_cache(args):
    """Clear the Streamlit cache."""
    import streamlit.caching
    streamlit.caching.clear_cache(True)


def help(args):
    """Show help."""
    print('Showing help page in browser...')
    import streamlit.reference
    streamlit.reference.display_reference()


def run(args):
    """Run a script and pipe stderr to Streamlit if error."""
    import streamlit.proxy.process_runner as process_runner
    import sys

    assert len(args) > 0, 'You must specify a file to run'

    source_file_path = args[0]
    cmd = [sys.executable] + list(args)
    process_runner.run_assuming_outside_proxy_process(
        cmd=cmd,
        source_file_path=source_file_path)


def kill_proxy(*args):
    """Kill Streamlit Proxy."""
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
    """Print Stremalit's version."""
    import streamlit
    print('Streamlit v' + streamlit.__version__)


COMMAND_HANDLERS = {
    'usage': print_usage,
    'clear_cache': clear_cache,
    'help': help,
    'run': run,
    'kill_proxy': kill_proxy,
    'version': version
}


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
