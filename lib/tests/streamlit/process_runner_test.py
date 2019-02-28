import sys
import unittest

from mock import patch

from streamlit.process_runner import run_python_module


class ProcessRunnerTest(unittest.TestCase):
    """Test streamlit.process_runner."""

    def test_run_python_module(self):
        """Test streamlit.process_runner.run_python_module."""

        with patch('streamlit.process_runner.subprocess.Popen') as m:

            run_python_module('streamlit.proxy')
            call_args = m.call_args[0][0]
            args = call_args[1:]
            executable = call_args[0].split('/')[-1]
            self.assertTrue(executable.startswith('python'))
            self.assertEqual(
                args,
                ['-m', 'streamlit.proxy'],
            )

    def test_run_python_module_as_pex(self):
        """Test streamlit.process_runner.run_python_module as pex file."""

        with patch('streamlit.process_runner.subprocess.Popen') as m:
            # Manually add streamlit.pex to the begginning of the path
            # to simulate pex.
            sys.path.insert(0, '/path/to/streamlit.pex')

            run_python_module('streamlit.proxy')

            call_args = m.call_args[0][0]
            args = call_args[1:]
            executable = call_args[0].split('/')[-1]
            self.assertTrue(executable.endswith('.pex'))
            self.assertEqual(
                args,
                ['-m', 'streamlit.proxy'],
            )
