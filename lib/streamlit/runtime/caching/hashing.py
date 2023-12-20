# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Hashing for st.cache_data and st.cache_resource."""
import collections
import dataclasses
import datetime
import functools
import hashlib
import inspect
import io
import os
import pickle
import struct
import sys
import tempfile
import threading
import unittest.mock
import uuid
import weakref
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Pattern, Type, Union

from streamlit import type_util, util
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching.cache_errors import UnhashableTypeError
from streamlit.runtime.caching.cache_type import CacheType
from streamlit.runtime.uploaded_file_manager import UploadedFile
from streamlit.util import HASHLIB_KWARGS

# If a dataframe has more than this many rows, we consider it large and hash a sample.
_PANDAS_ROWS_LARGE = 100000
_PANDAS_SAMPLE_SIZE = 10000

# Similar to dataframes, we also sample large numpy arrays.
_NP_SIZE_LARGE = 1000000
_NP_SAMPLE_SIZE = 100000

HashFuncsDict = Dict[Union[str, Type[Any]], Callable[[Any], Any]]

# Arbitrary item to denote where we found a cycle in a hashed object.
# This allows us to hash self-referencing lists, dictionaries, etc.
_CYCLE_PLACEHOLDER = b"streamlit-57R34ML17-hesamagicalponyflyingthroughthesky-CYCLE"


class UserHashError(StreamlitAPIException):
    def __init__(
        self,
        orig_exc,
        object_to_hash,
        hash_func,
        cache_type: Optional[CacheType] = None,
    ):
        self.alternate_name = type(orig_exc).__name__
        self.hash_func = hash_func
        self.cache_type = cache_type

        msg = self._get_message_from_func(orig_exc, object_to_hash)

        super().__init__(msg)
        self.with_traceback(orig_exc.__traceback__)

    def _get_message_from_func(self, orig_exc, cached_func):
        args = self._get_error_message_args(orig_exc, cached_func)

        return (
            """
%(orig_exception_desc)s

This error is likely due to a bug in %(hash_func_name)s, which is a
user-defined hash function that was passed into the `%(cache_primitive)s` decorator of
%(object_desc)s.

%(hash_func_name)s failed when hashing an object of type
`%(failed_obj_type_str)s`.  If you don't know where that object is coming from,
try looking at the hash chain below for an object that you do recognize, then
pass that to `hash_funcs` instead:

```
%(hash_stack)s
```

If you think this is actually a Streamlit bug, please
[file a bug report here](https://github.com/streamlit/streamlit/issues/new/choose).
"""
            % args
        ).strip("\n")

    def _get_error_message_args(
        self,
        orig_exc: BaseException,
        failed_obj: Any,
    ) -> Dict[str, Any]:
        hash_source = hash_stacks.current.hash_source

        failed_obj_type_str = type_util.get_fqn_type(failed_obj)

        if hash_source is None:
            object_desc = "something"
        else:
            if hasattr(hash_source, "__name__"):
                object_desc = f"`{hash_source.__name__}()`"
            else:
                object_desc = "a function"

        decorator_name = ""
        if self.cache_type is CacheType.RESOURCE:
            decorator_name = "@st.cache_resource"
        elif self.cache_type is CacheType.DATA:
            decorator_name = "@st.cache_data"

        if hasattr(self.hash_func, "__name__"):
            hash_func_name = f"`{self.hash_func.__name__}()`"
        else:
            hash_func_name = "a function"

        return {
            "orig_exception_desc": str(orig_exc),
            "failed_obj_type_str": failed_obj_type_str,
            "hash_stack": hash_stacks.current.pretty_print(),
            "object_desc": object_desc,
            "cache_primitive": decorator_name,
            "hash_func_name": hash_func_name,
        }


def update_hash(
    val: Any,
    hasher,
    cache_type: CacheType,
    hash_source: Optional[Callable[..., Any]] = None,
    hash_funcs: Optional[HashFuncsDict] = None,
) -> None:
    """Updates a hashlib hasher with the hash of val.

    This is the main entrypoint to hashing.py.
    """

    hash_stacks.current.hash_source = hash_source

    ch = _CacheFuncHasher(cache_type, hash_funcs)
    ch.update(hasher, val)


class _HashStack:
    """Stack of what has been hashed, for debug and circular reference detection.

    This internally keeps 1 stack per thread.

    Internally, this stores the ID of pushed objects rather than the objects
    themselves because otherwise the "in" operator inside __contains__ would
    fail for objects that don't return a boolean for "==" operator. For
    example, arr == 10 where arr is a NumPy array returns another NumPy array.
    This causes the "in" to crash since it expects a boolean.
    """

    def __init__(self):
        self._stack: collections.OrderedDict[int, List[Any]] = collections.OrderedDict()
        # A function that we decorate with streamlit cache
        # primitive (st.cache_data or st.cache_resource).
        self.hash_source: Optional[Callable[..., Any]] = None

    def __repr__(self) -> str:
        return util.repr_(self)

    def push(self, val: Any):
        self._stack[id(val)] = val

    def pop(self):
        self._stack.popitem()

    def __contains__(self, val: Any):
        return id(val) in self._stack

    def pretty_print(self) -> str:
        def to_str(v: Any) -> str:
            try:
                return f"Object of type {type_util.get_fqn_type(v)}: {str(v)}"
            except Exception:
                return "<Unable to convert item to string>"

        return "\n".join(to_str(x) for x in reversed(self._stack.values()))


class _HashStacks:
    """Stacks of what has been hashed, with at most 1 stack per thread."""

    def __init__(self):
        self._stacks: weakref.WeakKeyDictionary[
            threading.Thread, _HashStack
        ] = weakref.WeakKeyDictionary()

    def __repr__(self) -> str:
        return util.repr_(self)

    @property
    def current(self) -> _HashStack:
        current_thread = threading.current_thread()

        stack = self._stacks.get(current_thread, None)

        if stack is None:
            stack = _HashStack()
            self._stacks[current_thread] = stack

        return stack


hash_stacks = _HashStacks()


def _int_to_bytes(i: int) -> bytes:
    num_bytes = (i.bit_length() + 8) // 8
    return i.to_bytes(num_bytes, "little", signed=True)


def _float_to_bytes(f: float) -> bytes:
    # Floats are 64bit in Python, so we need to use the "d" format.
    return struct.pack("<d", f)


def _key(obj: Optional[Any]) -> Any:
    """Return key for memoization."""

    if obj is None:
        return None

    def is_simple(obj):
        return (
            isinstance(obj, bytes)
            or isinstance(obj, bytearray)
            or isinstance(obj, str)
            or isinstance(obj, float)
            or isinstance(obj, int)
            or isinstance(obj, bool)
            or isinstance(obj, uuid.UUID)
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

    if inspect.isbuiltin(obj) or inspect.isroutine(obj) or inspect.iscode(obj):
        return id(obj)

    return NoResult


class _CacheFuncHasher:
    """A hasher that can hash objects with cycles."""

    def __init__(
        self, cache_type: CacheType, hash_funcs: Optional[HashFuncsDict] = None
    ):
        # Can't use types as the keys in the internal _hash_funcs because
        # we always remove user-written modules from memory when rerunning a
        # script in order to reload it and grab the latest code changes.
        # (See LocalSourcesWatcher.py:on_file_changed) This causes
        # the type object to refer to different underlying class instances each run,
        # so type-based comparisons fail. To solve this, we use the types converted
        # to fully-qualified strings as keys in our internal dict.
        self._hash_funcs: HashFuncsDict
        if hash_funcs:
            self._hash_funcs = {
                k if isinstance(k, str) else type_util.get_fqn(k): v
                for k, v in hash_funcs.items()
            }
        else:
            self._hash_funcs = {}
        self._hashes: Dict[Any, bytes] = {}

        # The number of the bytes in the hash.
        self.size = 0

        self.cache_type = cache_type

    def __repr__(self) -> str:
        return util.repr_(self)

    def to_bytes(self, obj: Any) -> bytes:
        """Add memoization to _to_bytes and protect against cycles in data structures."""
        tname = type(obj).__qualname__.encode()
        key = (tname, _key(obj))

        # Memoize if possible.
        if key[1] is not NoResult:
            if key in self._hashes:
                return self._hashes[key]

        # Break recursive cycles.
        if obj in hash_stacks.current:
            return _CYCLE_PLACEHOLDER

        hash_stacks.current.push(obj)

        try:
            # Hash the input
            b = b"%s:%s" % (tname, self._to_bytes(obj))

            # Hmmm... It's possible that the size calculation is wrong. When we
            # call to_bytes inside _to_bytes things get double-counted.
            self.size += sys.getsizeof(b)

            if key[1] is not NoResult:
                self._hashes[key] = b

        finally:
            # In case an UnhashableTypeError (or other) error is thrown, clean up the
            # stack so we don't get false positives in future hashing calls
            hash_stacks.current.pop()

        return b

    def update(self, hasher, obj: Any) -> None:
        """Update the provided hasher with the hash of an object."""
        b = self.to_bytes(obj)
        hasher.update(b)

    def _to_bytes(self, obj: Any) -> bytes:
        """Hash objects to bytes, including code with dependencies.

        Python's built in `hash` does not produce consistent results across
        runs.
        """

        h = hashlib.new("md5", **HASHLIB_KWARGS)

        if isinstance(obj, unittest.mock.Mock):
            # Mock objects can appear to be infinitely
            # deep, so we don't try to hash them at all.
            return self.to_bytes(id(obj))

        elif isinstance(obj, bytes) or isinstance(obj, bytearray):
            return obj

        elif type_util.get_fqn_type(obj) in self._hash_funcs:
            # Escape hatch for unsupported objects
            hash_func = self._hash_funcs[type_util.get_fqn_type(obj)]
            try:
                output = hash_func(obj)
            except Exception as ex:
                raise UserHashError(
                    ex, obj, hash_func=hash_func, cache_type=self.cache_type
                ) from ex
            return self.to_bytes(output)

        elif isinstance(obj, str):
            return obj.encode()

        elif isinstance(obj, float):
            return _float_to_bytes(obj)

        elif isinstance(obj, int):
            return _int_to_bytes(obj)

        elif isinstance(obj, uuid.UUID):
            return obj.bytes

        elif isinstance(obj, datetime.datetime):
            return obj.isoformat().encode()

        elif isinstance(obj, (list, tuple)):
            for item in obj:
                self.update(h, item)
            return h.digest()

        elif isinstance(obj, dict):
            for item in obj.items():
                self.update(h, item)
            return h.digest()

        elif obj is None:
            return b"0"

        elif obj is True:
            return b"1"

        elif obj is False:
            return b"0"

        elif dataclasses.is_dataclass(obj):
            return self.to_bytes(dataclasses.asdict(obj))

        elif isinstance(obj, Enum):
            return str(obj).encode()

        elif type_util.is_type(obj, "pandas.core.series.Series"):
            import pandas as pd

            self.update(h, obj.size)
            self.update(h, obj.dtype.name)

            if len(obj) >= _PANDAS_ROWS_LARGE:
                obj = obj.sample(n=_PANDAS_SAMPLE_SIZE, random_state=0)

            try:
                self.update(h, pd.util.hash_pandas_object(obj).values.tobytes())
                return h.digest()
            except TypeError:
                # Use pickle if pandas cannot hash the object for example if
                # it contains unhashable objects.
                return b"%s" % pickle.dumps(obj, pickle.HIGHEST_PROTOCOL)

        elif type_util.is_type(obj, "pandas.core.frame.DataFrame"):
            import pandas as pd

            self.update(h, obj.shape)

            if len(obj) >= _PANDAS_ROWS_LARGE:
                obj = obj.sample(n=_PANDAS_SAMPLE_SIZE, random_state=0)
            try:
                column_hash_bytes = self.to_bytes(
                    pd.util.hash_pandas_object(obj.dtypes)
                )
                self.update(h, column_hash_bytes)
                values_hash_bytes = self.to_bytes(pd.util.hash_pandas_object(obj))
                self.update(h, values_hash_bytes)
                return h.digest()
            except TypeError:
                # Use pickle if pandas cannot hash the object for example if
                # it contains unhashable objects.
                return b"%s" % pickle.dumps(obj, pickle.HIGHEST_PROTOCOL)

        elif type_util.is_type(obj, "numpy.ndarray"):
            self.update(h, obj.shape)
            self.update(h, str(obj.dtype))

            if obj.size >= _NP_SIZE_LARGE:
                import numpy as np

                state = np.random.RandomState(0)
                obj = state.choice(obj.flat, size=_NP_SAMPLE_SIZE)

            self.update(h, obj.tobytes())
            return h.digest()
        elif type_util.is_type(obj, "PIL.Image.Image"):
            import numpy as np

            # we don't just hash the results of obj.tobytes() because we want to use
            # the sampling logic for numpy data
            np_array = np.frombuffer(obj.tobytes(), dtype="uint8")
            return self.to_bytes(np_array)

        elif inspect.isbuiltin(obj):
            return bytes(obj.__name__.encode())

        elif type_util.is_type(obj, "builtins.mappingproxy") or type_util.is_type(
            obj, "builtins.dict_items"
        ):
            return self.to_bytes(dict(obj))

        elif type_util.is_type(obj, "builtins.getset_descriptor"):
            return bytes(obj.__qualname__.encode())

        elif isinstance(obj, UploadedFile):
            # UploadedFile is a BytesIO (thus IOBase) but has a name.
            # It does not have a timestamp so this must come before
            # temporary files
            self.update(h, obj.name)
            self.update(h, obj.tell())
            self.update(h, obj.getvalue())
            return h.digest()

        elif hasattr(obj, "name") and (
            isinstance(obj, io.IOBase)
            # Handle temporary files used during testing
            or isinstance(obj, tempfile._TemporaryFileWrapper)
        ):
            # Hash files as name + last modification date + offset.
            # NB: we're using hasattr("name") to differentiate between
            # on-disk and in-memory StringIO/BytesIO file representations.
            # That means that this condition must come *before* the next
            # condition, which just checks for StringIO/BytesIO.
            obj_name = getattr(obj, "name", "wonthappen")  # Just to appease MyPy.
            self.update(h, obj_name)
            self.update(h, os.path.getmtime(obj_name))
            self.update(h, obj.tell())
            return h.digest()

        elif isinstance(obj, Pattern):
            return self.to_bytes([obj.pattern, obj.flags])

        elif isinstance(obj, io.StringIO) or isinstance(obj, io.BytesIO):
            # Hash in-memory StringIO/BytesIO by their full contents
            # and seek position.
            self.update(h, obj.tell())
            self.update(h, obj.getvalue())
            return h.digest()

        elif type_util.is_type(obj, "numpy.ufunc"):
            # For numpy.remainder, this returns remainder.
            return bytes(obj.__name__.encode())

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
            self.update(h, obj.args)
            self.update(h, obj.func)
            self.update(h, obj.keywords)
            return h.digest()

        else:
            # As a last resort, hash the output of the object's __reduce__ method
            try:
                reduce_data = obj.__reduce__()
            except Exception as ex:
                raise UnhashableTypeError() from ex

            for item in reduce_data:
                self.update(h, item)
            return h.digest()


class NoResult:
    """Placeholder class for return values when None is meaningful."""

    pass
