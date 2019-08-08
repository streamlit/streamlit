# Copyright 2019 Streamlit Inc. All rights reserved.

"""A hashing utility for code."""

# Python 2/3 compatibility
from __future__ import (absolute_import, division, print_function,
                        unicode_literals)

import dis
import hashlib
import importlib
import inspect
import io
import os
import sys
from collections import namedtuple

import streamlit as st
from streamlit import util
from streamlit.compatibility import setup_2_3_shims

if sys.version_info >= (3, 0):
    from streamlit.hashing_py3 import get_referenced_objects

setup_2_3_shims(globals())


try:
    # cPickle, if available, is much faster than pickle.
    # Source: https://pymotw.com/2/pickle/
    import cPickle as pickle
except ImportError:
    import pickle


Context = namedtuple('Context', ['globals', 'closure', 'varnames'])


def _get_context(func):
    closure = (
        [cell.cell_contents for cell in func.__closure__]
        if func.__closure__ is not None
        else None
    )

    varnames = {}
    if inspect.ismethod(func):
        varnames = {'self': func.__self__}

    return Context(globals=func.__globals__, closure=closure, varnames=varnames)


def get_hash(f, context=None):
    """Quick utility function that computes a hash of an arbitrary object."""
    hasher = CodeHasher('md5')
    hasher.update(f, context)
    return hasher.digest()


def _int_to_bytes(i):
    if hasattr(i, 'to_bytes'):
        return i.to_bytes((i.bit_length() + 7) // 8, 'little', signed=True)
    else:
        # For Python 2
        return b'int:' + str(i).encode()


def _key(obj, context):
    """Return key for memoization."""

    if obj is None:
        return b'none:'  # special value so we can hash None

    def is_simple(obj):
        return (
            isinstance(obj, bytes) or
            isinstance(obj, bytearray) or
            isinstance(obj, bytes) or
            isinstance(obj, string_types) or
            isinstance(obj, float) or
            isinstance(obj, int) or
            isinstance(obj, bool) or
            obj is None)

    if is_simple(obj):
        return obj

    if isinstance(obj, tuple):
        if all(map(is_simple, obj)):
            return obj

    if isinstance(obj, list):
        if all(map(is_simple, obj)):
            return ('__l', tuple(obj))

    if (util.is_type(obj, 'pandas.core.frame.DataFrame') or inspect.isbuiltin(obj) or
            inspect.isroutine(obj) or inspect.iscode(obj)):
        return id(obj)

    return None


class CodeHasher():
    """A hasher that can hash code objects including dependencies."""

    def __init__(self, name='md5', hasher=None):
        self.hashes = dict()

        self.name = name

        # The number of the bytes in the hash.
        self.size = 0

        # An ever increasing counter.
        self._counter = 0

        if hasher:
            self.hasher = hasher
        else:
            self.hasher = hashlib.new(name)

    def update(self, o, context=None):
        """Add bytes to hash."""
        b = self.to_bytes(o, context)
        self.hasher.update(b)

    def digest(self):
        return self.hasher.digest()

    def hexdigest(self):
        return self.hasher.hexdigest()

    def to_bytes(self, obj, context=None):
        """Add memoization to _to_bytes."""
        key = _key(obj, context)

        if key is not None:
            if key in self.hashes:
                return self.hashes[key]

            # add a tombstone hash to break recursive calls
            self._counter += 1
            self.hashes[key] = _int_to_bytes(self._counter)

        b = self._to_bytes(obj, context)

        self.size += sys.getsizeof(b)

        if key is not None:
            self.hashes[key] = b

        return b

    def _u(self, hasher, obj, context=None):
        """Update the provided hasher with the hash of an object."""
        b = self.to_bytes(obj, context)
        hasher.update(b)

    def _to_bytes(self, obj, context):
        """Hash objects to bytes, including code with dependencies.
        Python's built in `hash` does not produce consistent results across
        runs."""

        if isinstance(obj, bytes) or isinstance(obj, bytearray):
            return obj
        elif isinstance(obj, string_types):
            return obj.encode()
        elif isinstance(obj, float):
            return self.to_bytes(hash(obj))
        elif isinstance(obj, int):
            return _int_to_bytes(obj)
        elif isinstance(obj, list) or isinstance(obj, tuple):
            h = hashlib.new(self.name)
            # add type to distingush x from [x]
            self._u(h, type(obj).__name__.encode() + b':')
            for e in obj:
                self._u(h, e, context)
            return h.digest()
        elif obj is None:
            # Special string since hashes change between sessions.
            # We don't use Python's `hash` since hashes are not consistent
            # across runs.
            return b'none:'
        elif obj is True:
            return b'bool:1'
        elif obj is False:
            return b'bool:0'
        elif util.is_type(obj, 'pandas.core.frame.DataFrame'):
            import pandas as pd
            return pd.util.hash_pandas_object(obj).sum()
        elif inspect.isbuiltin(obj):
            return self.to_bytes(obj.__name__)
        elif hasattr(obj, 'name') and (
                isinstance(obj, io.IOBase) or os.path.exists(obj.name)):
            # Hash files as name + last modification date + offset.
            h = hashlib.new(self.name)
            self._u(h, obj.name)
            self._u(h, os.path.getmtime(obj.name))
            self._u(h, obj.tell())
            return h.digest()
        elif inspect.isroutine(obj):
            h = hashlib.new(self.name)
            # TODO: This may be too restrictive for libraries in development.
            if os.path.abspath(obj.__code__.co_filename).startswith(os.getcwd()):
                context = _get_context(obj)
                if obj.__defaults__:
                    self._u(h, obj.__defaults__, context)
                h.update(self._code_to_bytes(obj.__code__, context))
            else:
                # Don't hash code that is not in the current working directory.
                self._u(h, obj.__module__)
                self._u(h, obj.__name__)
            return h.digest()
        elif inspect.iscode(obj):
            return self._code_to_bytes(obj, context)
        elif inspect.ismodule(obj):
            # TODO: Hash more than just the name for internal modules.
            st.warning(('Streamlit does not support hashing modules. '
                        'We do not hash %s.') % obj.__name__)
            return self.to_bytes(obj.__name__)
        elif inspect.isclass(obj):
            # TODO: Hash more than just the name of classes.
            st.warning(('Streamlit does not support hashing classes. '
                        'We do not hash %s.') % obj.__name__)
            return self.to_bytes(obj.__name__)
        else:
            try:
                # As a last resort, we pickle the object to hash it.
                return pickle.dumps(obj, pickle.HIGHEST_PROTOCOL)
            except Exception:
                st.warning('Streamlit cannot hash an object of type %s.' % type(obj))

    def _code_to_bytes(self, code, context):
        h = hashlib.new(self.name)

        # Hash the bytecode.
        self._u(h, code.co_code)

        # Hash constants that are referenced by the bytecode but ignore names of lambdas.
        consts = [n for n in code.co_consts if
                  not isinstance(n, string_types) or not n.endswith('.<lambda>')]
        self._u(h, consts, context)

        # Hash non-local names and functions referenced by the bytecode.
        if hasattr(dis, 'get_instructions'):  # get_instructions is new since Python 3.4
            for ref in get_referenced_objects(code, context):
                self._u(h, ref, context)
        else:
            # This won't correctly follow nested calls like `foo.bar.baz()`.
            for name in code.co_names:
                if name in context.globals:
                    try:
                        self._u(h, context.globals[name], context)
                    except Exception:
                        self._u(h, name)
                else:
                    try:
                        module = importlib.import_module(name)
                        self._u(h, module, context)
                    except ImportError:
                        self._u(h, name, context)

            for i, name in enumerate(code.co_freevars):
                try:
                    self._u(h, context.closure[i], context)
                except Exception:
                    self._u(h, name)

        return h.digest()
