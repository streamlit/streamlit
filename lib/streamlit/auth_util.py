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

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any, TypedDict, cast

from streamlit import config
from streamlit.errors import StreamlitAuthError
from streamlit.runtime.secrets import AttrDict, secrets_singleton

if TYPE_CHECKING:

    class ProviderTokenPayload(TypedDict):
        provider: str
        exp: int


class AuthCache:
    """Simple cache implementation for storing info required for Authlib."""

    def __init__(self) -> None:
        self.cache: dict[str, Any] = {}

    def get(self, key: str) -> Any:
        return self.cache.get(key)

    # for set method, we are follow the same signature used in Authlib
    # the expires_in is not used in our case
    def set(self, key: str, value: Any, expires_in: int | None = None) -> None:  # noqa: ARG002
        self.cache[key] = value

    def get_dict(self) -> dict[str, Any]:
        return self.cache

    def delete(self, key: str) -> None:
        self.cache.pop(key, None)


def is_authlib_installed() -> bool:
    """Check if Authlib is installed."""
    try:
        import authlib

        authlib_version = authlib.__version__
        authlib_version_tuple = tuple(map(int, authlib_version.split(".")))

        if authlib_version_tuple < (1, 3, 2):
            return False
    except (ImportError, ModuleNotFoundError):
        return False
    return True


def get_signing_secret() -> str:
    """Get the cookie signing secret from the configuration or secrets.toml."""
    signing_secret: str = config.get_option("server.cookieSecret")
    if secrets_singleton.load_if_toml_exists():
        auth_section = secrets_singleton.get("auth")
        if auth_section:
            signing_secret = auth_section.get("cookie_secret", signing_secret)
    return signing_secret


def get_secrets_auth_section() -> AttrDict:
    auth_section = AttrDict({})
    """Get the 'auth' section of the secrets.toml."""
    if secrets_singleton.load_if_toml_exists():
        auth_section = cast("AttrDict", secrets_singleton.get("auth"))

    return auth_section


def encode_provider_token(provider: str) -> str:
    """Returns a signed JWT token with the provider and expiration time."""
    try:
        from authlib.jose import jwt
    except ImportError:
        raise StreamlitAuthError(
            """To use authentication features, you need to install Authlib>=1.3.2, e.g. via `pip install Authlib`."""
        ) from None

    header = {"alg": "HS256"}
    payload = {
        "provider": provider,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=2),
    }
    provider_token: bytes = jwt.encode(header, payload, get_signing_secret())
    # JWT token is a byte string, so we need to decode it to a URL compatible string
    return provider_token.decode("latin-1")


def decode_provider_token(provider_token: str) -> ProviderTokenPayload:
    """Decode the JWT token and validate the claims."""
    try:
        from authlib.jose import JoseError, JWTClaims, jwt
    except ImportError:
        raise StreamlitAuthError(
            """To use authentication features, you need to install Authlib>=1.3.2, e.g. via `pip install Authlib`."""
        ) from None

    # Our JWT token is short-lived (2 minutes), so we check here that it contains
    # the 'exp' (and it is not expired), and 'provider' field exists.
    claim_options = {"exp": {"essential": True}, "provider": {"essential": True}}
    try:
        payload: JWTClaims = jwt.decode(
            provider_token, get_signing_secret(), claims_options=claim_options
        )
        payload.validate()
    except JoseError as e:
        raise StreamlitAuthError(f"Error decoding provider token: {e}") from None

    return cast("ProviderTokenPayload", payload)


def generate_default_provider_section(auth_section: AttrDict) -> dict[str, Any]:
    """Generate a default provider section for the 'auth' section of secrets.toml."""
    default_provider_section = {}
    if auth_section.get("client_id"):
        default_provider_section["client_id"] = auth_section.get("client_id")
    if auth_section.get("client_secret"):
        default_provider_section["client_secret"] = auth_section.get("client_secret")
    if auth_section.get("server_metadata_url"):
        default_provider_section["server_metadata_url"] = auth_section.get(
            "server_metadata_url"
        )
    if auth_section.get("client_kwargs"):
        default_provider_section["client_kwargs"] = cast(
            "AttrDict", auth_section.get("client_kwargs", AttrDict({}))
        ).to_dict()
    return default_provider_section


def validate_auth_credentials(provider: str) -> None:
    """Validate the general auth credentials and auth credentials for the given
    provider.
    """
    if not secrets_singleton.load_if_toml_exists():
        raise StreamlitAuthError(
            """To use authentication features you need to configure credentials for at
            least one authentication provider in `.streamlit/secrets.toml`."""
        )

    auth_section = secrets_singleton.get("auth")
    if auth_section is None:
        raise StreamlitAuthError(
            """To use authentication features you need to configure credentials for at
            least one authentication provider in `.streamlit/secrets.toml`."""
        )
    if "redirect_uri" not in auth_section:
        raise StreamlitAuthError(
            """Authentication credentials in `.streamlit/secrets.toml` are missing the
            "redirect_uri" key. Please check your configuration."""
        )
    if "cookie_secret" not in auth_section:
        raise StreamlitAuthError(
            """Authentication credentials in `.streamlit/secrets.toml` are missing the
            "cookie_secret" key. Please check your configuration."""
        )

    provider_section = auth_section.get(provider)

    # TODO(kajarenc): Revisit this check later when investigating the ability
    # TODO(kajarenc): to add "_" to the provider name.
    if "_" in provider:
        raise StreamlitAuthError(
            f'Auth provider name "{provider}" contains an underscore. '
            f"Please use a provider name without underscores."
        )

    if provider_section is None and provider == "default":
        provider_section = generate_default_provider_section(auth_section)

    if provider_section is None:
        if provider == "default":
            raise StreamlitAuthError(
                """Authentication credentials in `.streamlit/secrets.toml` are missing for
                the default authentication provider. Please check your configuration."""
            )
        raise StreamlitAuthError(
            f"Authentication credentials in `.streamlit/secrets.toml` are missing for "
            f'the authentication provider "{provider}". Please check your '
            f"configuration."
        )

    if not isinstance(provider_section, Mapping):
        raise StreamlitAuthError(
            f"Authentication credentials in `.streamlit/secrets.toml` for the "
            f'authentication provider "{provider}" must be valid TOML. Please check '
            f"your configuration."
        )

    required_keys = ["client_id", "client_secret", "server_metadata_url"]
    missing_keys = [key for key in required_keys if key not in provider_section]
    if missing_keys:
        if provider == "default":
            raise StreamlitAuthError(
                "Authentication credentials in `.streamlit/secrets.toml` for the "
                f"default authentication provider are missing the following keys: "
                f"{missing_keys}. Please check your configuration."
            )
        raise StreamlitAuthError(
            "Authentication credentials in `.streamlit/secrets.toml` for the "
            f'authentication provider "{provider}" are missing the following keys: '
            f"{missing_keys}. Please check your configuration."
        )
