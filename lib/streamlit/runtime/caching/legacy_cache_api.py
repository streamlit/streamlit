# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""A library of caching utilities."""

from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING, Any, TypeVar

from streamlit import deprecation_util
from streamlit.runtime.caching import CACHE_DOCS_URL
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.runtime.caching.hashing import HashFuncsDict

# Type-annotate the decorator function.
# (See https://mypy.readthedocs.io/en/stable/generics.html#decorator-factories)
F = TypeVar("F", bound=Callable[..., Any])


@gather_metrics("cache")
def cache(
    func: F | None = None,
    persist: bool = False,
    allow_output_mutation: bool = False,
    show_spinner: bool = True,
    suppress_st_warning: bool = False,  # noqa: ARG001
    hash_funcs: HashFuncsDict | None = None,
    max_entries: int | None = None,
    ttl: float | None = None,
) -> F:
    """Legacy caching decorator (deprecated).

    Legacy caching with ``st.cache`` has been removed from Streamlit. This is
    now an alias for ``st.cache_data`` and ``st.cache_resource``.

    Parameters
    ----------
    func : callable
        The function to cache. Streamlit hashes the function's source code.

    persist : bool
        Whether to persist the cache on disk.

    allow_output_mutation : bool
        Whether to use ``st.cache_data`` or ``st.cache_resource``. If this is
        ``False`` (default), the arguments are passed to ``st.cache_data``. If
        this is ``True``, the arguments are passed to ``st.cache_resource``.

    show_spinner : bool
        Enable the spinner. Default is ``True`` to show a spinner when there is
        a "cache miss" and the cached data is being created.

    suppress_st_warning : bool
        This is not used.

    hash_funcs : dict or None
        Mapping of types or fully qualified names to hash functions. This is used to
        override the behavior of the hasher inside Streamlit's caching mechanism: when
        the hasher encounters an object, it will first check to see if its type matches
        a key in this dict and, if so, will use the provided function to generate a hash
        for it. See below for an example of how this can be used.

    max_entries : int or None
        The maximum number of entries to keep in the cache, or ``None``
        for an unbounded cache. (When a new entry is added to a full cache,
        the oldest cached entry will be removed.) The default is ``None``.

    ttl : float or None
        The maximum number of seconds to keep an entry in the cache, or
        None if cache entries should not expire. The default is None.

    Example
    -------
    >>> import streamlit as st
    >>>
    >>> @st.cache
    ... def fetch_and_clean_data(url):
    ...     # Fetch data from URL here, and then clean it up.
    ...     return data
    >>>
    >>> d1 = fetch_and_clean_data(DATA_URL_1)
    >>> # Actually executes the function, since this is the first time it was
    >>> # encountered.
    >>>
    >>> d2 = fetch_and_clean_data(DATA_URL_1)
    >>> # Does not execute the function. Instead, returns its previously computed
    >>> # value. This means that now the data in d1 is the same as in d2.
    >>>
    >>> d3 = fetch_and_clean_data(DATA_URL_2)
    >>> # This is a different URL, so the function executes.

    To set the ``persist`` parameter, use this command as follows:

    >>> @st.cache(persist=True)
    ... def fetch_and_clean_data(url):
    ...     # Fetch data from URL here, and then clean it up.
    ...     return data

    To disable hashing return values, set the ``allow_output_mutation`` parameter to
    ``True``:

    >>> @st.cache(allow_output_mutation=True)
    ... def fetch_and_clean_data(url):
    ...     # Fetch data from URL here, and then clean it up.
    ...     return data


    To override the default hashing behavior, pass a custom hash function.
    You can do that by mapping a type (e.g. ``MongoClient``) to a hash function (``id``)
    like this:

    >>> @st.cache(hash_funcs={MongoClient: id})
    ... def connect_to_database(url):
    ...     return MongoClient(url)

    Alternatively, you can map the type's fully-qualified name
    (e.g. ``"pymongo.mongo_client.MongoClient"``) to the hash function instead:

    >>> @st.cache(hash_funcs={"pymongo.mongo_client.MongoClient": id})
    ... def connect_to_database(url):
    ...     return MongoClient(url)

    """
    import streamlit as st

    deprecation_util.show_deprecation_warning(
        f"""
`st.cache` is deprecated and will be removed soon. Please use one of Streamlit's new
caching commands, `st.cache_data` or `st.cache_resource`. More information
[in our docs]({CACHE_DOCS_URL}).

**Note**: The behavior of `st.cache` was updated in Streamlit 1.36 to the new caching
logic used by `st.cache_data` and `st.cache_resource`. This might lead to some problems
or unexpected behavior in certain edge cases.
"""
    )

    # suppress_st_warning is unused since its not supported by the new caching commands

    if allow_output_mutation:
        return st.cache_resource(  # type: ignore
            func,
            show_spinner=show_spinner,
            hash_funcs=hash_funcs,
            max_entries=max_entries,
            ttl=ttl,
        )

    return st.cache_data(  # type: ignore
        func,
        persist=persist,
        show_spinner=show_spinner,
        hash_funcs=hash_funcs,
        max_entries=max_entries,
        ttl=ttl,
    )
