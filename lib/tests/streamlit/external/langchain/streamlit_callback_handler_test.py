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
            {'addBlock': {'expandable': {'label': '🤔 **Thinking...**', 'expanded': True}, 'allowEmpty': True}},
            {'newElement': {'markdown': {'body': 'I need to find out the artist\'s full name and then search the FooBar database for their albums.  \nAction: Search  \nAction Input: "The Storm Before the Calm" artist', 'elementType': 'NATIVE'}}},
            {'addBlock': {'expandable': {'label': '🤔 **Search:** The Storm Before the Calm" artist', 'expanded': True}, 'allowEmpty': True}},
            {'newElement': {'markdown': {'body': '**Alanis Morissette**', 'elementType': 'NATIVE'}}},
            {'addBlock': {'expandable': {'label': '✅ **Search:** The Storm Before the Calm" artist'}, 'allowEmpty': True}},
            {'addBlock': {'expandable': {'label': '🤔 **Thinking...**', 'expanded': True}, 'allowEmpty': True}},
            {'newElement': {'markdown': {'body': "I now need to search the FooBar database for Alanis Morissette's albums.  \nAction: FooBar DB  \nAction Input: What albums of Alanis Morissette are in the FooBar database?", 'elementType': 'NATIVE'}}},
            {'addBlock': {'expandable': {'label': '🤔 **FooBar DB:** What albums of Alanis Morissette are in the FooBar database?', 'expanded': True}, 'allowEmpty': True}},
            {'newElement': {'markdown': {'body': 'SELECT "Title" FROM "Album" INNER JOIN "Artist" ON "Album"."ArtistId" = "Artist"."ArtistId" WHERE "Name" = \'Alanis Morissette\' LIMIT 5;', 'elementType': 'NATIVE'}}},
            {'newElement': {'markdown': {'body': 'The albums of Alanis Morissette in the FooBar database are Jagged Little Pill.', 'elementType': 'NATIVE'}}},
            {'newElement': {'markdown': {'body': '**The albums of Alanis Morissette in the FooBar database are Jagged Little Pill.**', 'elementType': 'NATIVE'}}},
            {'addBlock': {'expandable': {'label': '✅ **FooBar DB:** What albums of Alanis Morissette are in the FooBar database?'}, 'allowEmpty': True}},
            {'addBlock': {'expandable': {'label': '🤔 **Thinking...**', 'expanded': True}, 'allowEmpty': True}},
            {'newElement': {'markdown': {'body': "I now know the final answer.  \nFinal Answer: The artist who recently released an album called 'The Storm Before the Calm' is Alanis Morissette and the albums of hers in the FooBar database are Jagged Little Pill.", 'elementType': 'NATIVE'}}},
            {'addBlock': {'expandable': {'label': '📚 **History**'}, 'allowEmpty': True}},
            {'newElement': {'markdown': {'body': '✅ **Search:** The Storm Before the Calm" artist', 'elementType': 'NATIVE'}}},
            {'newElement': {'markdown': {'body': 'I need to find out the artist\'s full name and then search the FooBar database for their albums.  \nAction: Search  \nAction Input: "The Storm Before the Calm" artist', 'elementType': 'NATIVE'}}},
            {'newElement': {'markdown': {'body': '**Alanis Morissette**', 'elementType': 'NATIVE'}}},
            {'newElement': {'empty': {}}},
            {'newElement': {'markdown': {'body': '✅ **FooBar DB:** What albums of Alanis Morissette are in the FooBar database?', 'elementType': 'NATIVE'}}},
            {'newElement': {'markdown': {'body': "I now need to search the FooBar database for Alanis Morissette's albums.  \nAction: FooBar DB  \nAction Input: What albums of Alanis Morissette are in the FooBar database?", 'elementType': 'NATIVE'}}},
            {'newElement': {'markdown': {'body': 'SELECT "Title" FROM "Album" INNER JOIN "Artist" ON "Album"."ArtistId" = "Artist"."ArtistId" WHERE "Name" = \'Alanis Morissette\' LIMIT 5;', 'elementType': 'NATIVE'}}},
            {'newElement': {'markdown': {'body': 'The albums of Alanis Morissette in the FooBar database are Jagged Little Pill.', 'elementType': 'NATIVE'}}},
            {'newElement': {'markdown': {'body': '**The albums of Alanis Morissette in the FooBar database are Jagged Little Pill.**', 'elementType': 'NATIVE'}}},
            {'newElement': {'empty': {}}},
            {'addBlock': {'expandable': {'label': '✅ **Complete!**'}, 'allowEmpty': True}}
        ]
        # fmt: on

        # Assert our Delta messages
        actual_deltas = [
            MessageToDict(delta) for delta in self.get_all_deltas_from_queue()
        ]
        self.assertEqual(expected_deltas, actual_deltas)
