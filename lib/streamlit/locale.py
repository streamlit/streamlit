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
import os
import threading
from difflib import get_close_matches
from gettext import translation
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union

import langcodes

from streamlit import language_constants
from streamlit.file_util import get_app_locale_dir
from streamlit.logger import get_logger
from streamlit.proto import LanguageInfo_pb2
from streamlit.runtime.scriptrunner import script_run_context

_LOGGER = get_logger(__name__)

APP_LOCALE_DOMAIN = "messages"


def fail_silently(func: Callable[[str], str]):
    """Decorator which returns message if any exception occurs."""

    def gettext(message: str):
        try:
            return func(message)
        except Exception as e:
            _LOGGER.warning(f"Gettext for {message} failed with exception {e}.")
            return message

    return gettext


def ensure_gettext_ctx(func: Callable[[str], str]):
    """Decorator which checks gettext context before allowing translation."""

    def gettext(message: str):
        try:
            locales_dir = get_app_locale_dir()
            session_language = get_session_language()
            if not locales_dir or not session_language:
                return message
            if not Path(
                locales_dir, f"{session_language}/LC_MESSAGES/{APP_LOCALE_DOMAIN}.mo"
            ).is_file():
                return message
            return func(message)
        except Exception as e:
            _LOGGER.warning(
                f"Ensure gettext context for {message} failed with exception {e}."
            )
            return message

    return gettext


def _normalize_app_locales(app_locales: List[str]) -> Dict[str, str]:
    """Returns list of pairs of user defined locale name and it's normalized name."""
    normalized_app_locales = {}
    for app_locale in app_locales:
        try:
            normalized_app_locale = langcodes.standardize_tag(app_locale, macro=True)
        except Exception as e:
            normalized_app_locale = app_locale
            _LOGGER.warning(f"Normalize {app_locale} failed with exception {e}.")
        normalized_app_locales[app_locale] = normalized_app_locale
    return normalized_app_locales


class Language:
    def __init__(
        self,
        header_name: str,
        q: float,
        locale_name: Optional[str] = None,
        normalized_name: Optional[str] = None,
    ):
        self.header_name = header_name
        self.q = q
        self.locale_name = locale_name
        self.normalized_name = normalized_name

    def __str__(self):
        return f"n={self.header_name},q={self.q},v={self.locale_name}"


def _get_default_accept_language():
    return Language(header_name="en", q=1.0, locale_name="en", normalized_name="en")


def get_accept_languages(
    session_language_as_str: Optional[str] = None,
) -> List[Language]:
    """Gets accept languages list."""
    if not session_language_as_str:
        ctx = getattr(
            threading.current_thread(),
            script_run_context.SCRIPT_RUN_CONTEXT_ATTR_NAME,
            None,
        )
        if not ctx:
            return [_get_default_accept_language()]
        session_language = ctx.session_state.language
        if not session_language:
            return [_get_default_accept_language()]
    else:
        session_language = session_language_as_str
    if not session_language:
        return [_get_default_accept_language()]

    normalized_app_locales = _normalize_app_locales(_get_app_locales())
    inverted_normalized_app_locales = {
        value: key for (key, value) in normalized_app_locales.items()
    }

    accept_languages = _parse_accept_language(session_language)
    found_locales = []
    for language in accept_languages:
        normalized_matches = get_close_matches(
            language.header_name,
            normalized_app_locales.values(),
            n=1,
        )
        if len(normalized_matches) > 0:
            language.locale_name = inverted_normalized_app_locales[
                normalized_matches[0]
            ]
            language.normalized_name = normalized_app_locales[normalized_matches[0]]
            found_locales.append(language)
    return found_locales


def get_session_language(
    session_language_as_str: Optional[str] = None,
) -> str:
    """Gets closest matching language."""
    if not session_language_as_str:
        ctx = getattr(
            threading.current_thread(),
            script_run_context.SCRIPT_RUN_CONTEXT_ATTR_NAME,
            None,
        )
        if not ctx:
            return "en"
        session_language = ctx.session_state.language
        if not session_language:
            return "en"
    else:
        session_language = session_language_as_str
    if not session_language:
        return "en"
    try:
        normalized_app_locales = _normalize_app_locales(_get_app_locales())
        inverted_normalized_app_locales = {
            value: key for (key, value) in normalized_app_locales.items()
        }

        accept_languages = _parse_accept_language(session_language)
        found_locales = []
        for language in accept_languages:
            normalized_matches = get_close_matches(
                language.header_name,
                normalized_app_locales.values(),
                n=1,
            )
            if len(normalized_matches) > 0:
                language.locale_name = inverted_normalized_app_locales[
                    normalized_matches[0]
                ]
                found_locales.append(language)
        if len(found_locales) < 1:
            return "en"
        found_locales.sort(key=lambda locale: locale.q, reverse=True)
        return found_locales[0].locale_name or "en"
    except Exception as e:
        _LOGGER.warning(f"Get session language failed with exception {e}.")
        return "en"


@fail_silently
@ensure_gettext_ctx
def gettext(message: str) -> str:
    """Translates message and returns it as a string."""
    return translation(
        APP_LOCALE_DOMAIN,
        localedir=get_app_locale_dir(),
        languages=[get_session_language()],
    ).gettext(message)


def _parse_accept_language(accept_language_header: str) -> List[Language]:
    """Parses accept language HTTP header.
    See https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language for more details."""
    languages = accept_language_header.split(",")
    http_locales: List[Language] = []
    for language in languages:
        if language.split(";")[0] == language:
            http_locales.append(Language(header_name=language.strip(), q=float(1)))
        else:
            locale = language.split(";")[0].strip()
            q: Union[str, float] = language.split(";")[1].split("=")[1]
            try:
                q = float(q)
            except ValueError:
                try:
                    q = float(str(q).replace(",", "."))
                except ValueError:
                    q = 0.0
            http_locales.append(Language(header_name=locale, q=q))
    return http_locales


def _get_app_locales() -> List[str]:
    """Returns available app locales as List[str]."""
    locales_dir = get_app_locale_dir()
    if not Path(locales_dir).is_dir():
        return ["en"]
    maybe_is_locale_dir_list = [
        Path(locales_dir, dirname) for dirname in os.listdir(locales_dir)
    ]
    app_locales = [
        maybe_is_locale_dir.name
        for maybe_is_locale_dir in maybe_is_locale_dir_list
        if Path(maybe_is_locale_dir, f"LC_MESSAGES/{APP_LOCALE_DOMAIN}.mo").is_file()
    ]
    if "en" not in app_locales:
        app_locales.insert(0, "en")
    return app_locales


def get_app_locales() -> Union[List[str], Any]:
    """Returns available app locales as List[str],
    first element of the list is default language for the user.
    (Based on user's browser settings)."""
    app_locales = _get_app_locales()
    ctx = getattr(
        threading.current_thread(),
        script_run_context.SCRIPT_RUN_CONTEXT_ATTR_NAME,
        None,
    )
    if not ctx:
        return app_locales
    if ctx.session_state.app_locales:
        return ctx.session_state.app_locales.split(",")
    session_language = get_session_language()
    if session_language:
        app_locales.remove(session_language)
        app_locales.insert(0, session_language)
        ctx.session_state["app_locales"] = ",".join(app_locales)
        return app_locales

    return app_locales


def get_app_locales_meta(
    session_language_as_str: Optional[str] = None,
    change_language: Optional[str] = None,
) -> LanguageInfo_pb2.LanguageInfo:

    locales_meta: List[LanguageInfo_pb2.Language] = []
    normalized_app_locales = _normalize_app_locales(get_app_locales())
    if not change_language:
        session_language = get_session_language()
    else:
        session_language = change_language

    normalized_session_language = normalized_app_locales.get(session_language) or "en"
    session_lang_code = langcodes.Language.get(normalized_session_language)
    if not session_language_as_str:
        from streamlit.web.server.websocket_headers import _get_websocket_headers

        websocket_headers = _get_websocket_headers()
        if websocket_headers:
            session_language_as_str = websocket_headers.get("Accept-Language") or None
        else:
            ctx = getattr(
                threading.current_thread(),
                script_run_context.SCRIPT_RUN_CONTEXT_ATTR_NAME,
                None,
            )
            if ctx:
                session_language_as_str = ctx.session_state["browser_language"]
    accept_languages = get_accept_languages(
        session_language_as_str=session_language_as_str
    )
    session_language_q = 1.0
    for lang in accept_languages:
        if lang.normalized_name is normalized_session_language:
            session_language_q = lang.q
    for language, normalized_language in normalized_app_locales.items():
        try:
            lang_code = langcodes.Language.get(normalized_language) or None
            if not lang_code:
                continue
            try:
                from language_data.names import code_to_names  # type: ignore

                display_name = lang_code.display_name(
                    language=normalized_session_language
                )
                speaking_population = lang_code.speaking_population() or 0
            except (ImportError, ModuleNotFoundError):
                display_name = normalized_language
                speaking_population = 0

            flag = (
                language_constants.LANGUAGE_FLAG_DICTIONARY.get(normalized_language)
                or ""
            )
            lang_q = 0.0
            for lang in accept_languages:
                if lang.normalized_name is normalized_language:
                    lang_q = lang.q

            locales_meta.append(
                LanguageInfo_pb2.Language(
                    localeName=language or "",
                    standardizedTag=normalized_language or "",
                    displayName=display_name or "",
                    flag=flag or "",
                    speakingPopulation=speaking_population,
                    q=lang_q,
                )
            )
        except Exception as e:
            _LOGGER.warning(f"Get langcodes for {language} failed with exception {e}.")
            continue
    # The way we sort Languages determine in what order they will show up in the language picker
    sorted_locales_meta = sorted(
        locales_meta, key=lambda d: d.standardizedTag, reverse=False
    )
    try:
        from language_data.names import code_to_names  # type: ignore

        display_name = session_lang_code.display_name(
            language=normalized_session_language
        )
        speaking_population = session_lang_code.speaking_population() or 0
    except (ImportError, ModuleNotFoundError):
        display_name = normalized_session_language
        speaking_population = 0
    return LanguageInfo_pb2.LanguageInfo(
        sessionLanguage=LanguageInfo_pb2.Language(
            localeName=session_language or "",
            standardizedTag=normalized_session_language or "",
            displayName=display_name or "",
            flag=language_constants.LANGUAGE_FLAG_DICTIONARY.get(
                normalized_session_language
            )
            or "",
            speakingPopulation=speaking_population,
            q=session_language_q or 1.0,
        ),
        availableLanguages=sorted_locales_meta,
    )
