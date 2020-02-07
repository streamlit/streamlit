# -*- coding: utf-8 -*-
# Copyright 2018-2020 Streamlit Inc.
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

"""A hashing utility for code that uses Python 3 specific code so it needs to be
conditionally imported."""

import dis
import importlib
import inspect
import re
import textwrap

from streamlit import source_util as _source_util
from streamlit.errors import UserHashError
from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


def _hashing_user_error_message(exc, lines, filename, lineno):
    return textwrap.dedent(
        """
%(exception)s

Error in `%(filename)s` near line `%(lineno)s`:

```
%(lines)s
```

If you think this is actually a Streamlit bug, please [file a bug report here.]
(https://github.com/streamlit/streamlit/issues/new/choose)
    """
        % {
            "exception": str(exc),
            "lines": lines,
            "filename": filename,
            "lineno": lineno,
        }
    ).strip("\n")


def _get_failing_lines(code, lineno):
    code_lines = inspect.getsourcelines(code)
    end_lineno = min(lineno + 3, len(code_lines[0]) + code_lines[1])
    lines = None

    with _source_util.open_python_file(code.co_filename) as source_file:
        source_lines = source_file.readlines()
        lines = source_lines[lineno - 1: end_lineno]

    return lines


def get_referenced_objects(code, context):
    tos = None  # top of the stack
    lineno = None
    refs = []

    def set_tos(t):
        nonlocal tos
        if tos is not None:
            # hash tos so we support reading multiple objects
            refs.append(tos)
        tos = t

    def handle_operation(op):
        nonlocal tos
        nonlocal lineno
        if op.starts_line is not None:
            lineno = op.starts_line

        if op.opname in ["LOAD_GLOBAL", "LOAD_NAME"]:
            if op.argval in context.globals:
                set_tos(context.globals[op.argval])
            else:
                set_tos(op.argval)
        elif op.opname in ["LOAD_DEREF", "LOAD_CLOSURE"]:
            set_tos(context.cells[op.argval])
        elif op.opname == "IMPORT_NAME":
            try:
                set_tos(importlib.import_module(op.argval))
            except ImportError:
                set_tos(op.argval)
        elif op.opname in ["LOAD_METHOD", "LOAD_ATTR", "IMPORT_FROM"]:
            if tos is None:
                refs.append(op.argval)
            elif isinstance(tos, str):
                tos += "." + op.argval
            else:
                tos = getattr(tos, op.argval)
        elif op.opname == "DELETE_FAST" and tos:
            del context.varnames[op.argval]
            tos = None
        elif op.opname == "STORE_FAST" and tos:
            context.varnames[op.argval] = tos
            tos = None
        elif op.opname == "LOAD_FAST" and op.argval in context.varnames:
            set_tos(context.varnames[op.argval])
        else:
            # For all other instructions, hash the current TOS.
            if tos is not None:
                refs.append(tos)
                tos = None

    # Our goal is to find referenced objects. The problem is that co_names
    # does not have full qualified names in it. So if you access `foo.bar`,
    # co_names has `foo` and `bar` in it but it doesn't tell us that the
    # code reads `bar` of `foo`. We are going over the bytecode to resolve
    # from which object an attribute is requested.
    # Read more about bytecode at https://docs.python.org/3/library/dis.html

    for op in dis.get_instructions(code):
        try:
            handle_operation(op)
        except Exception as e:
            lines = _get_failing_lines(code, lineno)

            msg = _hashing_user_error_message(
                e, "".join(lines), code.co_filename, lineno
            )
            raise UserHashError(msg).with_traceback(e.__traceback__)

    return refs
