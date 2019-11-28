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

"""A hashing utility for code."""

# Python 2/3 compatibility
from __future__ import absolute_import, division, print_function, unicode_literals

from collections import namedtuple
import dis
import functools
import hashlib
import importlib
import inspect
import io
import os
import sys
import textwrap

import streamlit as st
from streamlit import config
from streamlit import file_util
from streamlit import type_util
from streamlit.folder_black_list import FolderBlackList
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


# If a dataframe has more than this many rows, we consider it large and hash a sample.
PANDAS_ROWS_LARGE = 100000
PANDAS_SAMPLE_SIZE = 10000


# Similar to dataframes, we also sample large numpy arrays.
NP_SIZE_LARGE = 1000000
NP_SAMPLE_SIZE = 100000


Context = namedtuple("Context", ["globals", "cells", "varnames"])


def _is_magicmock(obj):
    return type_util.is_type(obj, "unittest.mock.MagicMock") or type_util.is_type(
        obj, "mock.mock.MagicMock"
    )


def _get_context(func):
    code = func.__code__
    # Mapping from variable name to the value if we can resolve it.
    # Otherwise map to the name.
    cells = {}
    for var in code.co_cellvars:
        cells[var] = var  # Instead of value, we use the name.
    if code.co_freevars:
        assert len(code.co_freevars) == len(func.__closure__)
        cells.update(
            zip(code.co_freevars, map(lambda c: c.cell_contents, func.__closure__))
        )

    varnames = {}
    if inspect.ismethod(func):
        varnames = {"self": func.__self__}

    return Context(globals=func.__globals__, cells=cells, varnames=varnames)


def get_hash(f, context=None, hash_funcs=None):
    """Quick utility function that computes a hash of an arbitrary object."""
    hasher = CodeHasher("md5", hash_funcs=hash_funcs)
    hasher.update(f, context)
    return hasher.digest()


def _int_to_bytes(i):
    if hasattr(i, "to_bytes"):
        num_bytes = (i.bit_length() + 8) // 8
        return i.to_bytes(num_bytes, "little", signed=True)
    else:
        # For Python 2
        return b"int:" + str(i).encode()


def _key(obj, context):
    """Return key for memoization."""

    if obj is None:
        return b"none:"  # special value so we can hash None

    def is_simple(obj):
        return (
            isinstance(obj, bytes)
            or isinstance(obj, bytearray)
            or isinstance(obj, string_types)  # noqa: F821
            or isinstance(obj, float)
            or isinstance(obj, int)
            or isinstance(obj, bool)
            or obj is None
        )

    if is_simple(obj):
        return obj

    if isinstance(obj, tuple):
        if all(map(is_simple, obj)):
            return obj

    if isinstance(obj, list):
        if all(map(is_simple, obj)):
            return ("__l", tuple(obj))

    if (
        type_util.is_type(obj, "pandas.core.frame.DataFrame")
        or type_util.is_type(obj, "numpy.ndarray")
        or inspect.isbuiltin(obj)
        or inspect.isroutine(obj)
        or inspect.iscode(obj)
    ):
        return id(obj)

    return None


def _hashing_error_message(start):
    return textwrap.dedent(
        """
        %(start)s

        **More information:** to prevent unexpected behavior, Streamlit tries
        to detect mutations in cached objects defined in your local files so
        it can alert you when the cache is used incorrectly. However, something
        went wrong while performing this check.

        This error can occur when your virtual environment lives in the same
        folder as your project, since that makes it hard for Streamlit to
        understand which files it should check. If you think that's what caused
        this, please add the following to `~/.streamlit/config.toml`:

        ```toml
        [server]
        folderWatchBlacklist = ['foldername']
        ```

        ...where `foldername` is the relative or absolute path to the folder
        where you put your virtual environment.

        Otherwise, please [file a
        bug here](https://github.com/streamlit/streamlit/issues/new/choose).

        To stop this warning from showing in the meantime, try one of the
        following:

        * **Preferred:** modify your code to avoid using this type of object.
        * Or add the argument `allow_output_mutation=True` to the `st.cache` decorator.
    """
        % {"start": start}
    ).strip("\n")


class CodeHasher:
    """A hasher that can hash code objects including dependencies."""

    def __init__(self, name="md5", hasher=None, hash_funcs=None):
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

        self._folder_black_list = FolderBlackList(
            config.get_option("server.folderWatchBlacklist")
        )

        self.hash_funcs = hash_funcs or {}

    def update(self, obj, context=None):
        """Update the hash with the provided object."""
        self._update(self.hasher, obj, context)

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

    def _update(self, hasher, obj, context=None):
        """Update the provided hasher with the hash of an object."""
        b = self.to_bytes(obj, context)
        hasher.update(b)

    def _to_bytes(self, obj, context):
        """Hash objects to bytes, including code with dependencies.
        Python's built in `hash` does not produce consistent results across
        runs."""

        try:
            if _is_magicmock(obj):
                # MagicMock can result in objects that appear to be infinitely
                # deep, so we don't try to hash them at all.
                return self.to_bytes(id(obj))
            elif isinstance(obj, bytes) or isinstance(obj, bytearray):
                return obj
            elif isinstance(obj, string_types):  # noqa: F821
                # Don't allow the user to override string since
                # str == bytes on python 2
                return obj.encode()
            elif type(obj) in self.hash_funcs:
                # Escape hatch for unsupported objects
                return self.to_bytes(self.hash_funcs[type(obj)](obj))
            elif isinstance(obj, float):
                return self.to_bytes(hash(obj))
            elif isinstance(obj, int):
                return _int_to_bytes(obj)
            elif isinstance(obj, list) or isinstance(obj, tuple):
                h = hashlib.new(self.name)
                # add type to distingush x from [x]
                self._update(h, type(obj).__name__.encode() + b":")
                for e in obj:
                    self._update(h, e, context)
                return h.digest()
            elif obj is None:
                # Special string since hashes change between sessions.
                # We don't use Python's `hash` since hashes are not consistent
                # across runs.
                return b"none:"
            elif obj is True:
                return b"bool:1"
            elif obj is False:
                return b"bool:0"
            elif type_util.is_type(
                obj, "pandas.core.frame.DataFrame"
            ) or type_util.is_type(obj, "pandas.core.series.Series"):
                import pandas as pd

                if len(obj) >= PANDAS_ROWS_LARGE:
                    obj = obj.sample(n=PANDAS_SAMPLE_SIZE, random_state=0)
                try:
                    return pd.util.hash_pandas_object(obj).sum()
                except TypeError:
                    # Use pickle if pandas cannot hash the object for example if
                    # it contains unhashable objects.
                    return pickle.dumps(obj, pickle.HIGHEST_PROTOCOL)
            elif type_util.is_type(obj, "numpy.ndarray"):
                h = hashlib.new(self.name)
                self._update(h, obj.shape)

                if obj.size >= NP_SIZE_LARGE:
                    import numpy as np

                    state = np.random.RandomState(0)
                    obj = state.choice(obj.flat, size=NP_SAMPLE_SIZE)

                self._update(h, obj.tobytes())
                return h.digest()
            elif inspect.isbuiltin(obj):
                return self.to_bytes(obj.__name__)
            elif hasattr(obj, "name") and (
                isinstance(obj, io.IOBase)
                or (
                    isinstance(obj.name, string_types)  # noqa: F821
                    and os.path.exists(obj.name)
                )
            ):
                # Hash files as name + last modification date + offset.
                h = hashlib.new(self.name)
                self._update(h, obj.name)
                self._update(h, os.path.getmtime(obj.name))
                self._update(h, obj.tell())
                return h.digest()
            elif inspect.isroutine(obj):
                if hasattr(obj, "__wrapped__"):
                    # Ignore the wrapper of wrapped functions.
                    return self.to_bytes(obj.__wrapped__)

                if obj.__module__.startswith("streamlit"):
                    # Ignore streamlit modules even if they are in the CWD
                    # (e.g. during development).
                    return self.to_bytes("%s.%s" % (obj.__module__, obj.__name__))

                h = hashlib.new(self.name)
                filepath = os.path.abspath(obj.__code__.co_filename)

                if file_util.file_is_in_folder_glob(
                    filepath, self._get_main_script_directory()
                ) and not self._folder_black_list.is_blacklisted(filepath):
                    context = _get_context(obj)
                    if obj.__defaults__:
                        self._update(h, obj.__defaults__, context)
                    h.update(self._code_to_bytes(obj.__code__, context))
                else:
                    # Don't hash code that is not in the current working directory.
                    self._update(h, obj.__module__)
                    self._update(h, obj.__name__)
                return h.digest()
            elif inspect.iscode(obj):
                return self._code_to_bytes(obj, context)
            elif inspect.ismodule(obj):
                # TODO: Figure out how to best show this kind of warning to the
                # user. In the meantime, show nothing. This scenario is too common,
                # so the current warning is quite annoying...
                # st.warning(('Streamlit does not support hashing modules. '
                #             'We did not hash `%s`.') % obj.__name__)
                # TODO: Hash more than just the name for internal modules.
                return self.to_bytes(obj.__name__)
            elif inspect.isclass(obj):
                # TODO: Figure out how to best show this kind of warning to the
                # user. In the meantime, show nothing. This scenario is too common,
                # (e.g. in every "except" statement) so the current warning is
                # quite annoying...
                # st.warning(('Streamlit does not support hashing classes. '
                #             'We did not hash `%s`.') % obj.__name__)
                # TODO: Hash more than just the name of classes.
                return self.to_bytes(obj.__name__)
            elif isinstance(obj, functools.partial):
                # The return value of functools.partial is not a plain function:
                # it's a callable object that remembers the original function plus
                # the values you pickled into it. So here we need to special-case it.
                h = hashlib.new(self.name)
                self._update(h, obj.args)
                self._update(h, obj.func)
                self._update(h, obj.keywords)
                return h.digest()
            else:
                try:
                    # As a last resort, we pickle the object to hash it.
                    return pickle.dumps(obj, pickle.HIGHEST_PROTOCOL)
                except:
                    st.warning(
                        _hashing_error_message(
                            "Streamlit cannot hash an object of type %s." % type(obj)
                        )
                    )
        except:
            st.warning(
                _hashing_error_message(
                    "Streamlit failed to hash an object of type %s." % type(obj)
                )
            )

    def _code_to_bytes(self, code, context):
        h = hashlib.new(self.name)

        # Hash the bytecode.
        self._update(h, code.co_code)

        # Hash constants that are referenced by the bytecode but ignore names of lambdas.
        consts = [
            n
            for n in code.co_consts
            if not isinstance(n, string_types)  # noqa: F821
            or not n.endswith(".<lambda>")
        ]
        self._update(h, consts, context)

        # Hash non-local names and functions referenced by the bytecode.
        if hasattr(dis, "get_instructions"):  # get_instructions is new since Python 3.4
            for ref in get_referenced_objects(code, context):
                self._update(h, ref, context)
        else:
            # This won't correctly follow nested calls like `foo.bar.baz()`.
            for name in code.co_names:
                if name in context.globals:
                    try:
                        self._update(h, context.globals[name], context)
                    except Exception:
                        self._update(h, name)
                else:
                    try:
                        module = importlib.import_module(name)
                        self._update(h, module, context)
                    except ImportError:
                        self._update(h, name, context)

            for name, value in context.cells.items():
                try:
                    self._update(h, value, context)
                except Exception:
                    self._update(h, name)

        return h.digest()

    @staticmethod
    def _get_main_script_directory():
        """Get the directory of the main script.
        """
        import __main__
        import os

        # This works because we set __main__.__file__ to the report
        # script path in ScriptRunner.
        main_path = __main__.__file__
        return os.path.dirname(main_path)
