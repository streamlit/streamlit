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

"""Arrow data is registered in media storage only for agent sessions."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING
from unittest.mock import patch

import pandas as pd

import streamlit as st
from streamlit import dataframe_util
from streamlit.elements.lib import agent_spec, data_offload
from streamlit.runtime import Runtime, runtime_util
from streamlit.runtime.caching.cache_data_api import CACHE_DATA_MESSAGE_REPLAY_CTX
from streamlit.runtime.caching.cached_message_replay import (
    ElementMsgData,
    MediaMsgData,
)
from tests.delta_generator_test_case import DeltaGeneratorTestCase

if TYPE_CHECKING:
    from streamlit.runtime.memory_media_file_storage import MemoryFile

_ARROW = dataframe_util.convert_pandas_df_to_arrow_bytes(pd.DataFrame({"n": range(5)}))


class ServeArrowOverHttpTest(DeltaGeneratorTestCase):
    """Registration, its size bound, and its cache record."""

    def tearDown(self) -> None:
        agent_spec.forget_agent_session(self.script_run_ctx.session_id)
        st.cache_data.clear()
        super().tearDown()

    def _record(self) -> None:
        agent_spec.register_agent_session(self.script_run_ctx.session_id)

    def _stored(self) -> dict[str, MemoryFile]:
        return self.media_file_storage._files_by_id

    def test_a_browser_session_registers_nothing(self) -> None:
        """Without recording there is no URL and no second copy of the data."""
        assert data_offload.serve_arrow_over_http(_ARROW, coordinates="[0, 0]") is None
        assert self._stored() == {}

    def test_an_agent_session_registers_the_arrow_bytes(self) -> None:
        """The URL has no extension and serves the bytes under the Arrow type."""
        self._record()

        url = data_offload.serve_arrow_over_http(_ARROW, coordinates="[0, 0]")

        assert url is not None
        assert re.fullmatch(r"/media/[0-9a-f]+", url)
        stored = self.media_file_storage.get_file(url.rsplit("/", 1)[-1])
        assert stored.content == _ARROW
        assert stored.mimetype == "application/vnd.apache.arrow.stream"

    def test_the_message_size_limit_bounds_what_is_served(self) -> None:
        """Bytes at the limit are served; one byte more is not, and nothing is kept."""
        self._record()

        with patch.object(
            runtime_util, "get_max_message_size_bytes", return_value=len(_ARROW)
        ):
            assert data_offload.serve_arrow_over_http(_ARROW, coordinates="[0, 0]")

        self.media_file_storage._files_by_id.clear()
        with patch.object(
            runtime_util, "get_max_message_size_bytes", return_value=len(_ARROW) - 1
        ):
            assert (
                data_offload.serve_arrow_over_http(_ARROW, coordinates="[0, 0]") is None
            )
        assert self._stored() == {}

    def test_no_bytes_or_no_runtime_returns_none(self) -> None:
        """Empty data has nothing to serve, and without a runtime nothing serves it."""
        self._record()

        assert data_offload.serve_arrow_over_http(b"", coordinates="[0, 0]") is None
        assert data_offload.serve_arrow_over_http(None, coordinates="[0, 0]") is None

        Runtime._instance = None
        assert data_offload.serve_arrow_over_http(_ARROW, coordinates="[0, 0]") is None

    def test_inside_a_cached_function_the_bytes_are_saved_as_agent_only(
        self,
    ) -> None:
        """The cache entry keeps the bytes with the element, marked for agents only."""
        self._record()

        @st.cache_data(show_spinner=False)
        def fill() -> None:
            url = data_offload.serve_arrow_over_http(_ARROW, coordinates="[0, 7]")
            st.markdown(str(url))

        fill()

        [message] = CACHE_DATA_MESSAGE_REPLAY_CTX._most_recent_messages
        assert isinstance(message, ElementMsgData)
        assert message.media_data == [
            MediaMsgData(_ARROW, data_offload.ARROW_MIMETYPE, "[0, 7]", agent_only=True)
        ]
