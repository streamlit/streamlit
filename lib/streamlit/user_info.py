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

from collections.abc import Iterator, Mapping
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    NoReturn,
    cast,
)

from streamlit import config, logger, runtime
from streamlit.auth_util import (
    encode_provider_token,
    get_secrets_auth_section,
    is_authlib_installed,
    validate_auth_credentials,
)
from streamlit.deprecation_util import (
    make_deprecated_name_warning,
    show_deprecation_warning,
)
from streamlit.errors import StreamlitAPIException, StreamlitAuthError
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    get_script_run_ctx as _get_script_run_ctx,
)
from streamlit.url_util import make_url_path

if TYPE_CHECKING:
    from streamlit.runtime.scriptrunner_utils.script_run_context import UserInfoType


_LOGGER: Final = logger.get_logger(__name__)

AUTH_LOGIN_ENDPOINT: Final = "/auth/login"
AUTH_LOGOUT_ENDPOINT: Final = "/auth/logout"


@gather_metrics("login")
def login(provider: str | None = None) -> None:
    """Initiate the login flow for the given provider.

    This command redirects the user to an OpenID Connect (OIDC) provider. After
    the user authenticates their identity, they are redirected back to the
    home page of your app. Streamlit stores a cookie with the user's identity
    information in the user's browser . You can access the identity information
    through |st.user|_. Call ``st.logout()`` to remove the cookie
    and start a new session.

    You can use any OIDC provider, including Google, Microsoft, Okta, and more.
    You must configure the provider through secrets management. Although OIDC
    is an extension of OAuth 2.0, you can't use generic OAuth providers.
    Streamlit parses the user's identity token and surfaces its attributes in
    ``st.user``. If the provider returns an access token, that
    token is ignored unless you explicitly expose it.

    For all providers, there are three shared settings, ``redirect_uri``,
    ``cookie_secret``, and ``expose_tokens``, which you must specify in an
    ``[auth]`` dictionary in ``secrets.toml``. Other settings must be defined
    as described in the ``provider`` parameter.

    - ``redirect_uri`` is your app's absolute URL with the pathname
      ``oauth2callback``. For local development using the default port, this is
      ``http://localhost:8501/oauth2callback``.
    - ``cookie_secret`` should be a strong, randomly generated secret.
    - ``expose_tokens`` is a list of token types to expose. The supported token
      types are ``"id"`` and ``"access"``. This is an optional setting, and no
      tokens are exposed by default. For information and examples about exposing
      tokens, see |st.user|_.

    In addition to the shared settings, the following settings are required:

    - ``client_id``
    - ``client_secret``
    - ``server_metadata_url``

    For a complete list of OIDC parameters, see `OpenID Connect Core
    <https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest>`_ and
    your provider's documentation. By default, Streamlit sets
    ``scope="openid profile email"`` and ``prompt="select_account"``. You can
    change these and other OIDC parameters by passing a dictionary of settings
    to ``client_kwargs``. ``state`` and ``nonce``, which are used for
    security, are handled automatically and don't need to be specified. For
    more information, see Example 4.

    .. Important::
        - You must install ``Authlib>=1.3.2`` to use this command. You can
          install it as an extra with Streamlit:

          .. code-block:: shell

             pip install streamlit[auth]

        - Your authentication configuration is dependent on your host location.
          When you deploy your app, remember to update your ``redirect_uri``
          within your app and your provider.
        - All URLs declared in the settings must be absolute (i.e., begin with
          ``http://`` or ``https://``).
        - Streamlit automatically enables CORS and XSRF protection when you
          configure authentication in ``secrets.toml``. This takes precedence
          over configuration options in ``config.toml``.
        - If a user is logged into your app and opens a new tab in the same
          browser, they will automatically be logged in to the new session with
          the same account.
        - If a user closes your app without logging out, the identity cookie
          will expire after 30 days.
        - For security reasons, authentication is not supported for embedded
          apps.

    .. |st.user| replace:: ``st.user``
    .. _st.user: https://docs.streamlit.io/develop/api-reference/user/st.user

    Parameters
    ----------
    provider: str or None
        The name of your provider configuration to use for login.

        If ``provider`` is ``None`` (default), Streamlit will use all settings
        in the ``[auth]`` dictionary within your app's ``secrets.toml`` file.
        Otherwise, use an ``[auth.{provider}]`` dictionary for the named
        provider, as shown in the examples that follow. When you pass a string
        to ``provider``, Streamlit will use ``redirect_uri`` and
        ``cookie_secret``, while ignoring any other values in the ``[auth]``
        dictionary.

        Due to internal implementation details, Streamlit does not support
        using an underscore within ``provider`` at this time.

    Examples
    --------
    **Example 1: Use an unnamed default identity provider**

    If you do not specify a name for your provider, specify all settings within
    the ``[auth]`` dictionary of your ``secrets.toml`` file. The following
    example configures Google as the default provider. For information about
    using OIDC with Google, see `Google Identity
    <https://developers.google.com/identity/openid-connect/openid-connect>`_.

    .. code-block:: toml
        :filename: .streamlit/secrets.toml

        [auth]
        redirect_uri = "http://localhost:8501/oauth2callback"
        cookie_secret = "xxx"
        client_id = "xxx"
        client_secret = "xxx"
        server_metadata_url = "https://accounts.google.com/.well-known/openid-configuration"  # fmt: skip

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        if not st.user.is_logged_in:
            if st.button("Log in"):
                st.login()
        else:
            if st.button("Log out"):
                st.logout()
            st.write(f"Hello, {st.user.name}!")

    **Example 2: Use a named identity provider**

    If you specify a name for your provider, save the shared settings in the
    ``[auth]`` dictionary of your ``secrets.toml`` file, and save the other
    settings in an ``[auth.{provider}]`` dictionary, where ``{provider}`` is
    the name of your provider. The following example configures Microsoft as
    the provider. The example uses ``provider="microsoft"``, but you can use
    any name. This name is internal to Streamlit and is used to match the login
    command to its configuration. For information about using OIDC with
    Microsoft, see `Microsoft Entra ID
    <https://learn.microsoft.com/en-us/power-pages/security/authentication/openid-settings>`_.
    To configure your ``{tenant}`` value in ``server_metadata_url``, see
    `Microsoft identity platform
    <https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc#find-your-apps-openid-configuration-document-uri>`_.

    .. code-block:: toml
        :filename: .streamlit/secrets.toml

        [auth]
        redirect_uri = "http://localhost:8501/oauth2callback"
        cookie_secret = "xxx"

        [auth.microsoft]
        client_id = "xxx"
        client_secret = "xxx"
        server_metadata_url = "https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration"

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        if not st.user.is_logged_in:
            st.login("microsoft")
        else:
            st.write(f"Hello, {st.user.name}!")

    **Example 3: Use multiple, named providers**

    If you want to give your users a choice of authentication methods,
    configure multiple providers and give them each a unique name. The
    following example lets users choose between Okta and Microsoft to log in.
    Always check with your identity provider to understand the structure of
    their identity tokens because the returned fields may differ. Remember to
    set ``{tenant}`` and ``{subdomain}`` in ``server_metadata_url`` for
    Microsoft and Okta, respectively.

    .. code-block:: toml
        :filename: .streamlit/secrets.toml

        [auth]
        redirect_uri = "http://localhost:8501/oauth2callback"
        cookie_secret = "xxx"

        [auth.microsoft]
        client_id = "xxx"
        client_secret = "xxx"
        server_metadata_url = "https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration"

        [auth.okta]
        client_id = "xxx"
        client_secret = "xxx"
        server_metadata_url = "https://{subdomain}.okta.com/.well-known/openid-configuration"

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        if not st.user.is_logged_in:
            st.header("Log in:")
            if st.button("Microsoft"):
                st.login("microsoft")
            if st.button("Okta"):
                st.login("okta")
        else:
            if st.button("Log out"):
                st.logout()
            st.write(f"Hello, {st.user.name}!")

    **Example 4: Change the default connection settings**

    ``prompt="select_account"`` may be treated differently by some
    providers when a user is already logged into their account. If a user is
    logged into their Google or Microsoft account from a previous session, the
    provider will prompt them to select the account they want to use, even if
    it's the only one. However, if the user is logged into their Okta or Auth0
    account from a previous session, the account will automatically be
    selected. ``st.logout()`` does not clear a user's related cookies. To force
    users to log in every time, use ``prompt="login"`` as described in Auth0's
    `Customize Signup and Login Prompts
    <https://auth0.com/docs/customize/login-pages/universal-login/customize-signup-and-login-prompts>`_.

    .. code-block:: toml
        :filename: .streamlit/secrets.toml

        [auth]
        redirect_uri = "http://localhost:8501/oauth2callback"
        cookie_secret = "xxx"

        [auth.auth0]
        client_id = "xxx"
        client_secret = "xxx"
        server_metadata_url = "https://{account}.{region}.auth0.com/.well-known/openid-configuration"
        client_kwargs = { "prompt" = "login" }

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        if st.button("Log in"):
            st.login("auth0")
        if st.user.is_logged_in:
            if st.button("Log out"):
                st.logout()
            st.write(f"Hello, {st.user.name}!)

    """
    if provider is None:
        provider = "default"

    context = _get_script_run_ctx()
    if context is not None:
        if not is_authlib_installed():
            raise StreamlitAuthError(
                """To use authentication features, you need to install """
                """Authlib>=1.3.2, e.g. via `pip install Authlib`."""
            )
        validate_auth_credentials(provider)
        fwd_msg = ForwardMsg()
        fwd_msg.auth_redirect.url = generate_login_redirect_url(provider)
        context.enqueue(fwd_msg)


@gather_metrics("logout")
def logout() -> None:
    """Logout the current user.

    This command removes the user's information from ``st.user``,
    deletes their identity cookie, and redirects them to perform a proper
    logout from the OAuth provider (if available) before returning to your
    app's home page. This creates a new session.

    If the user has multiple sessions open in the same browser,
    ``st.user`` will not be cleared in any other session.
    ``st.user`` only reads from the identity cookie at the start
    of a session. After a session is running, you must call ``st.login()`` or
    ``st.logout()`` within that session to update ``st.user``.

    .. Note::
        If the OAuth provider supports OIDC end_session_endpoint in their
        server metadata, the user will be logged out from the identity provider
        as well. If not available, only local logout is performed.

    Example
    -------
    ``.streamlit/secrets.toml``:

    >>> [auth]
    >>> redirect_uri = "http://localhost:8501/oauth2callback"
    >>> cookie_secret = "xxx"
    >>> client_id = "xxx"
    >>> client_secret = "xxx"
    >>> server_metadata_url = "https://accounts.google.com/.well-known/openid-configuration"  # fmt: skip

    Your app code:

    >>> import streamlit as st
    >>>
    >>> if not st.user.is_logged_in:
    >>>     if st.button("Log in"):
    >>>         st.login()
    >>> else:
    >>>     if st.button("Log out"):
    >>>         st.logout()
    >>>     st.write(f"Hello, {st.user.name}!")
    """
    context = _get_script_run_ctx()
    if context is not None:
        context.user_info.clear()
        session_id = context.session_id

        if runtime.exists():
            instance = runtime.get_instance()
            instance.clear_user_info_for_session(session_id)

        base_path = config.get_option("server.baseUrlPath")

        fwd_msg = ForwardMsg()
        fwd_msg.auth_redirect.url = make_url_path(base_path, AUTH_LOGOUT_ENDPOINT)
        context.enqueue(fwd_msg)


def generate_login_redirect_url(provider: str) -> str:
    """Generate the login redirect URL for the given provider."""
    provider_token = encode_provider_token(provider)
    base_path = config.get_option("server.baseUrlPath")
    login_path = make_url_path(base_path, AUTH_LOGIN_ENDPOINT)
    return f"{login_path}?provider={provider_token}"


def _get_user_info() -> UserInfoType:
    ctx = _get_script_run_ctx()
    if ctx is None:
        _LOGGER.warning(
            "No script run context available. st.user will return an empty dictionary."
        )
        return {}

    context_user_info = ctx.user_info.copy()

    auth_section_exists = get_secrets_auth_section()
    if "is_logged_in" not in context_user_info and auth_section_exists:
        context_user_info["is_logged_in"] = False

    return context_user_info


class TokensProxy(Mapping[str, str]):
    """
    A read-only, dict-like object for accessing exposed tokens from the\
    identity provider.

    This class provides access to tokens that have been explicitly exposed via
    the ``expose_tokens`` setting in your authentication configuration. Tokens
    contain sensitive credentials that your app can use to authenticate with
    external services on behalf of the logged-in user.

    To expose tokens in ``st.user.tokens``, add the ``expose_tokens`` parameter to your authentication
    configuration in ``.streamlit/secrets.toml``. ``expose_tokens`` must be in
    the ``[auth]`` section and can't be a nested dictionary. You can specify a
    single token type as a string or multiple token types as a list. Streamlit
    supports exposing ``"id"`` tokens and ``"access"`` tokens. If
    ``expose_tokens`` isn't configured, ``st.user.tokens`` is an empty dict.

    .. warning::
        Tokens are sensitive credentials that should be handled securely. Never
        expose tokens in your app's UI, logs, or error messages. Only use tokens
        for server-side API calls, and be mindful of token expiration times.
        Only expose tokens if your app needs them for specific API integrations.

    You can access token values using either key or attribute notation. For
    example, use ``st.user.tokens["id"]`` or ``st.user.tokens.id`` to access
    the ``id`` token. The object is read-only to prevent accidental modification of sensitive
    credentials.

    Attributes
    ----------
    id : str
        The identity token. This is only available if ``"id"`` is in ``expose_tokens``.
    access : str
        The access token. This is only available if ``"access"`` is in ``expose_tokens``.

    Examples
    --------
    **Example 1: Expose the ID token**

    To expose only the identity token, add ``expose_tokens`` to your
    authentication configuration. This example uses an unnamed default provider.

    .. code-block:: toml
        :filename: .streamlit/secrets.toml

        [auth]
        redirect_uri = "http://localhost:8501/oauth2callback"
        cookie_secret = "xxx"
        client_id = "xxx"
        client_secret = "xxx"
        server_metadata_url = "https://accounts.google.com/.well-known/openid-configuration"
        expose_tokens = "id"

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        if st.user.is_logged_in:
            id_token = st.user.tokens["id"]
            # Use the token for API verification

    **Example 2: Expose both ID and access tokens**

    You can use a list to expose multiple tokens. If you use one or more named
    identity providers, the same tokens must be exposed for all providers in
    the shared ``[auth]`` section.

    .. code-block:: toml
        :filename: .streamlit/secrets.toml

        [auth]
        redirect_uri = "http://localhost:8501/oauth2callback"
        cookie_secret = "xxx"
        expose_tokens = ["id", "access"]

        [auth.google]
        client_id = "xxx"
        client_secret = "xxx"
        server_metadata_url = "https://accounts.google.com/.well-known/openid-configuration"

        [auth.microsoft]
        client_id = "xxx"
        client_secret = "xxx"
        server_metadata_url = "https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration"

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        if st.user.is_logged_in:
            id_token = st.user.tokens["id"]
            access_token = st.user.tokens["access"]
            # Use the tokens for API verification
    """

    def __init__(self, tokens: dict[str, str]) -> None:
        self._tokens = tokens

    def __getitem__(self, key: str) -> str:
        return self._tokens[key]

    def __getattr__(self, key: str) -> str:
        try:
            return self._tokens[key]
        except KeyError:
            raise AttributeError(f'Token "{key}" is not exposed or does not exist.')

    def __setattr__(self, name: str, value: Any) -> None:
        if name.startswith("_"):
            super().__setattr__(name, value)
        else:
            raise StreamlitAPIException("st.user.tokens cannot be modified")

    def __setitem__(self, name: str, value: Any) -> None:
        raise StreamlitAPIException("st.user.tokens cannot be modified")

    def __iter__(self) -> Iterator[str]:
        return iter(self._tokens)

    def __len__(self) -> int:
        return len(self._tokens)

    def to_dict(self) -> dict[str, str]:
        """Return the token mapping as a standard dictionary.

        Returns
        -------
        dict[str, str]
            A dictionary mapping token names to token values.
        """
        return dict(self._tokens)


class UserInfoProxy(Mapping[str, str | bool | TokensProxy | None]):
    """
    A read-only, dict-like object for accessing information about the current\
    user.

    ``st.user`` is dependent on the host platform running your
    Streamlit app. If your host platform has not configured the object,
    ``st.user`` will behave as it does in a locally running app.

    When authentication is configured in ``secrets.toml``, Streamlit will parse
    the OpenID Connect (OIDC) identity token and copy the attributes to
    ``st.user``. Check your provider's documentation for their
    available attributes (known as claims).

    When authentication is not configured, ``st.user`` has no
    attributes.

    You can access values via key or attribute notation. For example, use
    ``st.user["email"]`` or ``st.user.email`` to
    access the ``email`` attribute.

    .. Important::
        Identity tokens include an issuance and expiration time. Streamlit does
        not implicitly check these. If you want to automatically expire a
        user's authentication, check these values manually and programmatically
        log out your user (``st.logout()``) when needed.

    Attributes
    ----------
    is_logged_in : bool
        Whether a user is logged in. For a locally running app, this attribute
        is only available when authentication (``st.login()``) is configured in
        ``secrets.toml``. Otherwise, it does not exist.

    tokens: TokensProxy
        A read-only, dict-like object for accessing exposed tokens from the
        identity provider.

    Examples
    --------
    **Example 1: Google's identity token**

    If you configure a basic Google OIDC connection as shown in Example 1 of
    ``st.login()``, the following data is available in
    ``st.user``. Streamlit adds the ``is_logged_in`` attribute.
    Additional attributes may be available depending on the configuration of
    the user's Google account. For more information about Google's identity
    tokens, see `Obtain user information from the ID token
    <https://developers.google.com/identity/openid-connect/openid-connect#obtainuserinfo>`_
    in Google's docs.

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        if st.user.is_logged_in:
            st.write(st.user)

    Displayed data when a user is logged in:

    .. code-block:: json

        {
            "is_logged_in":true
            "iss":"https://accounts.google.com"
            "azp":"{client_id}.apps.googleusercontent.com"
            "aud":"{client_id}.apps.googleusercontent.com"
            "sub":"{unique_user_id}"
            "email":"{user}@gmail.com"
            "email_verified":true
            "at_hash":"{access_token_hash}"
            "nonce":"{nonce_string}"
            "name":"{full_name}"
            "picture":"https://lh3.googleusercontent.com/a/{content_path}"
            "given_name":"{given_name}"
            "family_name":"{family_name}"
            "iat":{issued_time}
            "exp":{expiration_time}
            "tokens":{}
    }

    **Example 2: Microsoft's identity token**

    If you configure a basic Microsoft OIDC connection as shown in Example 2 of
    ``st.login()``, the following data is available in
    ``st.user``. For more information about Microsoft's identity
    tokens, see `ID token claims reference
    <https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference>`_
    in Microsoft's docs.

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        if st.user.is_logged_in:
            st.write(st.user)

    Displayed data when a user is logged in:

    .. code-block:: json

        {
            "is_logged_in":true
            "ver":"2.0"
            "iss":"https://login.microsoftonline.com/{tenant_id}/v2.0"
            "sub":"{application_user_id}"
            "aud":"{application_id}"
            "exp":{expiration_time}
            "iat":{issued_time}
            "nbf":{start_time}
            "name":"{full_name}"
            "preferred_username":"{username}"
            "oid":"{user_GUID}"
            "email":"{email}"
            "tid":"{tenant_id}"
            "nonce":"{nonce_string}"
            "aio":"{opaque_string}"
            "tokens":{}
        }
    """

    def __getitem__(self, key: str) -> str | bool | None | TokensProxy:
        if key == "tokens":
            return self.tokens
        try:
            return cast("str | bool | None", _get_user_info()[key])
        except KeyError:
            raise KeyError(f'st.user has no key "{key}".')

    def __getattr__(self, key: str) -> str | bool | None | TokensProxy:
        if key == "tokens":
            return self.tokens
        try:
            return cast("str | bool | None", _get_user_info()[key])
        except KeyError:
            raise AttributeError(f'st.user has no attribute "{key}".')

    def __setattr__(self, name: str, value: str | None) -> NoReturn:
        raise StreamlitAPIException("st.user cannot be modified")

    def __setitem__(self, name: str, value: str | None) -> NoReturn:
        raise StreamlitAPIException("st.user cannot be modified")

    def __iter__(self) -> Iterator[str]:
        return iter(_get_user_info())

    def __len__(self) -> int:
        return len(_get_user_info())

    def to_dict(self) -> UserInfoType:
        """
        Get user info as a dictionary.

        This method primarily exists for internal use and is not needed for
        most cases. ``st.user`` returns an object that inherits from
        ``dict`` by default.

        Returns
        -------
        Dict[str,str]
            A dictionary of the current user's information.
        """
        return _get_user_info()

    @property
    @gather_metrics("user.tokens")
    def tokens(self) -> TokensProxy:
        """Access exposed tokens via a dict-like object."""
        user_info = _get_user_info()
        return TokensProxy(cast("dict[str, str]", user_info.get("tokens", {})))


has_shown_experimental_user_warning = False


def maybe_show_deprecated_user_warning() -> None:
    """Show a deprecation warning for the experimental_user alias."""
    global has_shown_experimental_user_warning  # noqa: PLW0603

    if not has_shown_experimental_user_warning:
        has_shown_experimental_user_warning = True
        show_deprecation_warning(
            make_deprecated_name_warning(
                "experimental_user",
                "user",
                "2025-11-06",
            )
        )


class DeprecatedUserInfoProxy(UserInfoProxy):
    """
    A deprecated alias for UserInfoProxy.

    This class is deprecated and will be removed in a future version of
    Streamlit.
    """

    def __getattribute__(self, name: str) -> Any:
        maybe_show_deprecated_user_warning()
        return super().__getattribute__(name)

    def __getitem__(self, key: str) -> Any:
        maybe_show_deprecated_user_warning()
        return super().__getitem__(key)
