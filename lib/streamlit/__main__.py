"""This is a script which is run when the streamlit package is executed."""
import getpass
import sys
import textwrap

import click
import psutil

import streamlit
import streamlit.caching
import streamlit.logger
import streamlit.reference

def print_usage():
    """Prints a help message."""
    usage = """
        Where [MODE] is one of:
          clear_cache - Clear the memoization cache.
          help        - Show help in browser.
          kill_proxy  - Kill proxy.
          usage       - Print this help message.
          version     - Print the version number.
    """
    print("\n" + textwrap.dedent(usage).strip())

def clear_cache():
    streamlit.caching.clear_cache(True)

def help():
    print('Showing help page in browser...')
    streamlit.reference.display_reference()

def kill_proxy():
    found_proxy = False
    for p in psutil.process_iter(attrs=['name', 'username']):
        if 'python' in p.name() \
            and 'streamlit.proxy' in p.cmdline() \
            and getpass.getuser() == p.info['username']:
            print('Killing proxy with PID %d' % p.pid)
            p.kill()
            found_proxy = True
    if not found_proxy:
        print('No Streamlit proxies found.')

def version():
    print('Streamlit v' + streamlit.__version__)


COMMANDS = {
    'usage': print_usage,
    'clear_cache': clear_cache,
    'help': help,
    'kill_proxy': kill_proxy,
    'version': version
}

@click.command()
@click.pass_context
@click.argument('mode', default='usage', type=click.Choice(list(COMMANDS.keys())))
@click.option('--log_level', show_default=True, type=click.Choice([
    'error', 'warning', 'info', 'debug']))
def main(ctx, mode, log_level):  # pragma: no cover
    """Streamlit helper commands to see help (streamlit help) and to manage the
    cache and proxy."""
    if log_level:
        streamlit.logger.set_log_level(log_level)

    if mode == 'usage':
        click.echo(ctx.get_help())
    COMMANDS[mode]()


if __name__ == '__main__':
    main()
