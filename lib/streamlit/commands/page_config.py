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

import math
import numbers
import random
from collections.abc import Mapping
from datetime import timedelta
from pathlib import Path
from textwrap import dedent
from typing import TYPE_CHECKING, Any, Final, Literal, TypeAlias, cast

from streamlit.elements.lib.image_utils import AtomicImage, image_to_url
from streamlit.elements.lib.layout_utils import LayoutConfig
from streamlit.errors import (
    StreamlitInvalidParameterTypeError,
    StreamlitInvalidURLError,
    StreamlitValueError,
)
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg as ForwardProto
from streamlit.proto.PageConfig_pb2 import PageConfig as PageConfigProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.string_util import is_emoji, validate_material_icon
from streamlit.time_util import time_to_seconds
from streamlit.url_util import is_url

if TYPE_CHECKING:
    from typing import TypeGuard

    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        ScriptRunContext,
    )


GET_HELP_KEY: Final = "get help"
REPORT_A_BUG_KEY: Final = "report a bug"
ABOUT_KEY: Final = "about"
_VALID_SIDEBAR_STATE_VALUES: Final = [
    "'auto'",
    "'expanded'",
    "'collapsed'",
    "'locked'",
    "a positive integer (width in pixels)",
]
_MENU_ITEM_URL_PROTOCOLS: Final = ("http", "https", "mailto")

PageIcon: TypeAlias = AtomicImage | str
Layout: TypeAlias = Literal["centered", "wide"]
InitialSideBarState: TypeAlias = (
    Literal["auto", "expanded", "collapsed", "locked"] | int
)
_GetHelp: TypeAlias = Literal["Get help", "Get Help", "get help"]
_ReportABug: TypeAlias = Literal["Report a bug", "report a bug"]
_About: TypeAlias = Literal["About", "about"]
MenuKey: TypeAlias = Literal[_GetHelp, _ReportABug, _About]
MenuItems: TypeAlias = Mapping[MenuKey, str | None]

RANDOM_EMOJIS: Final = list(
    "🔥™🎉🚀🌌💣✨🌙🎆🎇💥🤩🤙🌛🤘⬆💡🤪🥂⚡💨🌠🎊🍿😛🔮🤟🌃🍃🍾💫▪🌴🎈🎬🌀🎄😝☔⛽🍂💃😎🍸🎨🥳☀😍🅱🌞😻🌟😜💦💅🦄😋😉👻🍁🤤👯🌻‼🌈👌🎃💛😚🔫🙌👽🍬🌅☁🍷👭☕🌚💁👅🥰🍜😌🎥🕺❕🧡☄💕🍻✅🌸🚬🤓🍹®☺💪😙☘🤠✊🤗🍵🤞😂💯😏📻🎂💗💜🌊❣🌝😘💆🤑🌿🦋😈⛄🚿😊🌹🥴😽💋😭🖤🙆👐⚪💟☃🙈🍭💻🥀🚗🤧🍝💎💓🤝💄💖🔞⁉⏰🕊🎧☠♥🌳🏾🙉⭐💊🍳🌎🙊💸❤🔪😆🌾✈📚💀🏠✌🏃🌵🚨💂🤫🤭😗😄🍒👏🙃🖖💞😅🎅🍄🆓👉💩🔊🤷⌚👸😇🚮💏👳🏽💘💿💉👠🎼🎶🎤👗❄🔐🎵🤒🍰👓🏄🌲🎮🙂📈🚙📍😵🗣❗🌺🙄👄🚘🥺🌍🏡♦💍🌱👑👙☑👾🍩🥶📣🏼🤣☯👵🍫➡🎀😃✋🍞🙇😹🙏👼🐝⚫🎁🍪🔨🌼👆👀😳🌏📖👃🎸👧💇🔒💙😞⛅🏻🍴😼🗿🍗♠🦁✔🤖☮🐢🐎💤😀🍺😁😴📺☹😲👍🎭💚🍆🍋🔵🏁🔴🔔🧐👰☎🏆🤡🐠📲🙋📌🐬✍🔑📱💰🐱💧🎓🍕👟🐣👫🍑😸🍦👁🆗🎯📢🚶🦅🐧💢🏀🚫💑🐟🌽🏊🍟💝💲🐍🍥🐸☝♣👊⚓❌🐯🏈📰🌧👿🐳💷🐺📞🆒🍀🤐🚲🍔👹🙍🌷🙎🐥💵🔝📸⚠❓🎩✂🍼😑⬇⚾🍎💔🐔⚽💭🏌🐷🍍✖🍇📝🍊🐙👋🤔🥊🗽🐑🐘🐰💐🐴♀🐦🍓✏👂🏴👇🆘😡🏉👩💌😺✝🐼🐒🐶👺🖕👬🍉🐻🐾⬅⏬▶👮🍌♂🔸👶🐮👪⛳🐐🎾🐕👴🐨🐊🔹©🎣👦👣👨👈💬⭕📹📷"
)


def _lower_clean_dict_keys(dict: MenuItems) -> dict[str, Any]:
    return {str(k).lower().strip(): v for k, v in dict.items()}


def _get_favicon_string(page_icon: PageIcon) -> str:
    """Return the string to pass to the frontend to have it show
    the given PageIcon.

    If page_icon is a string that looks like an emoji (or an emoji shortcode),
    we return it as-is. Otherwise we use `image_to_url` to return a URL.

    (If `image_to_url` raises an error and page_icon is a string, return
    the unmodified page_icon string instead of re-raising the error.)
    """

    # Choose a random emoji.
    if page_icon == "random":
        return get_random_emoji()

    # If page_icon is an emoji, return it as is.
    if isinstance(page_icon, str) and is_emoji(page_icon):
        return f"emoji:{page_icon}"

    if isinstance(page_icon, str) and page_icon.startswith(":material"):
        return validate_material_icon(page_icon)

    # Convert Path to string if necessary
    if isinstance(page_icon, Path):
        page_icon = str(page_icon)

    # Fall back to image_to_url.
    try:
        return image_to_url(
            page_icon,
            layout_config=LayoutConfig(
                width="stretch"
            ),  # Always use full width for favicons
            clamp=False,
            channels="RGB",
            output_format="auto",
            image_id="favicon",
        )
    except Exception:
        if isinstance(page_icon, str):
            # This fall-thru handles emoji shortcode strings (e.g. ":shark:"),
            # which aren't valid filenames and so will cause an Exception from
            # `image_to_url`.
            return page_icon
        raise


class _RunEveryNotSet:
    """Sentinel for an omitted ``run_every``.

    ``repr`` is ``None`` so ``help()`` and generated signatures show the public
    default. Identity distinguishes "not passed" from an explicit ``None``,
    which disables auto-rerun.
    """

    def __repr__(self) -> str:
        return "None"


_RUN_EVERY_NOT_SET: Final[int | float | timedelta | str | None] = cast(
    "int | float | timedelta | str | None", _RunEveryNotSet()
)
_PAGE_RUN_EVERY_MIN_SECONDS: Final = 1.0
# Protobuf `float` is single precision. Larger values become non-finite on the wire.
_MAX_PAGE_RUN_EVERY_SECONDS: Final = 3.4028234663852886e38


def _resolve_page_run_every(
    run_every: int | float | timedelta | str | None,
) -> float | None:
    """Return the page interval in seconds, or ``None`` to disable it."""
    if run_every is None:
        return None

    if isinstance(run_every, bool) or not isinstance(
        run_every, (str, timedelta, numbers.Real)
    ):
        raise StreamlitInvalidParameterTypeError(
            "run_every",
            type(run_every).__name__,
            ["int", "float", "timedelta", "str", "None"],
        )

    seconds = time_to_seconds(run_every, coerce_none_to_inf=False)
    # `None` is only returned for a `None` input, which already returned above.
    if seconds is None:  # pragma: no cover - defensive
        raise StreamlitValueError(
            "run_every",
            ["a finite duration", "None"],
            detail=f"Got {run_every!r}.",
        )
    try:
        # Huge ints overflow when converted to float. Reject them as values,
        # not as a leaked OverflowError.
        seconds_float = float(seconds)
    except OverflowError:
        seconds_float = math.inf
    if not math.isfinite(seconds_float) or seconds_float > _MAX_PAGE_RUN_EVERY_SECONDS:
        raise StreamlitValueError(
            "run_every",
            ["a finite duration", "None"],
            detail=f"Got {run_every!r}.",
        )
    if seconds_float < _PAGE_RUN_EVERY_MIN_SECONDS:
        raise StreamlitValueError(
            "run_every",
            ["a duration of at least 1 second", "None"],
            detail=f"Got {run_every!r}.",
        )
    return seconds_float


def _enqueue_page_auto_rerun(ctx: ScriptRunContext, seconds: float | None) -> None:
    """Arm or clear the page-level auto-rerun timer.

    An empty ``fragment_id`` is the app-scoped timer. Full reruns drop every
    timer when the frontend handles ``NewSession``; this message re-arms the
    page timer. Fragment-only reruns send it too, so an explicit interval
    change or ``None`` still applies. The frontend keeps the existing page
    countdown when the interval is unchanged, so a fragment tick does not
    restart it. ``None`` clears a timer armed by an earlier call.
    """
    msg = ForwardProto()
    if seconds is None:
        msg.stop_auto_rerun.fragment_ids.append("")
    else:
        msg.auto_rerun.interval = seconds
        msg.auto_rerun.fragment_id = ""
    ctx.enqueue(msg)


@gather_metrics("set_page_config")
def set_page_config(
    page_title: str | None = None,
    page_icon: PageIcon | None = None,
    layout: Layout | None = None,
    initial_sidebar_state: InitialSideBarState | None = None,
    menu_items: MenuItems | None = None,
    *,
    run_every: int | float | timedelta | str | None = _RUN_EVERY_NOT_SET,
) -> None:
    """
    Configure the default settings of the page.

    This command can be called multiple times in a script run to dynamically
    change the page configuration. The calls are additive, with each successive
    call overriding only the parameters that are specified. ``run_every``
    reruns the whole page on an interval.

    Parameters
    ----------
    page_title: str or None
        The page title, shown in the browser tab. If this is ``None``
        (default), the page title is inherited from the previous call of
        ``st.set_page_config``. If this is ``None`` and no previous call
        exists, the page title is inferred from the page source.

        If a page source is a Python file, its inferred title is derived from
        the filename. If a page source is a callable object, its inferred title
        is derived from the callable's name.

    page_icon : Anything supported by st.image (except list), str, or None
        The page favicon. If ``page_icon`` is ``None`` (default), the page icon
        is inherited from the previous call of ``st.set_page_config``. If this
        is ``None`` and no previous call exists, the favicon is a monochrome
        Streamlit logo.

        In addition to the types supported by |st.image|_ (except list), the
        following strings are valid:

        - A single-character emoji. For example, you can set ``page_icon="🦈"``.

        - An emoji short code. For example, you can set ``page_icon=":shark:"``.
          For a list of all supported codes, see
          https://share.streamlit.io/streamlit/emoji-shortcodes.

        - The string literal, ``"random"``. You can set ``page_icon="random"``
          to set a random emoji from the supported list above.

        - An icon from the Material Symbols library (rounded style) in the
          format ``":material/icon_name:"`` where "icon_name" is the name
          of the icon in snake case.

          For example, ``page_icon=":material/thumb_up:"`` will display the
          Thumb Up icon. Find additional icons in the `Material Symbols \
          <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
          font library.

        .. note::
            Colors are not supported for Material icons. When you use a
            Material icon for favicon, it will be black, regardless of browser
            theme.

        .. |st.image| replace:: ``st.image``
        .. _st.image: https://docs.streamlit.io/develop/api-reference/media/st.image

    layout: "centered", "wide", or None
        Layout of the page content. The following layouts are supported:

        - ``None`` (default): The page layout is inherited from the previous
          call of ``st.set_page_config``. If no previous call exists, the page
          layout is ``"centered"``.
        - ``"centered"``: Page elements are constrained to a centered column of
          fixed width.
        - ``"wide"``: Page elements use the entire screen width.

    initial_sidebar_state: "auto", "expanded", "collapsed", "locked", int, or None
        Initial state of the sidebar. The following states are supported:

        - ``None`` (default): The sidebar state is inherited from the previous
          call of ``st.set_page_config``. If no previous call exists, the
          sidebar state is ``"auto"``.
        - ``"auto"``: The sidebar is hidden on small devices and shown
          otherwise.
        - ``"expanded"``: The sidebar is shown initially.
        - ``"collapsed"``: The sidebar is hidden initially.
        - ``"locked"``: On desktop, the sidebar is expanded with all collapse
          controls hidden so users cannot close it. On narrow/mobile
          viewports the lock degrades gracefully: the sidebar starts
          collapsed and can be toggled to avoid covering the main content.
        - ``int``: The sidebar will use ``"auto"`` behavior but start with the
          specified width in pixels. The width must be between 200 and 600
          pixels, inclusive.

        In most cases, ``"auto"`` provides the best user experience across
        devices of different sizes.

    menu_items: dict
        Configure the menu that appears on the top-right side of this app.
        The keys in this dict denote the menu item to configure. The following
        keys can have string or ``None`` values:

        - "Get help": The URL this menu item should point to.
        - "Report a Bug": The URL this menu item should point to.
        - "About": A markdown string to show in the About dialog.

        A URL may also refer to an email address e.g. ``mailto:john@example.com``.

        If you do not include a key, its menu item will be hidden (unless it
        was set by a previous call to ``st.set_page_config``). To remove an
        item that was specified in a previous call to ``st.set_page_config``,
        set its value to ``None`` in the dictionary.

    run_every : int, float, timedelta, str, or None
        The time interval between automatic full-page reruns. Omit this
        argument to leave the interval from an earlier call in the same run
        unchanged. If no call in the run passes ``run_every``, the page does
        not auto-rerun. Pass ``None`` to turn auto-rerun off.

        Accepted values:

        - ``None`` to disable auto-rerun.
        - An ``int`` or ``float`` specifying the interval in seconds.
        - A string specifying the time in a format supported by `Pandas'
          Timedelta constructor <https://pandas.pydata.org/docs/reference/api/pandas.Timedelta.html>`_,
          e.g. ``"5s"``, ``"1m"``, or ``"1h23s"``.
        - A ``timedelta`` object from `Python's built-in datetime library
          <https://docs.python.org/3/library/datetime.html#timedelta-objects>`_,
          e.g. ``timedelta(seconds=30)``.

        The interval must be at least 1 second. ``0``, negative values, and
        any interval shorter than 1 second raise an exception. Non-finite
        values and intervals that are too large to represent raise as well.

        Each tick re-executes the whole script and redraws the whole page.
        Prefer |st.fragment|_ with its own ``run_every`` when only one section
        needs to refresh. The two intervals can be used together: a slower
        page interval refreshes the rest of the app, and a faster fragment
        interval refreshes the live section.

        .. note::
            - Auto-rerun pauses while an ``st.dialog`` is open and resumes after
              it closes.
            - An unsubmitted ``st.form`` does not pause auto-rerun. In-progress
              values stay on screen, and the rest of the page reruns. For
              multi-step form flows, prefer a fragment or pass ``run_every=None``.
            - Stopping the script leaves auto-rerun armed. The next interval
              starts the page again, the same way ``@st.fragment(run_every=...)``
              does.
            - Browsers may fire the timer less often while the tab is in the
              background.

        .. |st.fragment| replace:: ``st.fragment``
        .. _st.fragment: https://docs.streamlit.io/develop/api-reference/execution-flow/st.fragment

    Examples
    --------
    >>> import streamlit as st
    >>>
    >>> st.set_page_config(
    ...     page_title="Ex-stream-ly Cool App",
    ...     page_icon="🧊",
    ...     layout="wide",
    ...     initial_sidebar_state="expanded",
    ...     menu_items={
    ...         'Get Help': 'https://www.extremelycoolapp.com/help',
    ...         'Report a bug': "https://www.extremelycoolapp.com/bug",
    ...         'About': "# This is a header. This is an *extremely* cool app!"
    ...     }
    ... )

    Rerun the whole page every 5 seconds. Prefer ``@st.fragment(run_every=...)``
    when only one section needs to refresh.

    >>> import streamlit as st
    >>>
    >>> st.set_page_config(page_title="Ops Dashboard", run_every="5s")
    >>>
    >>> if "ticks" not in st.session_state:
    ...     st.session_state.ticks = 0
    >>> st.session_state.ticks += 1
    >>> st.metric("Refreshes", st.session_state.ticks)

    A slower page interval and a faster fragment interval can run together.

    >>> import streamlit as st
    >>>
    >>> st.set_page_config(run_every="60s")
    >>>
    >>> if "page_ticks" not in st.session_state:
    ...     st.session_state.page_ticks = 0
    >>> st.session_state.page_ticks += 1
    >>> if "price" not in st.session_state:
    ...     st.session_state.price = 100.0
    >>>
    >>> @st.fragment(run_every="2s")
    ... def ticker():
    ...     st.session_state.price += 0.1
    ...     st.metric("Price", round(st.session_state.price, 2))
    >>>
    >>> ticker()
    >>> st.metric("Page refreshes", st.session_state.page_ticks)
    """

    resolved_run_every: float | None = None
    # The public annotation is the user-facing type. The default is a sentinel
    # so an omitted argument is distinct from an explicit ``None``.
    run_every_was_set = run_every is not _RUN_EVERY_NOT_SET
    if run_every_was_set:
        resolved_run_every = _resolve_page_run_every(run_every)

    msg = ForwardProto()

    if page_title is not None:
        msg.page_config_changed.title = page_title

    if page_icon is not None:
        msg.page_config_changed.favicon = _get_favicon_string(page_icon)

    pb_layout: PageConfigProto.Layout.ValueType
    if layout == "centered":
        pb_layout = PageConfigProto.CENTERED
    elif layout == "wide":
        pb_layout = PageConfigProto.WIDE
    elif layout is None:
        # Allows for multiple (additive) calls to set_page_config
        pb_layout = PageConfigProto.LAYOUT_UNSET
    else:
        # Note: Pylance incorrectly notes this error as unreachable
        raise StreamlitValueError("layout", ["'centered'", "'wide'"])

    msg.page_config_changed.layout = pb_layout

    pb_sidebar_state: PageConfigProto.SidebarState.ValueType
    if initial_sidebar_state == "auto":
        pb_sidebar_state = PageConfigProto.AUTO
    elif initial_sidebar_state == "expanded":
        pb_sidebar_state = PageConfigProto.EXPANDED
    elif initial_sidebar_state == "collapsed":
        pb_sidebar_state = PageConfigProto.COLLAPSED
    elif initial_sidebar_state == "locked":
        pb_sidebar_state = PageConfigProto.LOCKED
    elif initial_sidebar_state is None:
        # Allows for multiple (additive) calls to set_page_config
        pb_sidebar_state = PageConfigProto.SIDEBAR_UNSET
    elif isinstance(initial_sidebar_state, int):
        # Integer values set the sidebar width and use AUTO state
        if initial_sidebar_state <= 0:
            raise StreamlitValueError(
                "initial_sidebar_state",
                _VALID_SIDEBAR_STATE_VALUES,
                detail=f"Got {initial_sidebar_state}.",
            )
        pb_sidebar_state = PageConfigProto.AUTO
        msg.page_config_changed.initial_sidebar_width.pixel_width = (
            initial_sidebar_state
        )
    else:
        # Note: Pylance incorrectly notes this error as unreachable
        raise StreamlitValueError(
            "initial_sidebar_state",
            _VALID_SIDEBAR_STATE_VALUES,
            detail=f"Got {initial_sidebar_state!r}.",
        )

    msg.page_config_changed.initial_sidebar_state = pb_sidebar_state

    if menu_items is not None:
        lowercase_menu_items = cast("MenuItems", _lower_clean_dict_keys(menu_items))
        validate_menu_items(lowercase_menu_items)
        menu_items_proto = msg.page_config_changed.menu_items
        set_menu_items_proto(lowercase_menu_items, menu_items_proto)

    ctx = get_script_run_ctx()
    if ctx is None:
        return
    ctx.enqueue(msg)
    if run_every_was_set:
        _enqueue_page_auto_rerun(ctx, resolved_run_every)


def get_random_emoji() -> str:
    # TODO: fix the random seed with a hash of the user's app code, for stability?
    return random.choice(RANDOM_EMOJIS)  # noqa: S311


def set_menu_items_proto(
    lowercase_menu_items: MenuItems, menu_items_proto: PageConfigProto.MenuItems
) -> None:
    if GET_HELP_KEY in lowercase_menu_items:
        get_help_url = lowercase_menu_items[GET_HELP_KEY]
        if get_help_url is not None:
            menu_items_proto.get_help_url = get_help_url
        else:
            menu_items_proto.hide_get_help = True

    if REPORT_A_BUG_KEY in lowercase_menu_items:
        report_a_bug_url = lowercase_menu_items[REPORT_A_BUG_KEY]
        if report_a_bug_url is not None:
            menu_items_proto.report_a_bug_url = report_a_bug_url
        else:
            menu_items_proto.hide_report_a_bug = True

    if ABOUT_KEY in lowercase_menu_items:
        if lowercase_menu_items[ABOUT_KEY] is not None:
            menu_items_proto.about_section_md = dedent(
                lowercase_menu_items[ABOUT_KEY] or ""
            )
        else:
            # For multiple calls to set_page_config, clears previously set about markdown
            menu_items_proto.clear_about_md = True


def validate_menu_items(menu_items: MenuItems) -> None:
    for k, v in menu_items.items():
        if not valid_menu_item_key(k):
            raise StreamlitValueError(
                "menu_items",
                ["'Get help'", "'Report a bug'", "'About'"],
                detail=f"`{k}` is not a supported menu item key.",
            )
        if v is not None and k != ABOUT_KEY and not is_url(v, _MENU_ITEM_URL_PROTOCOLS):
            raise StreamlitInvalidURLError(v, _MENU_ITEM_URL_PROTOCOLS)


def valid_menu_item_key(key: str) -> TypeGuard[MenuKey]:
    return key in {GET_HELP_KEY, REPORT_A_BUG_KEY, ABOUT_KEY}
