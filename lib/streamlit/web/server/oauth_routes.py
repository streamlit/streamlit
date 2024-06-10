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

import json

import tornado.auth
import tornado.web

from streamlit.runtime.secrets import AttrDict, secrets_singleton


class LoginHandler(tornado.auth.GoogleOAuth2Mixin, tornado.web.RequestHandler):
    """Returns ForwardMsgs from our MessageCache"""

    async def get(self):
        if secrets_singleton.load_if_toml_exists():
            auth_section = secrets_singleton.get("auth")

            redirect_uri = auth_section["redirect_uri"]

            if self.get_argument("code", False):
                access = await self.get_authenticated_user(
                    redirect_uri=redirect_uri,
                    code=self.get_argument("code"),
                    client_id=auth_section["client_id"],
                    client_secret=auth_section["client_secret"],
                )

                user = await self.oauth2_request(
                    "https://www.googleapis.com/oauth2/v1/userinfo",
                    access_token=access["access_token"],
                )

                # Save the user and access token. For example:
                user_cookie = dict(
                    email=user["email"], access_token=access["access_token"]
                )

                self.set_signed_cookie("_streamlit_uzer", json.dumps(user_cookie))
                self.redirect("/")
                return
        text = f"""
        <html>
          <body>
            <form action="/login" method="post">
            {self.xsrf_form_html()}
             <input type="submit" value="Login">
            </form>
          </body>
        </html>
        """
        self.write(text)

    def post(self):
        # TODO[kajarenc]: change this post method to /oauth_callback instead of /login
        if secrets_singleton.load_if_toml_exists():
            auth_section = secrets_singleton.get("auth")
            redirect_uri = auth_section["redirect_uri"]

            self.authorize_redirect(
                redirect_uri=redirect_uri,
                client_id=auth_section["client_id"],
                client_secret=auth_section["client_secret"],
                scope=["profile", "email"],
                response_type="code",
                extra_params={"approval_prompt": "auto"},
            )


class LogoutHandler(tornado.web.RequestHandler):
    def get(self):
        print("IN LOGOUT HANDLER!!!")
        self.clear_cookie("_streamlit_uzer")
        self.redirect("/")
