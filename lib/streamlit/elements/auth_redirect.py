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

import urllib.parse
from typing import TYPE_CHECKING, cast

from streamlit.proto.AuthRedirect_pb2 import AuthRedirect as AuthRedirectProto
from streamlit.proto.Text_pb2 import Text as TextProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.secrets import AttrDict, secrets_singleton
from streamlit.string_util import clean_text

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


def generate_login_redirect_url() -> str:
    _OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    if secrets_singleton.load_if_toml_exists():
        auth_section = secrets_singleton.get("auth")
        # TODO[kajarenc]: Add support for other OAuth providers
        redirect_uri = auth_section["redirect_uri"]
        client_id = auth_section["client_id"]
        scope = ["profile", "email"]

        args = {"response_type": "code", "approval_prompt": "auto"}
        if redirect_uri is not None:
            args["redirect_uri"] = redirect_uri

        if client_id is not None:
            args["client_id"] = client_id

        if scope:
            args["scope"] = " ".join(scope)

        query_string = urllib.parse.urlencode(args)
        url = _OAUTH_AUTHORIZE_URL

        return f"{url}?{query_string}"
    return ""


class AuthRedirectMixin:
    def login(
        self,
    ) -> None:
        auth_proto = AuthRedirectProto()
        auth_proto.url = generate_login_redirect_url()
        auth_proto.action_type = "login"
        print("IN MIXIN!!!!")
        print(auth_proto.url)
        self.dg._enqueue("auth_redirect", auth_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
