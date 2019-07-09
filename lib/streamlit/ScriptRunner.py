# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import sys
import threading
from collections import deque
from collections import namedtuple
from contextlib import contextmanager
from enum import Enum

from blinker import Signal

from streamlit import config
from streamlit import magic
from streamlit.ReportThread import ReportThread
from streamlit.logger import get_logger
from streamlit.protobuf.BackMsg_pb2 import WidgetStates
from streamlit.watcher.LocalSourcesWatcher import LocalSourcesWatcher
from streamlit.widgets import Widgets
from streamlit.widgets import coalesce_widget_states
from streamlit.widgets import reset_widget_triggers

LOGGER = get_logger(__name__)


class ScriptState(Enum):
    RUNNING = 'RUNNING'
    STOPPED = 'STOPPED'
    IS_SHUTDOWN = 'IS_SHUTDOWN'


class ScriptEvent(Enum):
    # Stop the script, but don't shutdown the runner (data=None)
    STOP = 'STOP'
    # Rerun the script (data=RerunData)
    RERUN = 'RERUN'
    # Shut down the ScriptRunner, stopping any running script first (data=None)
    SHUTDOWN = 'SHUTDOWN'


# Data attached to RERUN events
RerunData = namedtuple('RerunData', [
    # The argv value to run the script with. If this is None,
    # the argv from the most recent run of the script will be used instead.
    'argv',

    # WidgetStates protobuf to run the script with. If this is None, the
    # widget_state from the most recent run of the script will be used instead.
    'widget_state'
])


class ScriptEventQueue(object):
    """A thread-safe queue of script-related events.

    ScriptRunner publishes to this queue, and its run thread consumes from it.
    """
    def __init__(self):
        self._cond = threading.Condition()
        # deque, instead of list, because we push to the front and
        # pop from the back
        self._queue = deque()

    def enqueue(self, event, data=None):
        """Enqueue a new event to the end of the queue.

        This event may be coalesced with an existing event if appropriate.
        For example, multiple consecutive RERUN requests will be combined
        so that there's only ever one pending RERUN request in the queue
        at a time.

        Parameters
        ----------
        event : ScriptEvent
            The type of event

        data : Any
            Data associated with the event, if any
        """
        with self._cond:
            if event == ScriptEvent.SHUTDOWN:
                # If we get a shutdown request, it goes to the front of the
                # queue to be processed immediately.
                self._queue.append((event, data))
            elif event == ScriptEvent.RERUN:
                index = _index_if(self._queue, lambda item: item[0] == event)
                if index >= 0:
                    _, old_data = self._queue[index]

                    if old_data.widget_state is None:
                        # The existing request's widget_state is None, which
                        # means it wants to rerun with whatever the most
                        # recent script execution's widget state was.
                        # We have no meaningful state to merge with, and
                        # so we simply overwrite the existing request.
                        self._queue[index] = (event, RerunData(
                            argv=data.argv,
                            widget_state=data.widget_state)
                        )
                    elif data.widget_state is None:
                        # If this request's widget_state is None, and the
                        # existing request's widget_state was not, this
                        # new request is entirely redundant and can be dropped.
                        pass
                    else:
                        # Both the existing and the new request have
                        # non-null widget_states. Merge them together.
                        coalesced_state = coalesce_widget_states(
                            old_data.widget_state, data.widget_state)
                        self._queue[index] = (event, RerunData(
                            argv=data.argv,
                            widget_state=coalesced_state)
                        )
                else:
                    self._queue.appendleft((event, data))
            else:
                self._queue.appendleft((event, data))

            # Let any consumers know that we have new data
            self._cond.notify()

    def dequeue_nowait(self):
        """Pops the front-most event from the queue and returns it.

        If the queue is empty, None will be returned instead.

        Returns
        -------
        A (ScriptEvent, Data) tuple, or (None, None) if the queue is empty.
        """
        return self.dequeue(wait=False)

    def dequeue(self, wait=True):
        """Pops the front-most event from the queue and returns it.

        If the queue is empty, this function will block until there's
        an event to be returned.

        Parameters
        ----------
        wait : bool
            If true, and the queue is empty, the function will block until
            there's an event to be returned. Otherwise, an empty queue
            will result in a return of (None, None)

        Returns
        -------
        A (ScriptEvent, Data) tuple.
        """
        with self._cond:
            while len(self._queue) == 0:
                if not wait:
                    # Early out if the queue is empty and wait=False
                    return None, None
                self._cond.wait()

            return self._queue.pop()


class ScriptRunner(object):
    def __init__(self, report):
        """Initialize.

        Parameters
        ----------
        report : Report
            The report with the script to run.

        """
        self._report = report
        self._event_queue = ScriptEventQueue()
        self._state = ScriptState.STOPPED
        self._last_run_data = RerunData(
            argv=report.argv,
            widget_state=WidgetStates())
        self._widgets = Widgets()

        self.run_on_save = config.get_option('server.runOnSave')

        self.on_state_changed = Signal(
            doc="""Emitted when the script's execution state state changes.

            Parameters
            ----------
            state : ScriptState
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

        self._local_sources_watcher = LocalSourcesWatcher(
            self._report, self._on_source_file_changed)

        # Will be set to true when we process a SHUTDOWN event
        self._shutdown_requested = False

        self._script_thread = None
        self._ctx = None

        # Set to true while we're executing. Used by
        # maybe_handle_execution_control_request.
        self._execing = False

    @property
    def widgets(self):
        """
        Returns
        -------
        Widgets
            Our widget state dictionary

        """
        return self._widgets

    def start_run_loop(self, ctx):
        """Starts the ScriptRunner's thread.

        This must be called only once.

        Parameters
        ----------
        ctx : ReportContext
            The ReportContext that owns this ScriptRunner. This will be
            attached to the ScriptRunner's runloop thread.

        """

        assert self._script_thread is None, 'Already started!'
        self._ctx = ctx

        # start our thread
        self._script_thread = ReportThread(
            ctx,
            target=self._loop,
            name='ScriptRunner.loop')
        self._script_thread.start()

    def _set_state(self, new_state):
        if self._state == new_state:
            return

        LOGGER.debug('Scriptrunner state: %s -> %s' % (self._state, new_state))
        self._state = new_state
        self.on_state_changed.send(self._state)

    def is_running(self):
        return self._state == ScriptState.RUNNING

    def is_shutdown(self):
        return self._state == ScriptState.IS_SHUTDOWN

    def request_rerun(self, argv=None, widget_state=None):
        """Signal that we're interested in running the script.

        If the script is not already running, it will be started immediately.
        Otherwise, a rerun will be requested.

        Parameters
        ----------
        argv : dict | None
            The new command line arguments to run the script with, or None
            to use the argv from the previous run of the script.
        widget_state : dict | None
            The widget state dictionary to run the script with, or None
            to use the widget state from the previous run of the script.

        """
        if self.is_shutdown():
            LOGGER.warning('Discarding RERUN event after shutdown')
            return
        self._event_queue.enqueue(ScriptEvent.RERUN,
                                  RerunData(argv, widget_state))

    def request_stop(self):
        if self.is_shutdown():
            LOGGER.warning('Discarding STOP event after shutdown')
            return
        self._event_queue.enqueue(ScriptEvent.STOP)

    def request_shutdown(self):
        if self.is_shutdown():
            LOGGER.warning('Discarding SHUTDOWN event after shutdown')
            return
        self._event_queue.enqueue(ScriptEvent.SHUTDOWN)

    def maybe_handle_execution_control_request(self):
        if self._script_thread != threading.current_thread():
            # We can only handle execution_control_request if we're on the
            # script execution thread. However, it's possible for deltas to
            # be enqueued (and, therefore, for this function to be called)
            # in separate threads, so we check for that here.
            return

        if not self._execing:
            # If the _execing flag is not set, we're not actually inside
            # an exec() call. This happens when our script exec() completes,
            # we change our state to STOPPED, and a statechange-listener
            # enqueues a new ForwardEvent
            return

        # Pop the next event from our queue. Don't block if there's no event
        event, event_data = self._event_queue.dequeue_nowait()
        if event is None:
            return

        LOGGER.debug('Received ScriptEvent: %s', event)
        if event == ScriptEvent.STOP:
            raise StopException()
        elif event == ScriptEvent.SHUTDOWN:
            self._shutdown_requested = True
            raise StopException()
        elif event == ScriptEvent.RERUN:
            raise RerunException(event_data)
        else:
            raise RuntimeError('Unrecognized ScriptEvent: %s' % event)

    def _on_source_file_changed(self):
        """One of our source files changed. Schedule a rerun if appropriate."""
        if self.run_on_save:
            self._event_queue.enqueue(ScriptEvent.RERUN,
                                      RerunData(argv=None, widget_state=None))
        else:
            self.on_file_change_not_handled.send()

    def _loop(self):
        """Our run loop.

        Continually pops events from the event_queue. Ends when we receive
        a SHUTDOWN event.

        """
        while not self._shutdown_requested:
            assert self._state == ScriptState.STOPPED

            # Dequeue our next event. If the event queue is empty, the thread
            # will go to sleep, and awake when there's a new event.
            event, event_data = self._event_queue.dequeue()
            if event == ScriptEvent.STOP:
                LOGGER.debug('Ignoring STOP event while not running')
            elif event == ScriptEvent.SHUTDOWN:
                LOGGER.debug('Shutting down')
                self._shutdown_requested = True
            elif event == ScriptEvent.RERUN:
                self._run_script(event_data)
            else:
                raise RuntimeError('Unrecognized ScriptEvent: %s' % event)

        # Release resources
        self._local_sources_watcher.close()

        self._set_state(ScriptState.IS_SHUTDOWN)

    def _install_tracer(self):
        """Install function that runs before each line of the script."""

        def trace_calls(frame, event, arg):
            self.maybe_handle_execution_control_request()
            return trace_calls

        # Python interpreters are not required to implement sys.settrace.
        if hasattr(sys, 'settrace'):
            sys.settrace(trace_calls)

    @contextmanager
    def _set_execing_flag(self):
        """A context for setting the ScriptRunner._execing flag.

        Used by maybe_handle_execution_control_request to ensure that
        we only handle requests while we're inside an exec() call
        """
        if self._execing:
            raise RuntimeError('Nested set_execing_flag call')
        self._execing = True
        try:
            yield
        finally:
            self._execing = False

    def _run_script(self, rerun_data):
        """Run our script.

        Parameters
        ----------
        rerun_data: RerunData
            The RerunData to use.

        """
        assert self._state == ScriptState.STOPPED
        LOGGER.debug('Running script %s', rerun_data)

        # Reset delta generator so it starts from index 0.
        import streamlit as st
        st._reset()

        self._set_state(ScriptState.RUNNING)

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
            self._set_state(ScriptState.STOPPED)
            return

        # If we get here, we've successfully compiled our script. The next step
        # is to run it. Errors thrown during execution will be shown to the
        # user as ExceptionElements.

        # Get our argv and widget_state for this run, defaulting to
        # self._last_run_data for missing values.
        # Also update self._last_run_data for the next run.
        argv = rerun_data.argv or self._last_run_data.argv
        widget_state = rerun_data.widget_state or \
                       self._last_run_data.widget_state
        self._last_run_data = RerunData(
            argv, reset_widget_triggers(widget_state))

        # Update the Widget singleton with the new widget_state
        self._ctx.widgets.set_state(widget_state)

        if config.get_option('runner.installTracer'):
            self._install_tracer()

        # This will be set to a RerunData instance if our execution
        # is interrupted by a RerunException.
        rerun_with_data = None

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
            # TODO: Remove this feature when we implement interactivity!
            #  This is not robust in a multi-user environment.
            sys.argv = argv

            # Add special variables to the module's globals dict.
            module.__dict__['__file__'] = self._report.script_path

            with modified_sys_path(self._report), self._set_execing_flag():
                exec(code, module.__dict__)

        except RerunException as e:
            rerun_with_data = e.rerun_data

        except StopException:
            pass

        except BaseException as e:
            # Show exceptions in the Streamlit report.
            LOGGER.debug(e)
            st.exception(e)  # This is OK because we're in the script thread.
            # TODO: Clean up the stack trace, so it doesn't include
            # ScriptRunner.

        finally:
            self._set_state(ScriptState.STOPPED)

        # Use _log_if_error() to make sure we never ever ever stop running the
        # script without meaning to.
        _log_if_error(self._local_sources_watcher.update_watched_modules)
        _log_if_error(_clean_problem_modules)

        if rerun_with_data is not None:
            self._run_script(rerun_with_data)


class ScriptControlException(BaseException):
    """Base exception for ScriptRunner."""
    pass


class StopException(ScriptControlException):
    """Silently stop the execution of the user's script."""
    pass


class RerunException(ScriptControlException):
    """Silently stop and rerun the user's script."""
    def __init__(self, rerun_data):
        """Construct a RerunException

        Parameters
        ----------
        rerun_data : RerunData
            The RerunData that should be used to rerun the report
        """
        self.rerun_data = rerun_data


def _clean_problem_modules():
    """Some modules are stateful, so we have to clear their state."""

    if 'keras' in sys.modules:
        try:
            keras = sys.modules['keras']
            keras.backend.clear_session()
        except:
            pass

    if 'matplotlib.pyplot' in sys.modules:
        try:
            plt = sys.modules['matplotlib.pyplot']
            plt.close('all')
        except:
            pass


def _new_module(name):
    """Create a new module with the given name."""

    if sys.version_info >= (3, 4):
        import types
        return types.ModuleType(name)

    import imp
    return imp.new_module(name)


def _index_if(collection, pred):
    """Find the index of the first item in a collection for which a predicate is true.

    Returns the index, or -1 if no such item exists.
    """
    for index, element in enumerate(collection):
        if pred(element):
            return index
    return -1


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


# The reason this is not a decorator is because we want to make it clear at the
# calling location that this function is being used.
def _log_if_error(fn):
    try:
        fn()
    except Exception as e:
        LOGGER.warning(e)
