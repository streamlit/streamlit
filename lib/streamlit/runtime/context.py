# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from __future__ import annotations

from collections.abc import Iterable, Iterator, Mapping
from functools import lru_cache
from types import MappingProxyType
from typing import TYPE_CHECKING, Any, Literal

from streamlit import runtime
from streamlit.runtime.context_util import maybe_add_page_path, maybe_trim_page_path
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.util import AttributeDictionary

if TYPE_CHECKING:
    from http.cookies import Morsel

    from tornado.httputil import HTTPHeaders

    from streamlit.runtime.session_manager import ClientContext


def _get_client_context() -> ClientContext | None:
    """Get the ClientContext for the current session.

    Returns the client context from the session client if available,
    or None if not available (e.g., no active session or the session
    client doesn't provide a client context).
    """
    ctx = get_script_run_ctx()
    if ctx is None:
        return None

    session_client = runtime.get_instance().get_client(ctx.session_id)
    if session_client is None:
        return None

    return session_client.client_context


@lru_cache
def _normalize_header(name: str) -> str:
    """Map a header name to Http-Header-Case.

    >>> _normalize_header("coNtent-TYPE")
    'Content-Type'
    """
    return "-".join(w.capitalize() for w in name.split("-"))


class StreamlitTheme(AttributeDictionary):
    """A dictionary-like object containing theme information.

    This class extends the functionality of a standard dictionary to allow items
    to be accessed via attribute-style dot notation in addition to the traditional
    key-based access. If a dictionary item is accessed and is itself a dictionary,
    it is automatically wrapped in another `AttributeDictionary`, enabling recursive
    attribute-style access.
    """

    type: Literal["dark", "light"] | None

    def __init__(self, theme_info: dict[str, str | None]):
        super().__init__(theme_info)

    @classmethod
    def from_context_info(cls, context_dict: dict[str, str | None]) -> StreamlitTheme:
        return cls(context_dict)


class StreamlitHeaders(Mapping[str, str]):
    def __init__(self, headers: Iterable[tuple[str, str]]) -> None:
        dict_like_headers: dict[str, list[str]] = {}

        for key, value in headers:
            header_value = dict_like_headers.setdefault(_normalize_header(key), [])
            header_value.append(value)

        self._headers = dict_like_headers

    @classmethod
    def from_tornado_headers(cls, tornado_headers: HTTPHeaders) -> StreamlitHeaders:
        return cls(tornado_headers.get_all())

    def get_all(self, key: str) -> list[str]:
        return list(self._headers.get(_normalize_header(key), []))

    def __getitem__(self, key: str) -> str:
        try:
            return self._headers[_normalize_header(key)][0]
        except LookupError:
            raise KeyError(key) from None

    def __len__(self) -> int:
        """Number of unique headers present in request."""
        return len(self._headers)

    def __iter__(self) -> Iterator[str]:
        return iter(self._headers)

    def to_dict(self) -> dict[str, str]:
        return {key: self[key] for key in self}


class StreamlitCookies(Mapping[str, str]):
    def __init__(self, cookies: Mapping[str, str]) -> None:
        self._cookies = MappingProxyType(cookies)

    @classmethod
    def from_tornado_cookies(
        cls, tornado_cookies: dict[str, Morsel[Any]]
    ) -> StreamlitCookies:
        dict_like_cookies = {}
        for key, morsel in tornado_cookies.items():
            dict_like_cookies[key] = morsel.value
        return cls(dict_like_cookies)

    def __getitem__(self, key: str) -> str:
        return self._cookies[key]

    def __len__(self) -> int:
        """Number of unique headers present in request."""
        return len(self._cookies)

    def __iter__(self) -> Iterator[str]:
        return iter(self._cookies)

    def to_dict(self) -> dict[str, str]:
        return dict(self._cookies)


class ContextProxy:
    """An interface to access user session context.

    ``st.context`` provides a read-only interface to access headers and cookies
    for the current user session.

    Each property (``st.context.headers`` and ``st.context.cookies``) returns
    a dictionary of named values.

    """

    @property
    @gather_metrics("context.headers")
    def headers(self) -> StreamlitHeaders:
        """A read-only, dict-like object containing headers sent in the initial request.

        Keys are case-insensitive and may be repeated. When keys are repeated,
        dict-like methods will only return the last instance of each key. Use
        ``.get_all(key="your_repeated_key")`` to see all values if the same
        header is set multiple times.

        Examples
        --------
        **Example 1: Access all available headers**

        Show a dictionary of headers (with only the last instance of any
        repeated key):

        >>> import streamlit as st
        >>>
        >>> st.context.headers

        **Example 2: Access a specific header**

        Show the value of a specific header (or the last instance if it's
        repeated):

        >>> import streamlit as st
        >>>
        >>> st.context.headers["host"]

        Show of list of all headers for a given key:

        >>> import streamlit as st
        >>>
        >>> st.context.headers.get_all("pragma")

        """
        # We have a docstring in line above as one-liner, to have a correct docstring
        # in the st.write(st,context) call.
        client_context = _get_client_context()

        if client_context is None:
            return StreamlitHeaders({})

        return StreamlitHeaders(client_context.headers)

    @property
    @gather_metrics("context.cookies")
    def cookies(self) -> StreamlitCookies:
        """A read-only, dict-like object containing cookies sent in the initial request.

        Examples
        --------
        **Example 1: Access all available cookies**

        Show a dictionary of cookies:

        >>> import streamlit as st
        >>>
        >>> st.context.cookies

        **Example 2: Access a specific cookie**

        Show the value of a specific cookie:

        >>> import streamlit as st
        >>>
        >>> st.context.cookies["_ga"]

        """
        # We have a docstring in line above as one-liner, to have a correct docstring
        # in the st.write(st,context) call.
        client_context = _get_client_context()

        if client_context is None:
            return StreamlitCookies({})

        return StreamlitCookies(client_context.cookies)

    @property
    @gather_metrics("context.theme")
    def theme(self) -> StreamlitTheme:
        """A read-only, dictionary-like object containing theme information.

        Theme information is restricted to the ``type`` of the theme (dark or
        light) and is inferred from the background color of the app.

        .. note::
            Changes made to the background color through CSS are not included.
            Additionally, the theme type may be incorrect during a change in
            theme, like in the following situations:

            - When the app is first loaded within a session
            - When the user changes the theme in the settings menu

            For more information and to upvote an improvement, see GitHub issue
            `#11920 <https://github.com/streamlit/streamlit/issues/11920>`_.

        Attributes
        ----------
        type : "light", "dark"
            The theme type inferred from the background color of the app.

        Example
        -------
        Access the theme type of the app:

        >>> import streamlit as st
        >>>
        >>> st.write(f"The current theme type is {st.context.theme.type}.")

        """
        ctx = get_script_run_ctx()

        if ctx is None or ctx.context_info is None:
            return StreamlitTheme({"type": None})

        return StreamlitTheme.from_context_info({"type": ctx.context_info.color_scheme})

    @property
    @gather_metrics("context.timezone")
    def timezone(self) -> str | None:
        """The read-only timezone of the user's browser.

        Example
        -------
        Access the user's timezone, and format a datetime to display locally:

        >>> import streamlit as st
        >>> from datetime import datetime, timezone
        >>> import pytz
        >>>
        >>> tz = st.context.timezone
        >>> tz_obj = pytz.timezone(tz)
        >>>
        >>> now = datetime.now(timezone.utc)
        >>>
        >>> f"The user's timezone is {tz}."
        >>> f"The UTC time is {now}."
        >>> f"The user's local time is {now.astimezone(tz_obj)}"

        """
        ctx = get_script_run_ctx()

        if ctx is None or ctx.context_info is None:
            return None
        return ctx.context_info.timezone

    @property
    @gather_metrics("context.timezone_offset")
    def timezone_offset(self) -> int | None:
        """The read-only timezone offset of the user's browser.

        Example
        -------
        Access the user's timezone offset, and format a datetime to display locally:

        >>> import streamlit as st
        >>> from datetime import datetime, timezone, timedelta
        >>>
        >>> tzoff = st.context.timezone_offset
        >>> tz_obj = timezone(-timedelta(minutes=tzoff))
        >>>
        >>> now = datetime.now(timezone.utc)
        >>>
        >>> f"The user's timezone is {tz}."
        >>> f"The UTC time is {now}."
        >>> f"The user's local time is {now.astimezone(tz_obj)}"

        """
        ctx = get_script_run_ctx()
        if ctx is None or ctx.context_info is None:
            return None
        return ctx.context_info.timezone_offset

    @property
    @gather_metrics("context.locale")
    def locale(self) -> str | None:
        """The read-only locale of the user's browser.

        ``st.context.locale`` returns the value of |navigator.language|_ from
        the user's DOM. This is a string representing the user's preferred
        language (e.g. "en-US").

        .. |navigator.language| replace:: ``navigator.language``
        .. _navigator.language: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language

        Example
        -------
        Access the user's locale to display locally:

        >>> import streamlit as st
        >>>
        >>> if st.context.locale == "fr-FR":
        >>>     st.write("Bonjour!")
        >>> else:
        >>>     st.write("Hello!")

        """
        ctx = get_script_run_ctx()
        if ctx is None or ctx.context_info is None:
            return None
        return ctx.context_info.locale

    @property
    @gather_metrics("context.url")
    def url(self) -> str | None:
        """The read-only URL of the app in the user's browser.

        ``st.context.url`` returns the URL through which the user is accessing
        the app. This includes the scheme, domain name, port, and path. If
        query parameters or anchors are present in the URL, they are removed
        and not included in this value.

        Example
        -------
        Conditionally show content when you access your app through
        ``localhost``:

        >>> import streamlit as st
        >>>
        >>> if st.context.url.startswith("http://localhost"):
        >>>     st.write("You are running the app locally.")
        """
        ctx = get_script_run_ctx()
        if ctx is None or ctx.context_info is None:
            return None

        url_from_frontend = ctx.context_info.url
        url_without_page_prefix = maybe_trim_page_path(
            url_from_frontend, ctx.pages_manager
        )
        return maybe_add_page_path(url_without_page_prefix, ctx.pages_manager)

    @property
    @gather_metrics("context.ip_address")
    def ip_address(self) -> str | None:
        """The read-only IP address of the user's connection.

        This should not be used for security measures because it can easily be
        spoofed. When a user accesses the app through ``localhost``, the IP
        address is ``None``. Otherwise, the IP address is determined from the
        WebSocket connection and may be an IPv4 or IPv6 address.

        Example
        -------
        Check if the user has an IPv4 or IPv6 address:

        >>> import streamlit as st
        >>>
        >>> ip = st.context.ip_address
        >>> if ip is None:
        >>>     st.write("No IP address. This is expected in local development.")
        >>> elif ip.contains(":"):
        >>>     st.write("You have an IPv6 address.")
        >>> elif ip.contains("."):
        >>>     st.write("You have an IPv4 address.")
        >>> else:
        >>>     st.error("This should not happen.")
        """
        client_context = _get_client_context()
        if client_context is not None:
            remote_ip = client_context.remote_ip
            if remote_ip in {"::1", "127.0.0.1"}:
                return None
            return remote_ip
        return None

    @property
    @gather_metrics("context.is_embedded")
    def is_embedded(self) -> bool | None:
        """Whether the app is embedded.

        This property returns a boolean value indicating whether the app is
        running in an embedded context. This is determined by the presence of
        ``embed=true`` as a query parameter in the URL. This is the only way to
        determine if the app is currently configured for embedding because
        embedding settings are not accessible through ``st.query_params`` or
        ``st.context.url``.

        Example
        -------
        Conditionally show content when the app is running in an embedded
        context:

        >>> import streamlit as st
        >>>
        >>> if st.context.is_embedded:
        >>>     st.write("You are running the app in an embedded context.")
        """
        ctx = get_script_run_ctx()
        if ctx is None or ctx.context_info is None:
            return None
        return ctx.context_info.is_embedded
