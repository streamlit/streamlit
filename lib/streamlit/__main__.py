"""This is a script which is run when the streamlit package is executed."""
import sys
import textwrap

import click

import streamlit
import streamlit.caching
import streamlit.logger
import streamlit.reference

def print_usage():
    """Prints a help message."""
    usage = """
        Usage:

        python -m streamlit <command>

        where command is one of:

        clear_cache - Clear the memoization cache.
        help        - Show help in browser.
        usage       - Print this help message.
        version     - Print the version number.
    """
    print(textwrap.dedent(usage).strip())

def clear_cache():
    streamlit.caching.clear_cache(True)

def help():
    print('Showing help page in browser..')
    streamlit.reference.display_reference()

def version():
    print('Streamlit v' + streamlit.__version__)


COMMANDS = {
    'usage': print_usage,
    'clear_cache': clear_cache,
    'help': help,
    'version': version
}

@click.command()
@click.pass_context
@click.argument('mode', default='usage', type=click.Choice(list(COMMANDS.keys())))
@click.option('--log_level', show_default=True, type=click.Choice([
    'error', 'warning', 'info', 'debug']))
def main(ctx, mode, log_level):  # pragma: no cover
    """Run main function."""
    if log_level:
        streamlit.logger.set_log_level(log_level)

    if mode == 'usage':
        click.echo(ctx.get_help())
    COMMANDS[mode]()


if __name__ == '__main__':
    main()
