# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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


def get_referenced_objects(code, context):
    tos = None  # top of the stack

    refs = []

    def set_tos(t):
        nonlocal tos
        if tos is not None:
            # hash tos so we support reading multiple objects
            refs.append(tos)
        tos = t

    # Our goal is to find referenced objects. The problem is that co_names
    # does not have full qualified names in it. So if you access `foo.bar`,
    # co_names has `foo` and `bar` in it but it doesn't tell us that the
    # code reads `bar` of `foo`. We are going over the bytecode to resolve
    # from which object an attribute is requested.
    # Read more about bytecode at https://docs.python.org/3/library/dis.html

    for op in dis.get_instructions(code):
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

    return refs
