# Copyright 2018-2021 Streamlit Inc.
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

import collections
import enum
import functools
import hashlib
import inspect
import io
import os
import pickle
import sys
import tempfile
import textwrap
import threading
import types
import unittest.mock
import weakref
from typing import Any, List, Pattern, Optional, Dict, Callable, Union, Tuple

from streamlit import type_util
from streamlit import util
from streamlit.errors import StreamlitAPIException, MarkdownFormattedException
from streamlit.logger import get_logger
from streamlit.uploaded_file_manager import UploadedFile

_LOGGER = get_logger(__name__)


# If a dataframe has more than this many rows, we consider it large and hash a sample.
_PANDAS_ROWS_LARGE = 100000
_PANDAS_SAMPLE_SIZE = 10000


# Similar to dataframes, we also sample large numpy arrays.
_NP_SIZE_LARGE = 1000000
_NP_SAMPLE_SIZE = 100000


# Arbitrary item to denote where we found a cycle in a hashed object.
# This allows us to hash self-referencing lists, dictionaries, etc.
_CYCLE_PLACEHOLDER = b"streamlit-57R34ML17-hesamagicalponyflyingthroughthesky-CYCLE"


class HashReason(enum.Enum):
    CACHING_FUNC_ARGS = 0
    CACHING_FUNC_BODY = 1
    CACHING_FUNC_OUTPUT = 2
    CACHING_BLOCK = 3


def update_hash(
    val: Any,
    hasher,
    hash_reason: HashReason,
    hash_source: Callable[..., Any],
) -> None:
    """Updates a hashlib hasher with the hash of val.

    This is the main entrypoint to hashing.py.
    """
    hash_stacks.current.hash_reason = hash_reason
    hash_stacks.current.hash_source = hash_source

    ch = _SafeHasher()
    ch.update(hasher, val)


def make_value_key(func: types.FunctionType, *args, **kwargs) -> str:
    """Create the key for a value within a cache.

    This key is generated from the function's arguments. All arguments
    will be hashed, except for those named with a leading "_".

    Raises
    ------
    StreamlitAPIException
        Raised (with a nicely-formatted explanation message) if we encounter
        an un-hashable arg.
    """

    # Create a (name, value) list of all *args and **kwargs passed to the
    # function.
    arg_pairs: List[Tuple[Optional[str], Any]] = []
    for arg_idx in range(len(args)):
        arg_name = _get_positional_arg_name(func, arg_idx)
        arg_pairs.append((arg_name, args[arg_idx]))

    for kw_name, kw_val in kwargs.items():
        # **kwargs ordering is preserved, per PEP 468
        # https://www.python.org/dev/peps/pep-0468/, so this iteration is
        # deterministic.
        arg_pairs.append((kw_name, kw_val))

    # Create the hash from each arg value, except for those args whose name
    # starts with "_". (Underscore-prefixed args are deliberately excluded from
    # hashing.)
    args_hasher = hashlib.new("md5")
    for arg_name, arg_value in arg_pairs:
        if arg_name is not None and arg_name.startswith("_"):
            _LOGGER.debug("Not hashing %s because it starts with _", arg_name)
            continue

        try:
            update_hash(
                (arg_name, arg_value),
                hasher=args_hasher,
                hash_reason=HashReason.CACHING_FUNC_ARGS,
                hash_source=func,
            )
        except UnhashableTypeError as exc:
            raise StreamlitAPIException(
                _get_unhashable_arg_message(func, arg_name, arg_value)
            ) from exc

    value_key = args_hasher.hexdigest()
    _LOGGER.debug("Cache key: %s", value_key)

    return value_key


def _get_positional_arg_name(func: types.FunctionType, arg_index: int) -> Optional[str]:
    """Return the name of a function's positional argument.

    If arg_index is out of range, or refers to a parameter that is not a
    named positional argument (e.g. an *args, **kwargs, or keyword-only param),
    return None instead.
    """
    if arg_index < 0:
        return None

    params: List[inspect.Parameter] = list(inspect.signature(func).parameters.values())
    if arg_index >= len(params):
        return None

    if params[arg_index].kind in (
        inspect.Parameter.POSITIONAL_OR_KEYWORD,
        inspect.Parameter.POSITIONAL_ONLY,
    ):
        return params[arg_index].name

    return None


def _get_unhashable_arg_message(
    func: types.FunctionType, arg_name: Optional[str], arg_value: Any
) -> str:
    arg_name_str = arg_name if arg_name is not None else "(unnamed)"
    arg_type = type_util.get_fqn_type(arg_value)
    func_name = func.__name__
    arg_replacement_name = f"_{arg_name}" if arg_name is not None else "_arg"

    return (
        f"""
Cannot hash argument '{arg_name_str}' (of type `{arg_type}`) in '{func_name}'.

To address this, you can tell @st.memo not to hash this argument by adding a
leading underscore to the argument's name in the function signature:

```
@st.memo
def {func_name}({arg_replacement_name}, ...):
    ...
```
        """
    ).strip("\n")


def make_function_key(func: types.FunctionType) -> str:
    """Create the unique key for a function's cache.

    A naive implementation would involve simply creating the cache object
    right in the wrapper, which in a normal Python script would be executed
    only once. But in Streamlit, we reload all modules related to a user's
    app when the app is re-run, which means that - among other things - all
    function decorators in the app will be re-run, and so any decorator-local
    objects will be recreated.

    Furthermore, our caches can be destroyed and recreated (in response to
    cache clearing, for example), which means that retrieving the function's
    cache in the decorator (so that the wrapped function can save a lookup)
    is incorrect: the cache itself may be recreated between
    decorator-evaluation time and decorated-function-execution time. So we
    must retrieve the cache object *and* perform the cached-value lookup
    inside the decorated function.
    """
    func_hasher = hashlib.new("md5")

    # Include the function's __module__ and __qualname__ strings in the hash.
    # This means that two identical functions in different modules
    # will not share a hash; it also means that two identical *nested*
    # functions in the same module will not share a hash.
    update_hash(
        (func.__module__, func.__qualname__),
        hasher=func_hasher,
        hash_reason=HashReason.CACHING_FUNC_BODY,
        hash_source=func,
    )

    # Include the function's source code in its hash. If the source code can't
    # be retrieved, fall back to the function's bytecode instead.
    source_code: Union[str, types.CodeType]
    try:
        source_code = inspect.getsource(func)
    except OSError as e:
        _LOGGER.debug(
            "Failed to retrieve function's source code when building its key; falling back to bytecode. err={0}",
            e,
        )
        source_code = func.__code__

    update_hash(
        source_code,
        hasher=func_hasher,
        hash_reason=HashReason.CACHING_FUNC_BODY,
        hash_source=func,
    )

    cache_key = func_hasher.hexdigest()
    return cache_key


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

        # The reason why we're doing this hashing, for debug purposes.
        self.hash_reason: Optional[HashReason] = None

        # Either a function or a code block, depending on whether the reason is
        # due to hashing part of a function (i.e. body, args, output) or an
        # st.Cache codeblock.
        self.hash_source: Optional[Callable[..., Any]] = None

    def __repr__(self) -> str:
        return util.repr_(self)

    def push(self, val: Any):
        self._stack[id(val)] = val

    def pop(self):
        self._stack.popitem()

    def __contains__(self, val: Any):
        return id(val) in self._stack

    def pretty_print(self):
        def to_str(v):
            try:
                return "Object of type %s: %s" % (type_util.get_fqn_type(v), str(v))
            except:
                return "<Unable to convert item to string>"

        # IDEA: Maybe we should remove our internal "hash_funcs" from the
        # stack. I'm not removing those now because even though those aren't
        # useful to users I think they might be useful when we're debugging an
        # issue sent by a user. So let's wait a few months and see if they're
        # indeed useful...
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

    return NoResult


class _SafeHasher:
    """A hasher that can hash objects with cycles."""

    def __init__(self):
        self._hashes: Dict[Any, bytes] = {}

        # The number of the bytes in the hash.
        self.size = 0

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

        except (UnhashableTypeError, UserHashError, InternalHashError):
            # Re-raise exceptions we hand-raise internally.
            raise

        except BaseException as e:
            raise InternalHashError(e, obj)

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

        if isinstance(obj, unittest.mock.Mock):
            # Mock objects can appear to be infinitely
            # deep, so we don't try to hash them at all.
            return self.to_bytes(id(obj))

        elif isinstance(obj, bytes) or isinstance(obj, bytearray):
            return obj

        elif isinstance(obj, str):
            return obj.encode()

        elif isinstance(obj, float):
            return self.to_bytes(hash(obj))

        elif isinstance(obj, int):
            return _int_to_bytes(obj)

        elif isinstance(obj, (list, tuple)):
            h = hashlib.new("md5")
            for item in obj:
                self.update(h, item)
            return h.digest()

        elif isinstance(obj, dict):
            h = hashlib.new("md5")
            for item in obj.items():
                self.update(h, item)
            return h.digest()

        elif obj is None:
            return b"0"

        elif obj is True:
            return b"1"

        elif obj is False:
            return b"0"

        elif type_util.is_type(obj, "pandas.core.frame.DataFrame") or type_util.is_type(
            obj, "pandas.core.series.Series"
        ):
            import pandas as pd

            if len(obj) >= _PANDAS_ROWS_LARGE:
                obj = obj.sample(n=_PANDAS_SAMPLE_SIZE, random_state=0)
            try:
                return b"%s" % pd.util.hash_pandas_object(obj).sum()
            except TypeError:
                # Use pickle if pandas cannot hash the object for example if
                # it contains unhashable objects.
                return b"%s" % pickle.dumps(obj, pickle.HIGHEST_PROTOCOL)

        elif type_util.is_type(obj, "numpy.ndarray"):
            h = hashlib.new("md5")
            self.update(h, obj.shape)

            if obj.size >= _NP_SIZE_LARGE:
                import numpy as np

                state = np.random.RandomState(0)
                obj = state.choice(obj.flat, size=_NP_SAMPLE_SIZE)

            self.update(h, obj.tobytes())
            return h.digest()

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
            # temproary files
            h = hashlib.new("md5")
            self.update(h, obj.name)
            self.update(h, obj.tell())
            self.update(h, obj.getvalue())
            return h.digest()

        elif hasattr(obj, "name") and (
            isinstance(obj, io.IOBase)
            # Handle temporary files used during testing
            or isinstance(obj, tempfile._TemporaryFileWrapper)  # type: ignore[attr-defined]
        ):
            # Hash files as name + last modification date + offset.
            # NB: we're using hasattr("name") to differentiate between
            # on-disk and in-memory StringIO/BytesIO file representations.
            # That means that this condition must come *before* the next
            # condition, which just checks for StringIO/BytesIO.
            h = hashlib.new("md5")
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
            h = hashlib.new("md5")
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
            h = hashlib.new("md5")
            self.update(h, obj.args)
            self.update(h, obj.func)
            self.update(h, obj.keywords)
            return h.digest()

        else:
            # As a last resort, hash the output of the object's __reduce__ method
            h = hashlib.new("md5")
            try:
                reduce_data = obj.__reduce__()
            except BaseException as e:
                raise UnhashableTypeError(obj) from e

            for item in reduce_data:
                self.update(h, item)
            return h.digest()


class NoResult:
    """Placeholder class for return values when None is meaningful."""

    pass


class UnhashableTypeError(StreamlitAPIException):
    """Raised when we're unable to hash an object."""

    def __init__(self, failed_obj: Any):
        super(UnhashableTypeError, self).__init__()
        self.failed_obj = failed_obj


class UserHashError(StreamlitAPIException):
    """Raised when get_referenced_objects fails. TODO rename this."""

    def __init__(self, orig_exc, cached_func_or_code, lineno=None):
        self.alternate_name = type(orig_exc).__name__

        msg = self._get_message_from_code(orig_exc, cached_func_or_code, lineno)

        super(UserHashError, self).__init__(msg)
        self.with_traceback(orig_exc.__traceback__)

    def _get_message_from_code(self, orig_exc: BaseException, cached_code, lineno: int):
        args = _get_error_message_args(orig_exc, cached_code)

        failing_lines = _get_failing_lines(cached_code, lineno)
        failing_lines_str = "".join(failing_lines)
        failing_lines_str = textwrap.dedent(failing_lines_str).strip("\n")

        args["failing_lines_str"] = failing_lines_str
        args["filename"] = cached_code.co_filename
        args["lineno"] = lineno

        # This needs to have zero indentation otherwise %(lines_str)s will
        # render incorrectly in Markdown.
        return (
            """
%(orig_exception_desc)s

Streamlit encountered an error while caching %(object_part)s %(object_desc)s.
This is likely due to a bug in `%(filename)s` near line `%(lineno)s`:

```
%(failing_lines_str)s
```

Please modify the code above to address this.

If you think this is actually a Streamlit bug, you may [file a bug report
here.] (https://github.com/streamlit/streamlit/issues/new/choose)
        """
            % args
        ).strip("\n")


class InternalHashError(MarkdownFormattedException):
    """Exception in Streamlit hashing code (i.e. not a user error). If
    this exception is thrown, it means there's a bug in Streamlit!
    """

    def __init__(self, orig_exc: BaseException, failed_obj: Any):
        msg = self._get_message(orig_exc, failed_obj)
        super(InternalHashError, self).__init__(msg)
        self.with_traceback(orig_exc.__traceback__)

    def _get_message(self, orig_exc: BaseException, failed_obj: Any) -> str:
        args = _get_error_message_args(orig_exc, failed_obj)

        # This needs to have zero indentation otherwise %(hash_stack)s will
        # render incorrectly in Markdown.
        return (
            """
%(orig_exception_desc)s

While caching %(object_part)s %(object_desc)s, Streamlit encountered an
object of type `%(failed_obj_type_str)s`, which it does not know how to hash.

**In this specific case, it's very likely you found a Streamlit bug so please
[file a bug report here.]
(https://github.com/streamlit/streamlit/issues/new/choose)**

In the meantime, you can try bypassing this error by registering a custom
hash function via the `hash_funcs` keyword in @st.cache(). For example:

```
@st.cache(hash_funcs={%(failed_obj_type_str)s: my_hash_func})
def my_func(...):
    ...
```

If you don't know where the object of type `%(failed_obj_type_str)s` is coming
from, try looking at the hash chain below for an object that you do recognize,
then pass that to `hash_funcs` instead:

```
%(hash_stack)s
```

Please see the `hash_funcs` [documentation]
(https://docs.streamlit.io/en/stable/caching.html#the-hash-funcs-parameter)
for more details.
            """
            % args
        ).strip("\n")


def _get_error_message_args(orig_exc: BaseException, failed_obj: Any) -> Dict[str, Any]:
    hash_reason = hash_stacks.current.hash_reason
    hash_source = hash_stacks.current.hash_source

    failed_obj_type_str = type_util.get_fqn_type(failed_obj)

    if hash_source is None or hash_reason is None:
        object_desc = "something"
        object_part = ""
        additional_explanation = ""

    elif hash_reason is HashReason.CACHING_BLOCK:
        object_desc = "a code block"
        object_part = ""
        additional_explanation = ""

    else:
        if hasattr(hash_source, "__name__"):
            object_desc = "`%s()`" % hash_source.__name__
            object_desc_specific = object_desc
        else:
            object_desc = "a function"
            object_desc_specific = "that function"

        if hash_reason is HashReason.CACHING_FUNC_ARGS:
            object_part = "the arguments of"
        elif hash_reason is HashReason.CACHING_FUNC_BODY:
            object_part = "the body of"
        elif hash_reason is HashReason.CACHING_FUNC_OUTPUT:
            object_part = "the return value of"

    return {
        "orig_exception_desc": str(orig_exc),
        "failed_obj_type_str": failed_obj_type_str,
        "hash_stack": hash_stacks.current.pretty_print(),
        "object_desc": object_desc,
        "object_part": object_part,
    }


def _get_failing_lines(code, lineno: int) -> List[str]:
    """Get list of strings (lines of code) from lineno to lineno+3.

    Ideally we'd return the exact line where the error took place, but there
    are reasons why this is not possible without a lot of work, including
    playing with the AST. So for now we're returning 3 lines near where
    the error took place.
    """
    source_lines, source_lineno = inspect.getsourcelines(code)

    start = lineno - source_lineno
    end = min(start + 3, len(source_lines))
    lines = source_lines[start:end]

    return lines
