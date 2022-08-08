# Copyright 2018-2022 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import itertools
import ast

from streamlit import config
from streamlit import magic
from streamlit.cursor import get_container_cursor
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.scriptrunner.script_run_context import get_script_run_ctx

STATEFUL_WIDGETS = [
    'camera_input',
    'checkbox',
    'color_picker',
    'component_instance',
    'date_input',
    'file_uploader',
    'multiselect',
    'number_input',
    'radio',
    'selectbox',
    'slider',
    'text_area',
    'text_input',
    'time_input',
]

STATELESS_WIDGETS = [
    'button',
]


class RANDOM_VALUE:
    pass

class NotebookRunner:
    def __init__(self, body, script_path):
        self._script_path = script_path

        self._current_running_cell_runner = None

        if script_path is None:
            self._cell_runners = []
        else:
            self._cell_runners = [
                _CellRunner(i, cb, script_path)
                for (i, cb) in enumerate(_split_cells_at_ellipses(body))
            ]

    def __len__(self):
        return len(self._cell_runners)

    def __iter__(self):
        return (self[i] for i in range(len(self)))

    def __getitem__(self, i):
        if i >= len(self):
            return None
        return self._cell_runners[i]

    def __setitem__(self, i, item):
        self._cell_runners[i] = item

    def _update_cells(self, new_body, new_script_path):
        new_runner = NotebookRunner(new_body, new_script_path)

        if new_script_path == self._script_path:
            cells_to_rerun = new_runner._get_cells_to_rerun(self)
        else:
            cells_to_rerun = (True for _ in new_runner)

        for i, cell_is_diff in enumerate(cells_to_rerun):
            if not cell_is_diff:
                new_runner[i] = self[i]

        self._script_path = new_script_path
        self._cell_runners = new_runner._cell_runners

    def run(self, locals, new_body, new_script_path):
        try:
            self._update_cells(new_body, new_script_path)

            for cr in self:
                self._current_running_cell_runner = cr
                locals = cr.run(locals)

        except BaseException as e:
            raise

        finally:
            self._current_running_cell_runner = None

    def _get_cells_to_rerun(self, other):
        diff = []
        last_differing_cell = float('inf')

        for i in range(len(self)):
            # If item doesn't exist in other runner, it's different.
            if i >= len(other):
                last_differing_cell = i
                diff.append(True)

            # If item comes after an item that changed, it's different.
            elif i >= last_differing_cell:
                last_differing_cell = i
                diff.append(True)

            # If the user changed a widget that exists in this cell, it's different.
            elif other[i]._widget_value_changed():
                print('widget value changed:', i)
                last_differing_cell = i
                diff.append(True)

            # If item changed, it's different.
            elif not self[i] == other[i]:
                print('code changed:', i)
                last_differing_cell = i
                diff.append(True)

            # Otherwise, it's not different.
            else:
                diff.append(False)

        return diff

    def record_msg(self, msg):
        if self._current_running_cell_runner:
            self._current_running_cell_runner.record_msg(msg)


class _CellRunner:
    def __init__(self, cell_index, body, script_path):
        self._cell_index = cell_index
        self._body = body
        self._script_path = script_path
        self._successfully_ran = False

        self._recorded_msgs = []
        self._locals = {}
        self._recorded_widget_states = {}

    def __eq__(self, other):
        return self._body.strip() == other._body.strip()

    # TODO HACK XXX: The way cells remember their output is very hacky right now. It dives deep into
    # protos, session state, locals, etc. Need a cleaner way.
    def record_msg(self, msg):
        if not msg.HasField('delta'):
            # Only record deltas.
            return

        self._recorded_msgs.append(msg)
        self._record_widget(msg)

    # TODO HACK XXX: This is super hacky! I think there are clean ways to do this, but they'd
    # require a little refactor around how widgets are kept in state and in protos.
    def _record_widget(self, msg):
        if not msg.delta.HasField('new_element'):
            return

        el = msg.delta.new_element

        ctx = get_script_run_ctx()
        curr_widget_states = ctx.session_state._state._new_widget_state

        for widget_name in STATEFUL_WIDGETS:
            if el.HasField(widget_name):
                widget = getattr(el, widget_name)
                if widget.id in curr_widget_states:
                    self._recorded_widget_states[widget.id] = curr_widget_states[widget.id]
                else:
                    self._recorded_widget_states[widget.id] = widget.default
                break

        for widget_name in STATELESS_WIDGETS:
            if el.HasField(widget_name):
                widget = getattr(el, widget_name)
                self._recorded_widget_states[widget.id] = RANDOM_VALUE

    def _widget_value_changed(self):
        ctx = get_script_run_ctx()
        curr_widget_states = ctx.session_state._state._new_widget_state

        for id, stored_value in self._recorded_widget_states.items():
            if id in curr_widget_states:
                curr_value = curr_widget_states[id]
                if curr_value != stored_value:
                    return True

        return False

    def run(self, locals):
        if self._successfully_ran:
            print(f'XXX replaying {self._cell_index} ------------------------------')
            self._replay_recorded_msgs()
            return self._locals

        print(f'XXX running {self._cell_index} ------------------------------')
        self._recorded_msgs.clear()
        self._recorded_widget_states.clear()

        try:
            # Must happen before compile and magic, so DG can read current_cell_index and exceptions
            # can propagate.
            exec('import streamlit as st\nst.cell()', {})

            code = self._body

            if config.get_option("runner.magicEnabled"):
                code = magic.add_magic(
                    code, self._script_path, is_root=(self._cell_index == 0))

            code = compile(
                code,
                # Pass in the file path so it can show up in exceptions.
                self._script_path,
                # We're compiling entire blocks of Python, so we need "exec"
                # mode (as opposed to "eval" or "single").
                mode="exec",
                # Don't inherit any flags or "future" statements.
                flags=0,
                dont_inherit=1,
                # Use the default optimization options.
                optimize=-1,
            )

            exec(code, locals)

            ctx = get_script_run_ctx()
            if not ctx.bust_current_cell_recording:
                self._locals = dict(locals)  # TODO XXX Handle refs properly!
                self._successfully_ran = True

        except BaseException as e:
            raise

        return locals

    # TODO XXX: Stop accessing internal APIs.
    def _replay_recorded_msgs(self):
        ctx = get_script_run_ctx()

        for msg in self._recorded_msgs:
            delta_path = msg.metadata.delta_path

            if len(delta_path) == 2:
                root_container = msg.metadata.delta_path[0]
                index = msg.metadata.delta_path[1]

                cursor = get_container_cursor(root_container)
                cursor._index = index + 1

            print('XXX msg', msg.metadata.delta_path, msg.delta.new_element.WhichOneof('type'))
            print('XXX cursor', index + 1)

            ctx.enqueue(msg, allow_recording=False)
            ctx.current_cell_index = self._cell_index


def _split_cells_at_ellipses(body):
    lines = body.split('\n')
    current_cell = []
    cells = []

    for i, line in enumerate(lines):
        if line == '...':
            cells.append('\n'.join(current_cell))
            current_cell = [
                '\n' * i # Add blank lines to make errors point to right line of code.
            ]
        else:
            current_cell.append(line)

    cells.append('\n'.join(current_cell))

    return cells


def _split_cells_at_expressions(body):
    import ast
    tree = ast.parse(body)

    lines = body.split('\n')
    current_cell = []

    cells = []

    for node in tree.body:
        cell_lines = lines[node.lineno - 1:node.end_lineno] # Lines are 1-indexed!
        cell_body = '\n'.join(cell_lines)
        cells.append(cell_body)

    return cells
