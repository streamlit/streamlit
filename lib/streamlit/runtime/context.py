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

from __future__ import annotations

from functools import lru_cache
from types import MappingProxyType
from typing import TYPE_CHECKING, Iterable, Iterator, Mapping

from streamlit import runtime
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.web.server.browser_websocket_handler import BrowserWebSocketHandler

if TYPE_CHECKING:
    from http.cookies import Morsel

    from tornado.httputil import HTTPHeaders


def _get_session_client() -> BrowserWebSocketHandler | None:
    ctx = get_script_run_ctx()
    if ctx is None:
        return None

    session_client = runtime.get_instance().get_client(ctx.session_id)
    if session_client is None:
        return None

    if not isinstance(session_client, BrowserWebSocketHandler):
        raise RuntimeError(
            f"SessionClient is not a BrowserWebSocketHandler! ({session_client})"
        )
    return session_client


@lru_cache
def _normalize_header(name: str) -> str:
    """Map a header name to Http-Header-Case.

    >>> _normalize_header("coNtent-TYPE")
    'Content-Type'
    """
    return "-".join(w.capitalize() for w in name.split("-"))


class StreamlitHeaders(Mapping[str, str]):
    def __init__(self, headers: Iterable[tuple[str, str]]):
        dict_like_headers: dict[str, list[str]] = {}

        for key, value in headers:
            header_value = dict_like_headers.setdefault(_normalize_header(key), [])
            header_value.append(value)

        self._headers = dict_like_headers

    @classmethod
    def from_tornado_headers(cls, tornado_headers: HTTPHeaders):
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


class StreamlitCookies(Mapping[str, str]):
    def __init__(self, cookies: Mapping[str, str]):
        self._cookies = MappingProxyType(cookies)

    @classmethod
    def from_tornado_cookies(cls, tornado_cookies: dict[str, Morsel]):
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


class ContextProxy:
    @property
    def headers(self):
        session_client = _get_session_client()
        return StreamlitHeaders.from_tornado_headers(session_client.request.headers)

    @property
    def cookies(self):
        session_client = _get_session_client()
        cookies = session_client.request.cookies
        return StreamlitCookies.from_tornado_cookies(cookies)
