# Copyright 2018-2022 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from urllib.parse import urlparse
from textwrap import dedent

from streamlit.script_run_context import get_script_run_ctx
from streamlit.proto import ForwardMsg_pb2
from streamlit.proto import PageConfig_pb2
from streamlit.elements import image
from streamlit.errors import StreamlitAPIException
from streamlit.util import lower_clean_dict_keys

GET_HELP_KEY = "get help"
REPORT_A_BUG_KEY = "report a bug"
ABOUT_KEY = "about"


def set_page_config(
    page_title=None,
    page_icon=None,
    layout="centered",
    initial_sidebar_state="auto",
    menu_items=None,
):
    """
    Configures the default settings of the page.

    .. note::
        This must be the first Streamlit command used in your app, and must only
        be set once.

    Parameters
    ----------
    page_title: str or None
        The page title, shown in the browser tab. If None, defaults to the
        filename of the script ("app.py" would show "app • Streamlit").
    page_icon : Anything supported by st.image or str or None
        The page favicon.
        Besides the types supported by `st.image` (like URLs or numpy arrays),
        you can pass in an emoji as a string ("🦈") or a shortcode (":shark:").
        If you're feeling lucky, try "random" for a random emoji!
        Emoji icons are courtesy of Twemoji and loaded from MaxCDN.
    layout: "centered" or "wide"
        How the page content should be laid out. Defaults to "centered",
        which constrains the elements into a centered column of fixed width;
        "wide" uses the entire screen.
    initial_sidebar_state: "auto" or "expanded" or "collapsed"
        How the sidebar should start out. Defaults to "auto",
        which hides the sidebar on mobile-sized devices, and shows it otherwise.
        "expanded" shows the sidebar initially; "collapsed" hides it.
    menu_items: dict
        Configure the menu that appears on the top-right side of this app.
        The keys in this dict denote the menu item you'd like to configure:

        - "Get help": str or None
            The URL this menu item should point to.
            If None, hides this menu item.
        - "Report a Bug": str or None
            The URL this menu item should point to.
            If None, hides this menu item.
        - "About": str or None
            A markdown string to show in the About dialog.
            If None, only shows Streamlit's default About text.


    Example
    -------
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
    """

    msg = ForwardMsg_pb2.ForwardMsg()

    if page_title:
        msg.page_config_changed.title = page_title

    if page_icon:
        if page_icon == "random":
            page_icon = get_random_emoji()

        msg.page_config_changed.favicon = image.image_to_url(
            page_icon,
            width=-1,  # Always use full width for favicons
            clamp=False,
            channels="RGB",
            output_format="auto",
            image_id="favicon",
            allow_emoji=True,
        )

    if layout == "centered":
        layout = PageConfig_pb2.PageConfig.CENTERED
    elif layout == "wide":
        layout = PageConfig_pb2.PageConfig.WIDE
    else:
        raise StreamlitAPIException(
            f'`layout` must be "centered" or "wide" (got "{layout}")'
        )
    msg.page_config_changed.layout = layout

    if initial_sidebar_state == "auto":
        initial_sidebar_state = PageConfig_pb2.PageConfig.AUTO
    elif initial_sidebar_state == "expanded":
        initial_sidebar_state = PageConfig_pb2.PageConfig.EXPANDED
    elif initial_sidebar_state == "collapsed":
        initial_sidebar_state = PageConfig_pb2.PageConfig.COLLAPSED
    else:
        raise StreamlitAPIException(
            '`initial_sidebar_state` must be "auto" or "expanded" or "collapsed" '
            + f'(got "{initial_sidebar_state}")'
        )

    msg.page_config_changed.initial_sidebar_state = initial_sidebar_state

    if menu_items is not None:
        lowercase_menu_items = lower_clean_dict_keys(menu_items)
        validate_menu_items(lowercase_menu_items)
        menu_items_proto = msg.page_config_changed.menu_items
        set_menu_items_proto(lowercase_menu_items, menu_items_proto)

    ctx = get_script_run_ctx()
    if ctx is None:
        return
    ctx.enqueue(msg)


def get_random_emoji():
    import random

    # Emojis recommended by https://share.streamlit.io/rensdimmendaal/emoji-recommender/main/app/streamlit.py
    # for the term "streamlit". Watch out for zero-width joiners,
    # as they won't parse correctly in the list() call!
    RANDOM_EMOJIS = list(
        "🔥™🎉🚀🌌💣✨🌙🎆🎇💥🤩🤙🌛🤘⬆💡🤪🥂⚡💨🌠🎊🍿😛🔮🤟🌃🍃🍾💫▪🌴🎈🎬🌀🎄😝☔⛽🍂💃😎🍸🎨🥳☀😍🅱🌞😻🌟😜💦💅🦄😋😉👻🍁🤤👯🌻‼🌈👌🎃💛😚🔫🙌👽🍬🌅☁🍷👭☕🌚💁👅🥰🍜😌🎥🕺❕🧡☄💕🍻✅🌸🚬🤓🍹®☺💪😙☘🤠✊🤗🍵🤞😂💯😏📻🎂💗💜🌊❣🌝😘💆🤑🌿🦋😈⛄🚿😊🌹🥴😽💋😭🖤🙆👐⚪💟☃🙈🍭💻🥀🚗🤧🍝💎💓🤝💄💖🔞⁉⏰🕊🎧☠♥🌳🏾🙉⭐💊🍳🌎🙊💸❤🔪😆🌾✈📚💀🏠✌🏃🌵🚨💂🤫🤭😗😄🍒👏🙃🖖💞😅🎅🍄🆓👉💩🔊🤷⌚👸😇🚮💏👳🏽💘💿💉👠🎼🎶🎤👗❄🔐🎵🤒🍰👓🏄🌲🎮🙂📈🚙📍😵🗣❗🌺🙄👄🚘🥺🌍🏡♦💍🌱👑👙☑👾🍩🥶📣🏼🤣☯👵🍫➡🎀😃✋🍞🙇😹🙏👼🐝⚫🎁🍪🔨🌼👆👀😳🌏📖👃🎸👧💇🔒💙😞⛅🏻🍴😼🗿🍗♠🦁✔🤖☮🐢🐎💤😀🍺😁😴📺☹😲👍🎭💚🍆🍋🔵🏁🔴🔔🧐👰☎🏆🤡🐠📲🙋📌🐬✍🔑📱💰🐱💧🎓🍕👟🐣👫🍑😸🍦👁🆗🎯📢🚶🦅🐧💢🏀🚫💑🐟🌽🏊🍟💝💲🐍🍥🐸☝♣👊⚓❌🐯🏈📰🌧👿🐳💷🐺📞🆒🍀🤐🚲🍔👹🙍🌷🙎🐥💵🔝📸⚠❓🎩✂🍼😑⬇⚾🍎💔🐔⚽💭🏌🐷🍍✖🍇📝🍊🐙👋🤔🥊🗽🐑🐘🐰💐🐴♀🐦🍓✏👂🏴👇🆘😡🏉👩💌😺✝🐼🐒🐶👺🖕👬🍉🐻🐾⬅⏬▶👮🍌♂🔸👶🐮👪⛳🐐🎾🐕👴🐨🐊🔹©🎣👦👣👨👈💬⭕📹📷"
    )

    # Also pick out some vanity emojis.
    ENG_EMOJIS = [
        "🎈",  # st.balloons 🎈🎈
        "🤓",  # Abhi
        "🏈",  # Amey
        "🚲",  # Thiago
        "🐧",  # Matteo
        "🦒",  # Ken
        "🐳",  # Karrie
        "🕹️",  # Jonathan
        "🇦🇲",  # Henrikh
        "🎸",  # Guido
        "🦈",  # Austin
        "💎",  # Emiliano
        "👩‍🎤",  # Naomi
        "🧙‍♂️",  # Jon
        "🐻",  # Brandon
        "🎎",  # James
        # TODO: Solicit emojis from the rest of Streamlit
    ]

    # Weigh our emojis 10x, cuz we're awesome!
    # TODO: fix the random seed with a hash of the user's app code, for stability?
    return random.choice(RANDOM_EMOJIS + 10 * ENG_EMOJIS)


def set_menu_items_proto(lowercase_menu_items, menu_items_proto):
    if GET_HELP_KEY in lowercase_menu_items:
        if lowercase_menu_items[GET_HELP_KEY] is not None:
            menu_items_proto.get_help_url = lowercase_menu_items[GET_HELP_KEY]
        else:
            menu_items_proto.hide_get_help = True

    if REPORT_A_BUG_KEY in lowercase_menu_items:
        if lowercase_menu_items[REPORT_A_BUG_KEY] is not None:
            menu_items_proto.report_a_bug_url = lowercase_menu_items[REPORT_A_BUG_KEY]
        else:
            menu_items_proto.hide_report_a_bug = True

    if ABOUT_KEY in lowercase_menu_items:
        if lowercase_menu_items[ABOUT_KEY] is not None:
            menu_items_proto.about_section_md = dedent(lowercase_menu_items[ABOUT_KEY])


def validate_menu_items(dict):
    for k, v in dict.items():
        if not valid_menu_item_key(k):
            raise StreamlitAPIException(
                "We only accept the keys: "
                f'"Get help", "Report a bug", and "About" ("{k}" is not a valid key.)'
            )
        if v is not None:
            if not valid_url(v) and k != ABOUT_KEY:
                raise StreamlitAPIException(f'"{v}" is a not a valid URL!')


def valid_menu_item_key(key):
    return key in [GET_HELP_KEY, REPORT_A_BUG_KEY, ABOUT_KEY]


def valid_url(url):
    """
    This code is copied and pasted from:
    https://stackoverflow.com/questions/7160737/how-to-validate-a-url-in-python-malformed-or-not
    """
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except:
        return False
