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

"""Manage the user's Streamlit credentials."""

from __future__ import annotations

import json
import os
import sys
import textwrap
from collections import namedtuple
from datetime import datetime
from typing import Final, NoReturn
from uuid import uuid4

from streamlit import cli_util, env_util, file_util, util
from streamlit.logger import get_logger

_LOGGER: Final = get_logger(__name__)


if env_util.IS_WINDOWS:
    _CONFIG_FILE_PATH = r"%userprofile%/.streamlit/config.toml"
else:
    _CONFIG_FILE_PATH = "~/.streamlit/config.toml"

_Activation = namedtuple(
    "_Activation",
    [
        "email",  # str : the user's email.
        "is_valid",  # boolean : whether the email is valid.
    ],
)


def email_prompt() -> str:
    # Emoji can cause encoding errors on non-UTF-8 terminals
    # (See https://github.com/streamlit/streamlit/issues/2284.)
    # WT_SESSION is a Windows Terminal specific environment variable. If it exists,
    # we are on the latest Windows Terminal that supports emojis
    show_emoji = sys.stdout.encoding == "utf-8" and (
        not env_util.IS_WINDOWS or os.environ.get("WT_SESSION")
    )

    # IMPORTANT: Break the text below at 80 chars.
    return """
      {0}%(welcome)s

      If you’d like to receive helpful onboarding emails, news, offers, promotions,
      and the occasional swag, please enter your email address below. Otherwise,
      leave this field blank.

      %(email)s""".format(
        "👋 " if show_emoji else ""
    ) % {
        "welcome": cli_util.style_for_cli("Welcome to Streamlit!", bold=True),
        "email": cli_util.style_for_cli("Email: ", fg="blue"),
    }


_TELEMETRY_HEADLESS_TEXT = """
Collecting usage statistics. To deactivate, set browser.gatherUsageStats to false.
"""


def _send_email(email: str) -> None:
    """Send the user's email to segment.io, if submitted"""
    import requests

    if email is None or "@" not in email:
        return

    headers = {
        "authority": "api.segment.io",
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "text/plain",
        "origin": "localhost:8501",
        "referer": "localhost:8501/",
    }

    dt = datetime.utcnow().isoformat() + "+00:00"

    data = {
        "anonymous_id": None,
        "context": {
            "library": {"name": "analytics-python", "version": "2.2.2"},
        },
        "messageId": str(uuid4()),
        "timestamp": dt,
        "event": "submittedEmail",
        "traits": {
            "authoremail": email,
            "source": "provided_email",
        },
        "type": "track",
        "userId": email,
        "writeKey": "iCkMy7ymtJ9qYzQRXkQpnAJEq7D4NyMU",
    }

    response = requests.post(
        "https://api.segment.io/v1/t",
        headers=headers,
        data=json.dumps(data).encode(),
    )

    response.raise_for_status()


class Credentials(object):
    """Credentials class."""

    _singleton: "Credentials" | None = None

    @classmethod
    def get_current(cls):
        """Return the singleton instance."""
        if cls._singleton is None:
            Credentials()

        return Credentials._singleton

    def __init__(self):
        """Initialize class."""
        if Credentials._singleton is not None:
            raise RuntimeError(
                "Credentials already initialized. Use .get_current() instead"
            )

        self.activation = None
        self._conf_file = _get_credential_file_path()

        Credentials._singleton = self

    def __repr__(self) -> str:
        return util.repr_(self)

    def load(self, auto_resolve: bool = False) -> None:
        """Load from toml file."""
        if self.activation is not None:
            _LOGGER.error("Credentials already loaded. Not rereading file.")
            return

        import toml

        try:
            with open(self._conf_file, "r") as f:
                data = toml.load(f).get("general")
            if data is None:
                raise Exception
            self.activation = _verify_email(data.get("email"))
        except FileNotFoundError:
            if auto_resolve:
                self.activate(show_instructions=not auto_resolve)
                return
            raise RuntimeError(
                'Credentials not found. Please run "streamlit activate".'
            )
        except Exception:
            if auto_resolve:
                self.reset()
                self.activate(show_instructions=not auto_resolve)
                return
            raise Exception(
                textwrap.dedent(
                    """
                Unable to load credentials from %s.
                Run "streamlit reset" and try again.
                """
                )
                % (self._conf_file)
            )

    def _check_activated(self, auto_resolve: bool = True) -> None:
        """Check if streamlit is activated.

        Used by `streamlit run script.py`
        """
        try:
            self.load(auto_resolve)
        except (Exception, RuntimeError) as e:
            _exit(str(e))

        if self.activation is None or not self.activation.is_valid:
            _exit("Activation email not valid.")

    @classmethod
    def reset(cls) -> None:
        """Reset credentials by removing file.

        This is used by `streamlit activate reset` in case a user wants
        to start over.
        """
        c = Credentials.get_current()
        c.activation = None

        try:
            os.remove(c._conf_file)
        except OSError as e:
            _LOGGER.error("Error removing credentials file: %s" % e)

    def save(self) -> None:
        """Save to toml file and send email."""
        from requests.exceptions import RequestException

        if self.activation is None:
            return

        # Create intermediate directories if necessary
        os.makedirs(os.path.dirname(self._conf_file), exist_ok=True)

        # Write the file
        data = {"email": self.activation.email}

        import toml

        with open(self._conf_file, "w") as f:
            toml.dump({"general": data}, f)

        try:
            _send_email(self.activation.email)
        except RequestException as e:
            _LOGGER.error(f"Error saving email: {e}")

    def activate(self, show_instructions: bool = True) -> None:
        """Activate Streamlit.

        Used by `streamlit activate`.
        """
        try:
            self.load()
        except RuntimeError:
            # Runtime Error is raised if credentials file is not found. In that case,
            # `self.activation` is None and we will show the activation prompt below.
            pass

        if self.activation:
            if self.activation.is_valid:
                _exit("Already activated")
            else:
                _exit(
                    "Activation not valid. Please run "
                    "`streamlit activate reset` then `streamlit activate`"
                )
        else:
            activated = False

            while not activated:
                import click

                email = click.prompt(
                    text=email_prompt(),
                    prompt_suffix="",
                    default="",
                    show_default=False,
                )

                self.activation = _verify_email(email)
                if self.activation.is_valid:
                    self.save()
                    # IMPORTANT: Break the text below at 80 chars.
                    TELEMETRY_TEXT = """
  You can find our privacy policy at %(link)s

  Summary:
  - This open source library collects usage statistics.
  - We cannot see and do not store information contained inside Streamlit apps,
    such as text, charts, images, etc.
  - Telemetry data is stored in servers in the United States.
  - If you'd like to opt out, add the following to %(config)s,
    creating that file if necessary:

    [browser]
    gatherUsageStats = false
""" % {
                        "link": cli_util.style_for_cli(
                            "https://streamlit.io/privacy-policy", underline=True
                        ),
                        "config": cli_util.style_for_cli(_CONFIG_FILE_PATH),
                    }

                    cli_util.print_to_cli(TELEMETRY_TEXT)
                    if show_instructions:
                        # IMPORTANT: Break the text below at 80 chars.
                        INSTRUCTIONS_TEXT = """
  %(start)s
  %(prompt)s %(hello)s
""" % {
                            "start": cli_util.style_for_cli(
                                "Get started by typing:", fg="blue", bold=True
                            ),
                            "prompt": cli_util.style_for_cli("$", fg="blue"),
                            "hello": cli_util.style_for_cli(
                                "streamlit hello", bold=True
                            ),
                        }

                        cli_util.print_to_cli(INSTRUCTIONS_TEXT)
                    activated = True
                else:  # pragma: nocover
                    _LOGGER.error("Please try again.")


def _verify_email(email: str) -> _Activation:
    """Verify the user's email address.

    The email can either be an empty string (if the user chooses not to enter
    it), or a string with a single '@' somewhere in it.

    Parameters
    ----------
    email : str

    Returns
    -------
    _Activation
        An _Activation object. Its 'is_valid' property will be True only if
        the email was validated.

    """
    email = email.strip()

    # We deliberately use simple email validation here
    # since we do not use email address anywhere to send emails.
    if len(email) > 0 and email.count("@") != 1:
        _LOGGER.error("That doesn't look like an email :(")
        return _Activation(None, False)

    return _Activation(email, True)


def _exit(message: str) -> NoReturn:
    """Exit program with error."""
    _LOGGER.error(message)
    sys.exit(-1)


def _get_credential_file_path() -> str:
    return file_util.get_streamlit_file_path("credentials.toml")


def _check_credential_file_exists() -> bool:
    return os.path.exists(_get_credential_file_path())


def check_credentials() -> None:
    """Check credentials and potentially activate.

    Note
    ----
    If there is no credential file and we are in headless mode, we should not
    check, since credential would be automatically set to an empty string.

    """
    from streamlit import config

    if not _check_credential_file_exists() and config.get_option("server.headless"):
        if not config.is_manually_set("browser.gatherUsageStats"):
            # If not manually defined, show short message about usage stats gathering.
            cli_util.print_to_cli(_TELEMETRY_HEADLESS_TEXT)
        return
    Credentials.get_current()._check_activated()
