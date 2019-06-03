# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import sys
import threading
import time

from blinker import Signal

from streamlit import config
from streamlit import magic
from streamlit.watcher.LocalSourcesWatcher import LocalSourcesWatcher

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


class State(object):
    INITIAL = 'INITIAL'
    STARTING_THREAD = 'STARTING_THREAD'
    RUNNING = 'RUNNING'
    STOP_REQUESTED = 'STOP_REQUESTED'
    RERUN_REQUESTED = 'RERUN_REQUESTED'
    PAUSE_REQUESTED = 'PAUSE_REQUESTED'
    PAUSED = 'PAUSED'
    STOPPED = 'STOPPED'


class ScriptRunner(object):

    def __init__(self, report):
        """Initialize.

        Parameters
        ----------
        report : Report
            The report with the script to run.

        """
        self._report = report
        self._state = None

        self._main_thread_id = threading.current_thread().ident
        self._state_change_requested = False

        self.run_on_save = config.get_option('server.runOnSave')

        self.on_state_changed = Signal(
            doc="""Emitted when the script's execution state state changes.

            Parameters
            ----------
            state : State
            """)

        self.on_file_change_not_handled = Signal(
            doc="Emitted when the file is modified and we haven't handled it.")

        self.on_script_compile_error = Signal(
            doc="""Emitted if our script fails to compile.  (*Not* emitted
            for normal exceptions thrown while a script is running.)

            Parameters
            ----------
            exception : Exception
                The exception that was thrown
            """)

        self._set_state(State.INITIAL)

        self._local_sources_watcher = LocalSourcesWatcher(
            self._report, self.maybe_handle_file_changed)

    def _set_state(self, new_state):
        if self._state == new_state:
            return

        LOGGER.debug('ScriptRunner state: %s -> %s' % (self._state, new_state))
        self._state = new_state
        self.on_state_changed.send(self._state)

    def is_running(self):
        return self._state == State.RUNNING

    def is_fully_stopped(self):
        return self._state in (State.INITIAL, State.STOPPED)

    def request_rerun(self):
        """Signal that we're interested in running the script immediately.
        If the script is not already running, it will be started immediately.
        Otherwise, a rerun will be requested.
        """
        if self._state == State.STARTING_THREAD:
            # we're already starting up
            return
        elif self.is_fully_stopped():
            LOGGER.debug('Spawning script thread...')
            self._set_state(State.STARTING_THREAD)

            script_thread = threading.Thread(
                target=self._run,
                name='Streamlit script runner thread')

            script_thread.start()
        else:
            self._set_state(State.RERUN_REQUESTED)
            self._state_change_requested = True

    def request_stop(self):
        if self.is_fully_stopped():
            pass
        else:
            self._set_state(State.STOP_REQUESTED)
            self._state_change_requested = True

    def request_pause_unpause(self):
        if self._state == State.PAUSED:
            self._set_state(State.RUNNING)
        else:
            self._request_pause()

    def _install_tracer(self):
        """Install function that runs before each line of the script."""

        def trace_calls(frame, event, arg):
            self.maybe_handle_execution_control_request()
            return trace_calls

        # Python interpreters are not required to implement sys.settrace.
        if hasattr(sys, 'settrace'):
            sys.settrace(trace_calls)

    def _run(self):
        # This method should only be called from the script thread.
        _script_thread_id = threading.current_thread().ident
        assert _script_thread_id != self._main_thread_id

        cur_state = self._state
        if cur_state != State.STARTING_THREAD:
            # TODO: Fix self._state-related race conditions
            raise RuntimeError('Bad state (expected=%s, saw=%s)' % (State.STARTING_THREAD, cur_state))

        # Reset delta generator so it starts from index 0.
        import streamlit as st
        st._reset()

        self._state_change_requested = False
        self._set_state(State.RUNNING)

        # Compile the script. Any errors thrown here will be surfaced
        # to the user via a modal dialog, and won't result in their
        # previous report disappearing.
        try:
            # Python 3 got rid of the native execfile() command, so we now read
            # the file, compile it, and exec() it. This implementation is
            # compatible with both 2 and 3.
            with open(self._report.script_path) as f:
                filebody = f.read()

            if config.get_option('runner.magicEnabled'):
                filebody = magic.add_magic(filebody, self._report.script_path)

            code = compile(
                filebody,
                # Pass in the file path so it can show up in exceptions.
                self._report.script_path,
                # We're compiling entire blocks of Python, so we need "exec"
                # mode (as opposed to "eval" or "single").
                'exec',
                # Don't inherit any flags or "future" statements.
                flags=0,
                dont_inherit=1,
                # Parameter not supported in Python2:
                # optimize=-1,
            )

        except BaseException as e:
            # We got a compile error. Send the exception onto the client
            # as a SessionEvent and bail immediately.
            LOGGER.debug('Fatal script error: %s' % e)
            self.on_script_compile_error.send(e)
            self._set_state(State.STOPPED)
            return

        # If we get here, we've successfully compiled our script. The next step
        # is to run it. Errors thrown during execution will be shown to the
        # user as ExceptionElements.

        if config.get_option('runner.installTracer'):
            self._install_tracer()

        rerun_requested = False

        try:
            # Create fake module. This gives us a name global namespace to
            # execute the code in.
            module = _new_module('__main__')

            # Install the fake module as the __main__ module. This allows
            # the pickle module to work inside the user's code, since it now
            # can know the module where the pickled objects stem from.
            # IMPORTANT: This means we can't use "if __name__ == '__main__'" in
            # our code, as it will point to the wrong module!!!
            sys.modules['__main__'] = module

            # Make it look like command-line args were set to whatever the user
            # asked them to be via the GUI.
            # IMPORTANT: This means we can't count on sys.argv in our code ---
            # but we already knew it from the argv surgery in cli.py.
            # TODO: Remove this feature when we implement interativity! This is
            # not robust in a multi-user environment.
            sys.argv = self._report.argv

            # Add special variables to the module's dict.
            module.__dict__['__file__'] = self._report.script_path

            with modified_sys_path(self._report):
                exec(code, module.__dict__)

        except RerunException:
            rerun_requested = True

        except StopException:
            pass

        except BaseException as e:
            # Show exceptions in the Streamlit report.
            st.exception(e)  # This is OK because we're in the script thread.
            # TODO: Clean up the stack trace, so it doesn't include
            # ScriptRunner.

        finally:
            self._set_state(State.STOPPED)

        self._local_sources_watcher.update_watched_modules()
        _clean_problem_modules()

        if rerun_requested:
            self._run()

    def _pause(self):
        self._set_state(State.PAUSED)

        while self._state == State.PAUSED:
            time.sleep(0.1)

    def _request_pause(self):
        if self.is_fully_stopped():
            pass
        else:
            self._set_state(State.PAUSE_REQUESTED)
            self._state_change_requested = True

    # This method gets called from inside the script's execution context.
    def maybe_handle_execution_control_request(self):
        if self._state_change_requested:
            LOGGER.debug('Received execution control request: %s', self._state)

            if self._state == State.STOP_REQUESTED:
                raise StopException()
            elif self._state == State.RERUN_REQUESTED:
                raise RerunException()
            elif self._state == State.PAUSE_REQUESTED:
                self._pause()
                return

    def maybe_handle_file_changed(self):
        if self.run_on_save:
            self.request_rerun()
        else:
            self.on_file_change_not_handled.send()


class ScriptControlException(BaseException):
    """Base exception for ScriptRunner."""
    pass


class StopException(ScriptControlException):
    """Silently stop the execution of the user's script."""
    pass


class RerunException(ScriptControlException):
    """Silently stop and rerun the user's script."""
    pass


def _clean_problem_modules():
    if 'keras' in sys.modules:
        try:
            keras = sys.modules['keras']
            keras.backend.clear_session()
        except:
            pass


def _new_module(name):
    """Create a new module with the given name."""

    if sys.version_info >= (3, 4):
        import types
        return types.ModuleType(name)

    import imp
    return imp.new_module(name)


# Code modified from IPython (BSD license)
# Source: https://github.com/ipython/ipython/blob/master/IPython/utils/syspathcontext.py#L42
class modified_sys_path(object):
    """A context for prepending a directory to sys.path for a second."""

    def __init__(self, report):
        self._report = report
        self._added_path = False

    def __enter__(self):
        if self._report.script_path not in sys.path:
            sys.path.insert(0, self._report.script_path)
            self._added_path = True

    def __exit__(self, type, value, traceback):
        if self._added_path:
            try:
                sys.path.remove(self._report.script_path)
            except ValueError:
                pass

        # Returning False causes any exceptions to be re-raised.
        return False
