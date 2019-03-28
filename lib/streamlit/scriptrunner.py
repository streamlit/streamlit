# Copyright 2018 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import ctypes
import os
import signal
import sys
import threading
import time
import tornado.ioloop

from streamlit import __version__
from streamlit import config
from streamlit import protobuf
from streamlit import util

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


class State(object):
    INITIAL = 'INITIAL'
    RUNNING = 'RUNNING'
    STOP_REQUESTED = 'STOP_REQUESTED'
    RERUN_REQUESTED = 'RERUN_REQUESTED'
    PAUSE_REQUESTED = 'PAUSE_REQUESTED'
    PAUSED = 'PAUSED'
    STOPPED = 'STOPPED'


class ScriptRunner(object):

    _singleton = None

    @classmethod
    def get_instance(cls):
        """Return the singleton instance."""
        if cls._singleton is None:
            ScriptRunner()

        s = ScriptRunner._singleton
        return s

    # Don't allow constructor to be called more than once.
    def __new__(cls):
        """Constructor."""
        if ScriptRunner._singleton is not None:
            raise RuntimeError('Use .get_instance() instead')
        return super(ScriptRunner, cls).__new__(cls)

    def __init__(self):
        """Initialize."""
        ScriptRunner._singleton = self

        self._path = None
        self._state = None
        self._set_state(State.INITIAL)
        self._state_change_requested = threading.Event()
        self._paused = threading.Event()

    def _set_state(self, state):
        self._state = state

    def set_file_path(self, script_path):
        self._path = script_path

    def spawn_script_thread(self):
        script_thread = threading.Thread(
            target=self._run,
            name='Streamlit script runner thread')

        script_thread.start()

    def _install_tracer(self):
        """Install function that runs before each line of the script."""

        def trace_calls(frame, event, arg):
            self.maybe_handle_execution_control_request()
            return trace_calls

        # Python interpreters are not required to implement sys.settrace.
        if hasattr(sys, 'settrace'):
            sys.settrace(trace_calls)

    def _run(self):
        from streamlit.server import Server

        if not self._path:
            raise RuntimeError('Must call set_file_path() before calling run()')

        # Wait 1s for thread to be ready
        # TODO: Use a lock for this.
        for i in range(100):
            if self.is_fully_stopped():
                break
            time.sleep(0.1)

        if not self.is_fully_stopped():
            raise RuntimeError('Script is already running')

        server = Server.get_instance()
        server.clear_queue()

        self._install_tracer()

        self._state_change_requested.clear()
        self._set_state(State.RUNNING)

        # Python 3 got rid of the native execfile() command, so we now read the
        # file, compile it, and exec() it. This implementation is compatible
        # with both 2 and 3.
        with open(self._path) as f:
            filebody = f.read()

        code = compile(
            filebody,
            # Pass in the file path so it can show up in exceptions.
            self._path,
            # We're compiling entire blocks of Python, so we need "exec" mode
            # (as opposed to "eval" or "single").
            'exec',
            # Don't inherit any flags or "future" statements.
            flags=0,
            dont_inherit=1,
            # -1 = default optimization level (specified by the -O parameter)
            # 0 = no optimization & __debug__ is true
            # 1 = asserts are removed & __debug__ is false
            # 2 = docstrings are removed too.
            optimize=-1)

        try:
            _maybe_enqueue_new_connection_message(server)
            _enqueue_new_report_message(server)

            # IMPORTANT: must pass a brand new dict into the globals and locals,
            # below, so we don't leak any variables in between runs, and don't
            # leak any variables from this file either.
            # Also: here we set our globals and locals to the same dict to
            # emulate what it's like to run at the top level of a module/python
            # file. This is also why we're adding a few common variables below
            # like __name__.
            ns = dict(
                __name__='__main__',
                __file__=str(self._path),  # str() so it's not unicode in py2.
            )
            exec(code, ns, ns)

        except ScriptRunner.ScriptControlException as e:
            # Stop ScriptControlExceptions from appearing in the console.
            pass

        except BaseException as e:
            # Show exceptions in the Streamlit report.
            _enqueue_exception(server, e)
            raise # Don't pass "e" here, to preserve e's original stack trace.
            # TODO: Use "raise TheExceptionType, e, traceback" instead, so we
            # can try and clean up the traceback a little (remove Streamlit
            # from it, to make it easier for users to debug).

        finally:
            _enqueue_report_finished_message(server)
            self._set_state(State.STOPPED)

    def pause(self):
        self._paused.set()
        self._set_state(State.PAUSED)

        while self._paused.is_set():
            time.sleep(0.1)

    def unpause(self, new_state):
        self._set_state(new_state)
        self._paused.clear()

    def request_stop(self):
        if self.is_fully_stopped():
            pass
        else:
            self.unpause(new_state=State.STOP_REQUESTED)
            self._state_change_requested.set()

    def request_rerun(self):
        if self.is_fully_stopped():
            self.spawn_script_thread()
        else:
            self.unpause(new_state=State.RERUN_REQUESTED)
            self._state_change_requested.set()

    def request_pause_unpause(self):
        if self._state == State.PAUSED:
            self.unpause(new_state=State.RUNNING)
        else:
            self._request_pause()

    def _request_pause(self):
        if self.is_fully_stopped():
            pass
        else:
            self._set_state(State.PAUSE_REQUESTED)
            self._state_change_requested.set()

    def maybe_handle_execution_control_request(self):
        if self._state_change_requested.is_set():

            if self._state == State.STOP_REQUESTED:
                raise ScriptRunner.StopException()
            elif self._state == State.RERUN_REQUESTED:
                self.spawn_script_thread()
                raise ScriptRunner.RerunException()
            elif self._state == State.PAUSE_REQUESTED:
                self.pause()
                return

    def is_fully_stopped(self):
        return self._state in (State.INITIAL, State.STOPPED)

    class ScriptControlException(BaseException):
        pass

    class StopException(ScriptControlException):
        """Silently stop the execution of the user's script."""
        pass

    class RerunException(ScriptControlException):
        """Silently stop and rerun the user's script."""
        pass


def _enqueue_new_report_message(server):
    msg = protobuf.ForwardMsg()
    msg.new_report.id = str(util.build_report_id())
    msg.new_report.cwd = os.getcwd()
    msg.new_report.command_line.extend(sys.argv)
    msg.new_report.source_file_path = ''  # XXX remove

    server.enqueue(msg)


def _maybe_enqueue_new_connection_message(server):
    if server.sent_new_connection_message:
        return

    server.sent_new_connection_message = True

    msg = protobuf.ForwardMsg()

    v = config.get_option('global.sharingMode') != 'off'
    msg.new_connection.sharing_enabled = v
    LOGGER.debug(
        'New browser connection: sharing_enabled=%s',
        msg.new_connection.sharing_enabled)

    v = config.get_option('browser.gatherUsageStats')
    msg.new_connection.gather_usage_stats = v
    LOGGER.debug(
        'New browser connection: gather_usage_stats=%s',
        msg.new_connection.gather_usage_stats)

    msg.new_connection.streamlit_version = __version__

    server.enqueue(msg)


def _enqueue_report_finished_message(server):
    msg = protobuf.ForwardMsg()
    msg.report_finished = True
    server.enqueue(msg)


def _enqueue_exception(server, e):
    import streamlit as st
    st.exception(e)
