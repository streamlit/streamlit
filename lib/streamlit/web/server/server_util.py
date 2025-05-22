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

"""Server related utility functions."""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable, Final, Literal, cast
from urllib.parse import urljoin

from streamlit import config, net_util, url_util
from streamlit.runtime.secrets import secrets_singleton

if TYPE_CHECKING:
    from tornado.web import RequestHandler

# The port reserved for internal development.
DEVELOPMENT_PORT: Final = 3000

AUTH_COOKIE_NAME: Final = "_streamlit_user"


def allowlisted_origins() -> set[str]:
    return {origin.strip() for origin in config.get_option("server.corsAllowedOrigins")}


def is_url_from_allowed_origins(url: str) -> bool:
    """Return True if URL is from allowed origins (for CORS purpose).

    Allowed origins:
    1. localhost
    2. The internal and external IP addresses of the machine where this
       function was called from.

    If `server.enableCORS` is False, this allows all origins.
    """
    if not config.get_option("server.enableCORS"):
        # Allow everything when CORS is disabled.
        return True

    hostname = url_util.get_hostname(url)

    allowlisted_domains = [
        url_util.get_hostname(origin) for origin in allowlisted_origins()
    ]

    allowed_domains: list[str | None | Callable[[], str | None]] = [
        # Check localhost first.
        "localhost",
        "0.0.0.0",  # noqa: S104
        "127.0.0.1",
        # Try to avoid making unnecessary HTTP requests by checking if the user
        # manually specified a server address.
        _get_server_address_if_manually_set,
        # Then try the options that depend on HTTP requests or opening sockets.
        net_util.get_internal_ip,
        net_util.get_external_ip,
        *allowlisted_domains,
    ]

    for allowed_domain in allowed_domains:
        allowed_domain_str = (
            allowed_domain() if callable(allowed_domain) else allowed_domain
        )

        if allowed_domain_str is None:
            continue

        if hostname == allowed_domain_str:
            return True

    return False


def get_cookie_secret() -> str:
    """Get the cookie secret.

    If the user has not set a cookie secret, we generate a random one.
    """
    cookie_secret: str = config.get_option("server.cookieSecret")
    if secrets_singleton.load_if_toml_exists():
        auth_section = secrets_singleton.get("auth")
        if auth_section:
            cookie_secret = auth_section.get("cookie_secret", cookie_secret)
    return cookie_secret


def is_xsrf_enabled() -> bool:
    csrf_enabled = config.get_option("server.enableXsrfProtection")
    if not csrf_enabled and secrets_singleton.load_if_toml_exists():
        auth_section = secrets_singleton.get("auth", None)
        csrf_enabled = csrf_enabled or auth_section is not None
    return cast("bool", csrf_enabled)


def _get_server_address_if_manually_set() -> str | None:
    if config.is_manually_set("browser.serverAddress"):
        return url_util.get_hostname(config.get_option("browser.serverAddress"))
    return None


def make_url_path_regex(
    *path: str,
    trailing_slash: Literal["optional", "required", "prohibited"] = "optional",
) -> str:
    """Get a regex of the form ^/foo/bar/baz/?$ for a path (foo, bar, baz)."""
    filtered_paths = [x.strip("/") for x in path if x]  # Filter out falsely components.
    path_format = r"^/%s$"
    if trailing_slash == "optional":
        path_format = r"^/%s/?$"
    elif trailing_slash == "required":
        path_format = r"^/%s/$"

    return path_format % "/".join(filtered_paths)


def get_url(host_ip: str) -> str:
    """Get the URL for any app served at the given host_ip.

    Parameters
    ----------
    host_ip : str
        The IP address of the machine that is running the Streamlit Server.

    Returns
    -------
    str
        The URL.
    """
    protocol = "https" if config.get_option("server.sslCertFile") else "http"

    port = _get_browser_address_bar_port()
    base_path = config.get_option("server.baseUrlPath").strip("/")

    if base_path:
        base_path = "/" + base_path

    host_ip = host_ip.strip("/")
    return f"{protocol}://{host_ip}:{port}{base_path}"


def _get_browser_address_bar_port() -> int:
    """Get the app URL that will be shown in the browser's address bar.

    That is, this is the port where static assets will be served from. In dev,
    this is different from the URL that will be used to connect to the
    server-browser websocket.

    """
    if config.get_option("global.developmentMode"):
        return DEVELOPMENT_PORT
    return int(config.get_option("browser.serverPort"))


def emit_endpoint_deprecation_notice(handler: RequestHandler, new_path: str) -> None:
    """Emits the warning about deprecation of HTTP endpoint in the HTTP header."""
    handler.set_header("Deprecation", True)
    new_url = urljoin(f"{handler.request.protocol}://{handler.request.host}", new_path)
    handler.set_header("Link", f'<{new_url}>; rel="alternate"')
