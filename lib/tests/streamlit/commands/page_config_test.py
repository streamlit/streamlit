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

from datetime import timedelta
from pathlib import Path
from unittest import mock

import pytest
from parameterized import param, parameterized

import streamlit as st
from streamlit.commands.page_config import (
    RANDOM_EMOJIS,
    PageIcon,
    _get_favicon_string,
    _lower_clean_dict_keys,
)
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitBadTimeStringError,
    StreamlitInvalidParameterTypeError,
    StreamlitInvalidURLError,
    StreamlitValueError,
)
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.PageConfig_pb2 import PageConfig as PageConfigProto
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.string_util import is_emoji
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class PageConfigTest(DeltaGeneratorTestCase):
    def test_set_page_config_title(self):
        st.set_page_config(page_title="Hello")
        c = self.get_message_from_queue().page_config_changed
        assert c.title == "Hello"

    @parameterized.expand([":shark:", "https://foo.com/image.png"])
    def test_set_page_config_icon_strings(self, icon_string: str):
        """page_config icons can be emoji shortcodes, and image URLs."""
        st.set_page_config(page_icon=icon_string)
        c = self.get_message_from_queue().page_config_changed
        assert c.favicon == icon_string

    def test_set_page_config_emoji_icon_strings(self):
        """page_config icons can be emojis."""
        st.set_page_config(page_icon="🦈")
        c = self.get_message_from_queue().page_config_changed
        assert c.favicon == "emoji:🦈"

    def test_set_page_config_icon_random(self):
        """If page_icon == "random", we choose a random emoji."""
        st.set_page_config(page_icon="random")
        c = self.get_message_from_queue().page_config_changed
        assert c.favicon in set(RANDOM_EMOJIS)
        assert is_emoji(c.favicon)

    def test_set_page_config_icon_invalid_string(self):
        """If set_page_config is passed a garbage icon string, we just pass it
        through without an error (even though nothing will be displayed).
        """
        st.set_page_config(page_icon="st.balloons")
        c = self.get_message_from_queue().page_config_changed
        assert c.favicon == "st.balloons"

    @parameterized.expand([param(b"123"), param("file/on/disk.png")])
    def test_set_page_config_icon_calls_image_to_url(self, icon: PageIcon):
        """For all other page_config icon inputs, we just call image_to_url."""
        with mock.patch(
            "streamlit.commands.page_config.image_to_url",
            return_value="https://mock.url",
        ):
            st.set_page_config(page_icon=icon)
            c = self.get_message_from_queue().page_config_changed
            assert c.favicon == "https://mock.url"

    def test_set_page_config_layout_wide(self):
        st.set_page_config(layout="wide")
        c = self.get_message_from_queue().page_config_changed
        assert c.layout == PageConfigProto.WIDE

    def test_set_page_config_layout_centered(self):
        st.set_page_config(layout="centered")
        c = self.get_message_from_queue().page_config_changed
        assert c.layout == PageConfigProto.CENTERED

    def test_set_page_config_layout_none(self):
        st.set_page_config(layout=None)
        c = self.get_message_from_queue().page_config_changed
        assert c.layout == PageConfigProto.LAYOUT_UNSET

    def test_set_page_config_layout_invalid(self):
        with pytest.raises(StreamlitAPIException):
            st.set_page_config(layout="invalid")

    def test_set_page_config_sidebar_auto(self):
        st.set_page_config(initial_sidebar_state="auto")
        c = self.get_message_from_queue().page_config_changed
        assert c.initial_sidebar_state == PageConfigProto.AUTO

    def test_set_page_config_sidebar_expanded(self):
        st.set_page_config(initial_sidebar_state="expanded")
        c = self.get_message_from_queue().page_config_changed
        assert c.initial_sidebar_state == PageConfigProto.EXPANDED

    def test_set_page_config_sidebar_collapsed(self):
        st.set_page_config(initial_sidebar_state="collapsed")
        c = self.get_message_from_queue().page_config_changed
        assert c.initial_sidebar_state == PageConfigProto.COLLAPSED

    def test_set_page_config_sidebar_none(self):
        st.set_page_config(initial_sidebar_state=None)
        c = self.get_message_from_queue().page_config_changed
        assert c.initial_sidebar_state == PageConfigProto.SIDEBAR_UNSET

    def test_set_page_config_sidebar_locked(self):
        """``"locked"`` maps to the LOCKED protobuf enum value."""
        st.set_page_config(initial_sidebar_state="locked")
        c = self.get_message_from_queue().page_config_changed
        assert c.initial_sidebar_state == PageConfigProto.LOCKED

    def test_set_page_config_sidebar_invalid(self):
        with pytest.raises(StreamlitValueError, match=r"Got 'INVALID'\."):
            st.set_page_config(initial_sidebar_state="INVALID")

    def test_set_page_config_sidebar_width_positive(self):
        st.set_page_config(initial_sidebar_state=400)
        c = self.get_message_from_queue().page_config_changed
        assert c.initial_sidebar_state == PageConfigProto.AUTO
        assert c.initial_sidebar_width.pixel_width == 400

    @parameterized.expand([param(0), param(-100)])
    def test_set_page_config_sidebar_width_invalid(self, invalid_value: int):
        with pytest.raises(StreamlitValueError, match=rf"Got {invalid_value}\."):
            st.set_page_config(initial_sidebar_state=invalid_value)

    def test_set_page_config_menu_items_about(self):
        menu_items = {" about": "*This is an about. This accepts markdown.*"}
        st.set_page_config(menu_items=menu_items)
        c = self.get_message_from_queue().page_config_changed.menu_items
        assert c.about_section_md == "*This is an about. This accepts markdown.*"

    def test_set_page_config_menu_items_bug_and_help(self):
        menu_items = {
            "report a bug": "https://report_a_bug.com",
            "GET HELP": "https://get_help.com",
        }
        st.set_page_config(menu_items=menu_items)
        c = self.get_message_from_queue().page_config_changed.menu_items
        assert not c.hide_report_a_bug
        assert not c.hide_get_help
        assert c.about_section_md == ""
        assert c.report_a_bug_url == "https://report_a_bug.com"
        assert c.get_help_url == "https://get_help.com"

    def test_set_page_config_menu_items_empty_string(self):
        with pytest.raises(StreamlitInvalidURLError, match="mailto:"):
            menu_items = {"report a bug": "", "GET HELP": "", "about": ""}
            st.set_page_config(menu_items=menu_items)

    def test_set_page_config_menu_items_none(self):
        menu_items = {"report a bug": None, "GET HELP": None, "about": None}
        st.set_page_config(menu_items=menu_items)
        c = self.get_message_from_queue().page_config_changed.menu_items
        assert c.hide_report_a_bug
        assert c.hide_get_help
        assert c.about_section_md == ""

    def test_set_page_config_menu_items_invalid(self):
        with pytest.raises(
            StreamlitValueError, match=r"`invalid` is not a supported menu item key"
        ):
            menu_items = {"invalid": "fdsa"}
            st.set_page_config(menu_items=menu_items)

    def test_set_page_config_menu_items_empty_dict(self):
        st.set_page_config(menu_items={})
        c = self.get_message_from_queue().page_config_changed.menu_items
        assert c.about_section_md == ""

    @parameterized.expand(
        [
            ({}, {}),
            (
                {
                    "HELLO_1": 4,
                    "Hello_2": "world",
                    "hElLo_3": 5.5,
                    "": "",
                },
                {"hello_1": 4, "hello_2": "world", "hello_3": 5.5, "": ""},
            ),
        ]
    )
    def test_lower_clean_dict_keys(self, input_dict, answer_dict):
        return_dict = _lower_clean_dict_keys(input_dict)
        assert return_dict == answer_dict

    def test_set_page_config_no_op_without_ctx(self):
        """When no script run context exists, ``set_page_config`` enqueues nothing.

        The early ``return`` when ``get_script_run_ctx()`` is ``None`` prevents the
        page-config message from reaching the (otherwise populated) message queue.
        """
        with mock.patch(
            "streamlit.commands.page_config.get_script_run_ctx",
            return_value=None,
        ):
            st.set_page_config(page_title="Hello")

        assert self.forward_msg_queue._queue == []

    @parameterized.expand(
        [
            (5, 5.0),
            (2.5, 2.5),
            ("5s", 5.0),
            ("1m", 60.0),
            (timedelta(seconds=30), 30.0),
            (1, 1.0),
        ]
    )
    def test_set_page_config_run_every_arms_page_timer(
        self, run_every: int | float | str | timedelta, expected: float
    ) -> None:
        """A passed ``run_every`` enqueues one app-scoped auto-rerun."""
        st.set_page_config(run_every=run_every)

        msgs = self._auto_rerun_messages()
        assert len(msgs) == 1
        assert msgs[0].auto_rerun.interval == expected
        assert msgs[0].auto_rerun.fragment_id == ""
        assert self._stop_auto_rerun_messages() == []

    @parameterized.expand([0, -1, 0.5, "500ms"])
    def test_set_page_config_run_every_below_minimum(
        self, run_every: int | float | str
    ) -> None:
        """Intervals shorter than one second raise and enqueue nothing."""
        with pytest.raises(StreamlitValueError, match="at least 1 second"):
            st.set_page_config(run_every=run_every)

        assert self.forward_msg_queue._queue == []

    @parameterized.expand([float("inf"), float("-inf"), float("nan")])
    def test_set_page_config_run_every_rejects_non_finite_interval(
        self, run_every: float
    ) -> None:
        """Non-finite intervals raise and enqueue nothing."""
        with pytest.raises(StreamlitValueError, match="finite duration"):
            st.set_page_config(run_every=run_every)

        assert self.forward_msg_queue._queue == []

    @parameterized.expand([10**1000, 1e100])
    def test_set_page_config_run_every_rejects_unrepresentable_interval(
        self, run_every: int | float
    ) -> None:
        """Intervals that are too large to represent raise StreamlitValueError."""
        with pytest.raises(StreamlitValueError, match="finite duration"):
            st.set_page_config(run_every=run_every)

        assert self.forward_msg_queue._queue == []

    def test_set_page_config_run_every_accepts_numpy_int(self) -> None:
        """NumPy integers use the same interval path as Python ints."""
        import numpy as np

        st.set_page_config(run_every=np.int64(5))

        msgs = self._auto_rerun_messages()
        assert len(msgs) == 1
        assert msgs[0].auto_rerun.interval == 5

    def test_set_page_config_run_every_bad_string(self) -> None:
        """An unparseable interval string uses the shared time-string error."""
        with pytest.raises(StreamlitBadTimeStringError):
            st.set_page_config(run_every="nope")

        assert self.forward_msg_queue._queue == []

    @parameterized.expand([(True,), (["5s"],)])
    def test_set_page_config_run_every_rejects_invalid_type(
        self, run_every: bool | list[str]
    ) -> None:
        """Booleans and sequences are not intervals."""
        with pytest.raises(StreamlitInvalidParameterTypeError):
            st.set_page_config(run_every=run_every)  # type: ignore[arg-type]

        assert self.forward_msg_queue._queue == []

    def test_set_page_config_run_every_none_stops_page_timer(self) -> None:
        """Explicit ``None`` clears a page timer armed earlier in the run."""
        st.set_page_config(run_every=5)
        st.set_page_config(run_every=None)

        assert [msg.auto_rerun.interval for msg in self._auto_rerun_messages()] == [5]
        stops = self._stop_auto_rerun_messages()
        assert len(stops) == 1
        assert list(stops[0].stop_auto_rerun.fragment_ids) == [""]

    def test_set_page_config_omitted_run_every_does_not_touch_timer(self) -> None:
        """Omitting ``run_every`` does not arm or clear the page timer."""
        st.set_page_config(page_title="Hello")

        assert self._auto_rerun_messages() == []
        assert self._stop_auto_rerun_messages() == []

    def test_set_page_config_omitted_run_every_keeps_earlier_interval(self) -> None:
        """A later call that omits ``run_every`` leaves the earlier interval."""
        st.set_page_config(run_every=5)
        st.set_page_config(page_title="Hello")

        msgs = self._auto_rerun_messages()
        assert len(msgs) == 1
        assert msgs[0].auto_rerun.interval == 5
        assert self._stop_auto_rerun_messages() == []

    def test_set_page_config_run_every_last_call_wins(self) -> None:
        """The last call that passes ``run_every`` is the interval that sticks."""
        st.set_page_config(run_every=5)
        st.set_page_config(run_every="10s")

        assert [msg.auto_rerun.interval for msg in self._auto_rerun_messages()] == [
            5,
            10,
        ]

    def test_set_page_config_run_every_sent_on_fragment_rerun(self) -> None:
        """A fragment-only rerun still publishes an explicit page interval.

        The frontend keeps the countdown when that interval is unchanged, and
        applies a different interval. Dropping the message here would ignore
        ``run_every`` until the next full rerun.
        """
        ctx = get_script_run_ctx()
        assert ctx is not None
        ctx.fragment_ids_this_run = ["frag"]

        st.set_page_config(page_title="Hello", run_every=5)

        assert self.get_message_from_queue(0).HasField("page_config_changed")
        msgs = self._auto_rerun_messages()
        assert len(msgs) == 1
        assert msgs[0].auto_rerun.interval == 5
        assert msgs[0].auto_rerun.fragment_id == ""
        assert self._stop_auto_rerun_messages() == []

    def test_set_page_config_run_every_none_sent_on_fragment_rerun(self) -> None:
        """An explicit ``None`` during a fragment rerun still clears the timer."""
        ctx = get_script_run_ctx()
        assert ctx is not None
        ctx.fragment_ids_this_run = ["frag"]

        st.set_page_config(run_every=None)

        assert self._auto_rerun_messages() == []
        stops = self._stop_auto_rerun_messages()
        assert len(stops) == 1
        assert list(stops[0].stop_auto_rerun.fragment_ids) == [""]

    def test_set_page_config_run_every_still_validates_without_ctx(self) -> None:
        """A too-short interval raises even when nothing can be enqueued."""
        with mock.patch(
            "streamlit.commands.page_config.get_script_run_ctx",
            return_value=None,
        ):
            with pytest.raises(StreamlitValueError, match="at least 1 second"):
                st.set_page_config(run_every=0)

        assert self.forward_msg_queue._queue == []

    def _auto_rerun_messages(self) -> list[ForwardMsg]:
        return [
            msg for msg in self.forward_msg_queue._queue if msg.HasField("auto_rerun")
        ]

    def _stop_auto_rerun_messages(self) -> list[ForwardMsg]:
        return [
            msg
            for msg in self.forward_msg_queue._queue
            if msg.HasField("stop_auto_rerun")
        ]


def test_get_favicon_string_material_icon() -> None:
    """A ``:material/...:`` page icon is validated and returned as a Material icon."""
    assert _get_favicon_string(":material/thumb_up:") == ":material/thumb_up:"


def test_get_favicon_string_converts_path_to_str() -> None:
    """A ``Path`` page icon is converted to a string before ``image_to_url``."""
    with mock.patch(
        "streamlit.commands.page_config.image_to_url",
        return_value="https://mock.url",
    ) as mock_image_to_url:
        result = _get_favicon_string(Path("some/icon.png"))

    assert result == "https://mock.url"
    # The Path must be stringified before reaching image_to_url.
    assert isinstance(mock_image_to_url.call_args.args[0], str)


def test_get_favicon_string_reraises_for_non_string_icon() -> None:
    """Re-raise ``image_to_url`` errors when the page icon is not a string.

    String icons fall through to be returned as-is (they may be emoji shortcodes),
    but a non-string icon that ``image_to_url`` cannot handle must propagate.
    """
    with (
        mock.patch(
            "streamlit.commands.page_config.image_to_url",
            side_effect=RuntimeError("boom"),
        ),
        pytest.raises(RuntimeError, match="boom"),
    ):
        _get_favicon_string(b"123")
