"""Runs all the scripts in the examples folder (except this one)."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, \
    absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import os
import sys
import streamlit as st
from streamlit import compatibility

# This is how we get user input
if not compatibility.is_running_py3():
    input = raw_input  # noqa: F821

# True means we run through all tests automatically.
auto_run = False

# Where we expect to find the example files.
EXAMPLE_DIR = 'examples'

# These are all the files we excliude
EXCLUDED_FILENAMES = (
    # Exclude mnist becuase it takes so long to run.
    'mnist-cnn.py',

    # Exclude caching because we special case it.
    'caching.py',
)


def run_commands(section_header, commands, skip_last_input=False,
                 comment=None):
    """Run a list of commands, displaying them within the given section."""
    global auto_run, status

    st.header(section_header)
    if comment:
        st.write(comment)
    for i, command in enumerate(commands):
        # Display the status.
        vars = {
            'section_header': section_header,
            'total': len(commands),
            'command': command,
            'v': i + 1,
        }
        status.warning(
            'Running %(section_header)s %(v)s/%(total)s : %(command)s' % vars)
        st.subheader('%(v)s/%(total)s : %(command)s' % vars)
        print('Running `%s`...' % command)

        # Run the command.
        exit_code = os.system(command)
        if exit_code == 0:
            st.success('Exit Code: 0')
        else:
            st.error('Exit Code: %s' % exit_code)

        #
        last_command = (i + 1 == len(commands))
        if not (auto_run or (last_command and skip_last_input)):
            sys.stdout.write(
                'Press [enter] to continue or [a] to continue on auto:\n> ')
            status.info('Waiting for input.')
            response = input()
            if response == 'a':
                print('Turning on auto run.')
                auto_run = True


def main():
    global status

    st.title('Running All Examples')

    st.header('Status')

    status = st.warning('Initializing...')

    # First run the 'streamlit commands'
    run_commands('Basic Commands', [
        'streamlit version',
    ])

    run_commands(
        'Standard System Errors',
        ['streamlit run does_not_exist.py'],
        comment='Checks to see that file not found error is caught')

    run_commands(
        'Hello script',
        ['streamlit hello'],
    )

    run_commands('Examples', [
        'streamlit run %(EXAMPLE_DIR)s/%(filename)s' % {
            'EXAMPLE_DIR': EXAMPLE_DIR,
            'filename': filename,
        } for filename in os.listdir(EXAMPLE_DIR)
        if filename.endswith('.py') and filename not in EXCLUDED_FILENAMES
    ])

    run_commands(
        'Caching',
        ['streamlit cache clear',
         'streamlit run %s/caching.py' % EXAMPLE_DIR])

    run_commands(
        'MNIST', ['streamlit run %s/mnist-cnn.py' % EXAMPLE_DIR],
        skip_last_input=True)

    status.success('Completed all tests!')
    st.balloons()


if __name__ == '__main__':
    main()
