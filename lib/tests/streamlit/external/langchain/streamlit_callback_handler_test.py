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

from __future__ import annotations

import unittest
from pathlib import Path

import langchain
import pytest
import semver
from google.protobuf.json_format import MessageToDict

import streamlit as st
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.external.langchain.capturing_callback_handler import (
    playback_callbacks,
)


class StreamlitCallbackHandlerAPITest(unittest.TestCase):
    def test_import_path(self):
        """StreamlitCallbackHandler is imported by LangChain itself, and so it
        must always be importable from the same location.
        """

        # We exec a string here to prevent the import path from being updated
        # by an IDE during a refactor.
        exec("from streamlit.external.langchain import StreamlitCallbackHandler")

    def test_stable_api(self):
        """StreamlitCallbackHandler must support its original API."""
        from streamlit.external.langchain import (
            LLMThoughtLabeler,
            StreamlitCallbackHandler,
        )

        StreamlitCallbackHandler(
            st.container(),
            max_thought_containers=55,
            expand_new_thoughts=True,
            collapse_completed_thoughts=False,
            thought_labeler=LLMThoughtLabeler(),
        )

    def test_import_from_langchain(self):
        """We can import and use the callback handler from LangChain itself."""
        from langchain.callbacks import (
            StreamlitCallbackHandler as LangChainStreamlitCallbackHandler,
        )

        from streamlit.external.langchain import (
            StreamlitCallbackHandler as InternalStreamlitCallbackHandler,
        )

        # LangChain's StreamlitCallbackHandler() function will use Streamlit's
        # internal StreamlitCallbackHandler class if it exists.
        handler = LangChainStreamlitCallbackHandler(
            st.container(),
            max_thought_containers=55,
            expand_new_thoughts=True,
            collapse_completed_thoughts=False,
            thought_labeler=None,
        )
        self.assertIsInstance(handler, InternalStreamlitCallbackHandler)


class StreamlitCallbackHandlerTest(DeltaGeneratorTestCase):
    @pytest.mark.skipif(
        semver.VersionInfo.parse(langchain.__version__) >= "0.0.296",
        reason="Skip test if langchain version >= 0.0.296, "
        "since test data (alanis.pickle) generated with old langchain version,"
        "and not valid for newer versions.",
    )
    def test_agent_run(self):
        """Test a complete LangChain Agent run using StreamlitCallbackHandler."""
        from streamlit.external.langchain import StreamlitCallbackHandler

        # We use max_thought_containers=2 to ensure that the "History" expander
        # will be created.
        handler = StreamlitCallbackHandler(
            st.container(),
            max_thought_containers=2,
            expand_new_thoughts=True,
            collapse_completed_thoughts=True,
        )

        # Play back a saved LangChain Agent run into our handler
        saved_run = Path(__file__).parent / "test_data/alanis.pickle"
        playback_callbacks([handler], str(saved_run), max_pause_time=0)

        # fmt: off
        expected_deltas = [
            {'addBlock': {}},
            {'addBlock': {}},
            {'addBlock': {'expandable': {'label': 'Thinking...', 'expanded': True, 'icon': 'spinner'}, 'allowEmpty': True}},
            {'newElement': {'markdown': {'body': 'I need to find out the artist\'s full name and then search the FooBar database for their albums.  \nAction: Search  \nAction Input: "The Storm Before the Calm" artist', 'elementType': 'NATIVE'}}},
            {'addBlock': {'expandable': {'label': '**Search:** The Storm Before the Calm" artist', 'icon': 'spinner'}, 'allowEmpty': True}},
            {'newElement': {'markdown': {'body': 'Art Film Music Theater TV "Storm Before the Calm" Brings Climate Dystopia to Praz-Delavallade Praz-Delavallade Ricky Amadour Oct 8, 2022 Storm Before the Calm at Praz-Delavallade Los... Alanis Morissette The Storm Before The Calm on Collectors\' Choice Music The Storm Before The Calm CD Artist: Alanis Morissette Genre: Pop Release Date: 8/26/2022 Qty: Add to Cart List Price: $16.98 Price: $14.43 You Save: $2.55 (15%) Add to Wish List Product Description 2022 release. Choose your favorite the calm before the storm paintings from 176 available designs. All the calm before the storm paintings ship within 48 hours and include a 30-day money-back guarantee. ... Calm Before the Storm Painting. Vanaja\'s Fine-Art. $35. $28. More from This Artist Similar Designs. Storm Before the Calm Painting. Lorie McClung. $22. $18. Choose your favorite calm before the storm paintings from 178 available designs. All calm before the storm paintings ship within 48 hours and include a 30-day money-back guarantee. ... Calm Before the Storm Painting. Vanaja\'s Fine-Art. $35. More from This Artist Similar Designs. Calm Before the Storm in Imagination Harbor Painting. Katheryn ... the storm before the calm. Alanis Morissette. 11 SONGS • 1 HOUR AND 46 MINUTES • JUN 17 2022. Purchase Options. 1. light—the lightworker\'s lament. 05:28. 2. heart—power of a soft heart.', 'elementType': 'NATIVE'}}},
            {'addBlock': {'expandable': {'label': '**Search:** The Storm Before the Calm" artist', 'expanded': False, 'icon': 'check'}, 'allowEmpty': True}}, {'addBlock': {'expandable': {'label': 'Thinking...', 'expanded': True, 'icon': 'spinner'}, 'allowEmpty': True}},
            {'newElement': {'markdown': {'body': "I now know the artist's full name is Alanis Morissette.  \nAction: FooBar DB  \nAction Input: What albums of Alanis Morissette are in the FooBar database?", 'elementType': 'NATIVE'}}},
            {'addBlock': {'expandable': {'label': '**FooBar DB:** What albums of Alanis Morissette are in the FooBar database?', 'icon': 'spinner'}, 'allowEmpty': True}},
            {'newElement': {'markdown': {'body': 'SELECT "Title" FROM "Album" INNER JOIN "Artist" ON "Album"."ArtistId" = "Artist"."ArtistId" WHERE "Name" = \'Alanis Morissette\' LIMIT 5;', 'elementType': 'NATIVE'}}},
            {'newElement': {'markdown': {'body': 'The albums of Alanis Morissette in the FooBar database are Jagged Little Pill.', 'elementType': 'NATIVE'}}},
            {'newElement': {'markdown': {'body': 'The albums of Alanis Morissette in the FooBar database are Jagged Little Pill.', 'elementType': 'NATIVE'}}},
            {'addBlock': {'expandable': {'label': '**FooBar DB:** What albums of Alanis Morissette are in the FooBar database?', 'expanded': False, 'icon': 'check'}, 'allowEmpty': True}},
            {'addBlock': {'expandable': {'label': 'Thinking...', 'expanded': True, 'icon': 'spinner'}, 'allowEmpty': True}}, {'newElement': {'markdown': {'body': "I now know the final answer.  \nFinal Answer: The artist who recently released an album called 'The Storm Before the Calm' is Alanis Morissette and the albums of hers in the FooBar database are Jagged Little Pill.", 'elementType': 'NATIVE'}}},
            {'addBlock': {'expandable': {'label': '**Complete!**', 'expanded': False, 'icon': 'check'}, 'allowEmpty': True}}
        ]
        # fmt: on

        # Assert our Delta messages
        actual_deltas = [
            MessageToDict(delta) for delta in self.get_all_deltas_from_queue()
        ]

        self.assertEqual(expected_deltas, actual_deltas)
