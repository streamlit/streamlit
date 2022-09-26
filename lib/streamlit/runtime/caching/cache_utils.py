# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

"""Common cache logic shared by st.memo and st.singleton."""

import contextlib
import functools
import hashlib
import inspect
import threading
import types
from abc import abstractmethod
from dataclasses import dataclass
from typing import (
    TYPE_CHECKING,
    Callable,
    Dict,
    List,
    Iterator,
    Set,
    Tuple,
    Optional,
    Any,
    Union,
)

from google.protobuf.message import Message

import streamlit as st
from streamlit import util
from streamlit.runtime.caching.cache_errors import CacheKeyNotFoundError
from streamlit.elements import NONWIDGET_ELEMENTS
from streamlit.logger import get_logger
from streamlit.proto.Block_pb2 import Block
from streamlit.runtime.caching.cache_errors import (
    CacheReplayClosureError,
    CacheType,
    CachedStFunctionWarning,
    UnhashableParamError,
    UnhashableTypeError,
)
from streamlit.runtime.caching.hashing import update_hash

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

_LOGGER = get_logger(__name__)


@dataclass
class ElementMsgData:
    """A non-interactive element's message and related metadata for
    replaying that element's function call.
    """

    delta_type: str
    message: Message
    id_of_dg_called_on: str
    returned_dgs_id: str


@dataclass
class BlockMsgData:
    message: Block
    id_of_dg_called_on: str
    returned_dgs_id: str


MsgData = Union[ElementMsgData, BlockMsgData]


@dataclass
class CachedResult:
    """The full results of calling a cache-decorated function, enough to
    replay the st functions called while executing it.
    """

    value: Any
    messages: List[MsgData]
    main_id: str
    sidebar_id: str


class Cache:
    """Function cache interface. Caches persist across script runs."""

    @abstractmethod
    def read_result(self, value_key: str) -> CachedResult:
        """Read a value and associated messages from the cache.

        Raises
        ------
        CacheKeyNotFoundError
            Raised if value_key is not in the cache.

        """
        raise NotImplementedError

    @abstractmethod
    def write_result(self, value_key: str, value: Any, messages: List[MsgData]) -> None:
        """Write a value and associated messages to the cache, overwriting any existing
        result that uses the value_key.
        """
        raise NotImplementedError

    @abstractmethod
    def clear(self) -> None:
        """Clear all values from this function cache."""
        raise NotImplementedError


class CachedFunction:
    """Encapsulates data for a cached function instance.

    CachedFunction instances are scoped to a single script run - they're not
    persistent.
    """

    def __init__(
        self, func: types.FunctionType, show_spinner: bool, suppress_st_warning: bool
    ):
        self.func = func
        self.show_spinner = show_spinner
        self.suppress_st_warning = suppress_st_warning

    @property
    def cache_type(self) -> CacheType:
        raise NotImplementedError

    @property
    def warning_call_stack(self) -> "CacheWarningCallStack":
        raise NotImplementedError

    @property
    def message_call_stack(self) -> "CacheMessagesCallStack":
        raise NotImplementedError

    def get_function_cache(self, function_key: str) -> Cache:
        """Get or create the function cache for the given key."""
        raise NotImplementedError


def replay_result_messages(
    result: CachedResult, cache_type: CacheType, cached_func: types.FunctionType
) -> None:
    """Replay the st element function calls that happened when executing a
    cache-decorated function.

    When a cache function is executed, we record the element and block messages
    produced, and use those to reproduce the DeltaGenerator calls, so the elements
    will appear in the web app even when execution of the function is skipped
    because the result was cached.

    To make this work, for each st function call we record an identifier for the
    DG it was effectively called on (see Note [DeltaGenerator method invocation]).
    We also record the identifier for each DG returned by an st function call, if
    it returns one. Then, for each recorded message, we get the current DG instance
    corresponding to the DG the message was originally called on, and enqueue the
    message using that, recording any new DGs produced in case a later st function
    call is on one of them.
    """
    from streamlit.delta_generator import DeltaGenerator

    # Maps originally recorded dg ids to this script run's version of that dg
    returned_dgs: Dict[str, DeltaGenerator] = {}
    returned_dgs[result.main_id] = st._main
    returned_dgs[result.sidebar_id] = st.sidebar

    try:
        for msg in result.messages:
            if isinstance(msg, ElementMsgData):
                dg = returned_dgs[msg.id_of_dg_called_on]
                maybe_dg = dg._enqueue(msg.delta_type, msg.message)
                if isinstance(maybe_dg, DeltaGenerator):
                    returned_dgs[msg.returned_dgs_id] = maybe_dg
            elif isinstance(msg, BlockMsgData):
                dg = returned_dgs[msg.id_of_dg_called_on]
                new_dg = dg._block(msg.message)
                returned_dgs[msg.returned_dgs_id] = new_dg
    except KeyError:
        raise CacheReplayClosureError(cache_type, cached_func)


def create_cache_wrapper(cached_func: CachedFunction) -> Callable[..., Any]:
    """Create a wrapper for a CachedFunction. This implements the common
    plumbing for both st.memo and st.singleton.
    """
    func = cached_func.func
    function_key = _make_function_key(cached_func.cache_type, func)

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        """This function wrapper will only call the underlying function in
        the case of a cache miss.
        """

        # Retrieve the function's cache object. We must do this inside the
        # wrapped function, because caches can be invalidated at any time.
        cache = cached_func.get_function_cache(function_key)

        name = func.__qualname__

        if len(args) == 0 and len(kwargs) == 0:
            message = f"Running `{name}()`."
        else:
            message = f"Running `{name}(...)`."

        def get_or_create_cached_value():
            # Generate the key for the cached value. This is based on the
            # arguments passed to the function.
            value_key = _make_value_key(cached_func.cache_type, func, *args, **kwargs)

            try:
                result = cache.read_result(value_key)
                _LOGGER.debug("Cache hit: %s", func)

                replay_result_messages(result, cached_func.cache_type, func)

                return_value = result.value

            except CacheKeyNotFoundError:
                _LOGGER.debug("Cache miss: %s", func)

                with cached_func.warning_call_stack.calling_cached_function(
                    func
                ), cached_func.message_call_stack.calling_cached_function():
                    if cached_func.suppress_st_warning:
                        with cached_func.warning_call_stack.suppress_cached_st_function_warning():
                            return_value = func(*args, **kwargs)
                    else:
                        return_value = func(*args, **kwargs)

                messages = cached_func.message_call_stack._most_recent_messages
                cache.write_result(value_key, return_value, messages)

            return return_value

        if cached_func.show_spinner:
            with st.spinner(message):
                return get_or_create_cached_value()
        else:
            return get_or_create_cached_value()

    def clear():
        """Clear the wrapped function's associated cache."""
        cache = cached_func.get_function_cache(function_key)
        cache.clear()

    # Mypy doesn't support declaring attributes of function objects,
    # so we have to suppress a warning here. We can remove this suppression
    # when this issue is resolved: https://github.com/python/mypy/issues/2087
    wrapper.clear = clear  # type: ignore

    return wrapper


class CacheWarningCallStack(threading.local):
    """A utility for warning users when they call `st` commands inside
    a cached function. Internally, this is just a counter that's incremented
    when we enter a cache function, and decremented when we exit.

    Data is stored in a thread-local object, so it's safe to use an instance
    of this class across multiple threads.
    """

    def __init__(self, cache_type: CacheType):
        self._cached_func_stack: List[types.FunctionType] = []
        self._suppress_st_function_warning = 0
        self._cache_type = cache_type

    def __repr__(self) -> str:
        return util.repr_(self)

    @contextlib.contextmanager
    def calling_cached_function(self, func: types.FunctionType) -> Iterator[None]:
        self._cached_func_stack.append(func)
        try:
            yield
        finally:
            self._cached_func_stack.pop()

    @contextlib.contextmanager
    def suppress_cached_st_function_warning(self) -> Iterator[None]:
        self._suppress_st_function_warning += 1
        try:
            yield
        finally:
            self._suppress_st_function_warning -= 1
            assert self._suppress_st_function_warning >= 0

    def maybe_show_cached_st_function_warning(
        self,
        dg: "st.delta_generator.DeltaGenerator",
        st_func_name: str,
    ) -> None:
        """If appropriate, warn about calling st.foo inside @memo.

        DeltaGenerator's @_with_element and @_widget wrappers use this to warn
        the user when they're calling st.foo() from within a function that is
        wrapped in @st.cache.

        Parameters
        ----------
        dg : DeltaGenerator
            The DeltaGenerator to publish the warning to.

        st_func_name : str
            The name of the Streamlit function that was called.

        """
        if st_func_name in NONWIDGET_ELEMENTS:
            return
        if len(self._cached_func_stack) > 0 and self._suppress_st_function_warning <= 0:
            cached_func = self._cached_func_stack[-1]
            self._show_cached_st_function_warning(dg, st_func_name, cached_func)

    def _show_cached_st_function_warning(
        self,
        dg: "st.delta_generator.DeltaGenerator",
        st_func_name: str,
        cached_func: types.FunctionType,
    ) -> None:
        # Avoid infinite recursion by suppressing additional cached
        # function warnings from within the cached function warning.
        with self.suppress_cached_st_function_warning():
            e = CachedStFunctionWarning(self._cache_type, st_func_name, cached_func)
            dg.exception(e)


"""
Note [DeltaGenerator method invocation]
There are two top level DG instances defined for all apps:
`main`, which is for putting elements in the main part of the app
`sidebar`, for the sidebar

There are 3 different ways an st function can be invoked:
1. Implicitly on the main DG instance (plain `st.foo` calls)
2. Implicitly in an active contextmanager block (`st.foo` within a `with st.container` context)
3. Explicitly on a DG instance (`st.sidebar.foo`, `my_column_1.foo`)

To simplify replaying messages from a cached function result, we convert all of these
to explicit invocations. How they get rewritten depends on if the invocation was
implicit vs explicit, and if the target DG has been seen/produced during replay.

Implicit invocation on a known DG -> Explicit invocation on that DG
Implicit invocation on an unknown DG -> Rewrite as explicit invocation on main
    with st.container():
        my_cache_decorated_function()

    This is situation 2 above, and the DG is a block entirely outside our function call,
    so we interpret it as "put this element in the enclosing contextmanager block"
    (or main if there isn't one), which is achieved by invoking on main.
Explicit invocation on a known DG -> No change needed
Explicit invocation on an unknown DG -> Raise an error
    We have no way to identify the target DG, and it may not even be present in the
    current script run, so the least surprising thing to do is raise an error.

"""


class CacheMessagesCallStack(threading.local):
    """A utility for storing messages generated by `st` commands called inside
    a cached function.

    Data is stored in a thread-local object, so it's safe to use an instance
    of this class across multiple threads.
    """

    def __init__(self, cache_type: CacheType):
        self._cached_message_stack: List[List[MsgData]] = []
        self._seen_dg_stack: List[Set[str]] = []
        self._most_recent_messages: List[MsgData] = []
        self._cache_type = cache_type

    def __repr__(self) -> str:
        return util.repr_(self)

    @contextlib.contextmanager
    def calling_cached_function(self) -> Iterator[None]:
        self._cached_message_stack.append([])
        self._seen_dg_stack.append(set())
        try:
            yield
        finally:
            self._most_recent_messages = self._cached_message_stack.pop()
            self._seen_dg_stack.pop()

    def save_element_message(
        self,
        delta_type: str,
        element_proto: Message,
        invoked_dg_id: str,
        used_dg_id: str,
        returned_dg_id: str,
    ) -> None:
        """Record the element protobuf as having been produced during any currently
        executing cached functions, so they can be replayed any time the function's
        execution is skipped because they're in the cache.
        """
        id_to_save = self.select_dg_to_save(invoked_dg_id, used_dg_id)
        for msgs in self._cached_message_stack:
            msgs.append(
                ElementMsgData(delta_type, element_proto, id_to_save, returned_dg_id)
            )
        for s in self._seen_dg_stack:
            s.add(returned_dg_id)

    def save_block_message(
        self,
        block_proto: Block,
        invoked_dg_id: str,
        used_dg_id: str,
        returned_dg_id: str,
    ) -> None:
        id_to_save = self.select_dg_to_save(invoked_dg_id, used_dg_id)
        for msgs in self._cached_message_stack:
            msgs.append(BlockMsgData(block_proto, id_to_save, returned_dg_id))
        for s in self._seen_dg_stack:
            s.add(returned_dg_id)

    def select_dg_to_save(self, invoked_id: str, acting_on_id: str) -> str:
        """Select the id of the DG that this message should be invoked on
        during message replay.

        See Note [DeltaGenerator method invocation]

        invoked_id is the DG the st function was called on, usually `st._main`.
        acting_on_id is the DG the st function ultimately runs on, which may be different
        if the invoked DG delegated to another one because it was in a `with` block.
        """
        if len(self._seen_dg_stack) > 0 and acting_on_id in self._seen_dg_stack[-1]:
            return acting_on_id
        else:
            return invoked_id


def _make_value_key(
    cache_type: CacheType, func: types.FunctionType, *args, **kwargs
) -> str:
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
                cache_type=cache_type,
            )
        except UnhashableTypeError as exc:
            raise UnhashableParamError(cache_type, func, arg_name, arg_value, exc)

    value_key = args_hasher.hexdigest()
    _LOGGER.debug("Cache key: %s", value_key)

    return value_key


def _make_function_key(cache_type: CacheType, func: types.FunctionType) -> str:
    """Create the unique key for a function's cache.

    A function's key is stable across reruns of the app, and changes when
    the function's source code changes.
    """
    func_hasher = hashlib.new("md5")

    # Include the function's __module__ and __qualname__ strings in the hash.
    # This means that two identical functions in different modules
    # will not share a hash; it also means that two identical *nested*
    # functions in the same module will not share a hash.
    update_hash(
        (func.__module__, func.__qualname__),
        hasher=func_hasher,
        cache_type=cache_type,
    )

    # Include the function's source code in its hash. If the source code can't
    # be retrieved, fall back to the function's bytecode instead.
    source_code: Union[str, bytes]
    try:
        source_code = inspect.getsource(func)
    except OSError as e:
        _LOGGER.debug(
            "Failed to retrieve function's source code when building its key; falling back to bytecode. err={0}",
            e,
        )
        source_code = func.__code__.co_code

    update_hash(
        source_code,
        hasher=func_hasher,
        cache_type=cache_type,
    )

    cache_key = func_hasher.hexdigest()
    return cache_key


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
