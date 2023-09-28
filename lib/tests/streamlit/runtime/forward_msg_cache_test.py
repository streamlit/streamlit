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

"""Unit tests for MessageCache"""

import unittest
from unittest.mock import MagicMock

from streamlit import config
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.runtime import app_session
from streamlit.runtime.forward_msg_cache import (
    ForwardMsgCache,
    create_reference_msg,
    populate_hash_if_needed,
)
from streamlit.runtime.stats import CacheStat
from tests.streamlit.message_mocks import create_dataframe_msg


def _create_mock_session():
    return MagicMock(app_session)


class ForwardMsgCacheTest(unittest.TestCase):
    def test_msg_hash(self):
        """Test that ForwardMsg hash generation works as expected"""
        msg1 = create_dataframe_msg([1, 2, 3])
        msg2 = create_dataframe_msg([1, 2, 3])
        self.assertEqual(populate_hash_if_needed(msg1), populate_hash_if_needed(msg2))

        msg3 = create_dataframe_msg([2, 3, 4])
        self.assertNotEqual(
            populate_hash_if_needed(msg1), populate_hash_if_needed(msg3)
        )

    def test_delta_metadata(self):
        """Test that delta metadata doesn't change the hash"""
        msg1 = create_dataframe_msg([1, 2, 3], 1)
        msg2 = create_dataframe_msg([1, 2, 3], 2)
        self.assertEqual(populate_hash_if_needed(msg1), populate_hash_if_needed(msg2))

    def test_reference_msg(self):
        """Test creation of 'reference' ForwardMsgs"""
        msg = create_dataframe_msg([1, 2, 3], 34)
        ref_msg = create_reference_msg(msg)
        self.assertEqual(populate_hash_if_needed(msg), ref_msg.ref_hash)
        self.assertEqual(msg.metadata, ref_msg.metadata)

    def test_add_message(self):
        """Test MessageCache.add_message and has_message_reference"""
        cache = ForwardMsgCache()
        session = _create_mock_session()
        msg = create_dataframe_msg([1, 2, 3])
        cache.add_message(msg, session, 0)

        self.assertTrue(cache.has_message_reference(msg, session, 0))
        self.assertFalse(cache.has_message_reference(msg, _create_mock_session(), 0))

    def test_get_message(self):
        """Test MessageCache.get_message"""
        cache = ForwardMsgCache()
        session = _create_mock_session()
        msg = create_dataframe_msg([1, 2, 3])

        msg_hash = populate_hash_if_needed(msg)

        cache.add_message(msg, session, 0)
        self.assertEqual(msg, cache.get_message(msg_hash))

    def test_clear(self):
        """Test MessageCache.clear"""
        cache = ForwardMsgCache()
        session = _create_mock_session()

        msg = create_dataframe_msg([1, 2, 3])
        msg_hash = populate_hash_if_needed(msg)

        cache.add_message(msg, session, 0)
        self.assertEqual(msg, cache.get_message(msg_hash))

        cache.clear()
        self.assertEqual(None, cache.get_message(msg_hash))

    def test_remove_refs_for_session(self):
        cache = ForwardMsgCache()

        session1 = _create_mock_session()
        session2 = _create_mock_session()

        # Only session1 has a ref to msg1.
        msg1 = create_dataframe_msg([1, 2, 3])
        populate_hash_if_needed(msg1)
        cache.add_message(msg1, session1, 0)

        # Only session2 has a ref to msg2.
        msg2 = create_dataframe_msg([1, 2, 3, 4])
        populate_hash_if_needed(msg2)
        cache.add_message(msg2, session2, 0)

        # Both session1 and session2 have a ref to msg3.
        msg3 = create_dataframe_msg([1, 2, 3, 4, 5])
        populate_hash_if_needed(msg2)
        cache.add_message(msg3, session1, 0)
        cache.add_message(msg3, session2, 0)

        cache.remove_refs_for_session(session1)

        cache_entries = list(cache._entries.values())

        cached_msgs = [entry.msg for entry in cache_entries]
        assert cached_msgs == [msg2, msg3]

        sessions_with_refs = {
            s
            for entry in cache_entries
            for s in entry._session_script_run_counts.keys()
        }
        assert sessions_with_refs == {session2}

    def test_message_expiration(self):
        """Test MessageCache's expiration logic"""
        config._set_option("global.maxCachedMessageAge", 1, "test")

        cache = ForwardMsgCache()
        session1 = _create_mock_session()
        runcount1 = 0

        msg = create_dataframe_msg([1, 2, 3])
        msg_hash = populate_hash_if_needed(msg)

        cache.add_message(msg, session1, runcount1)

        # Increment session1's run_count. This should not resolve in expiry.
        runcount1 += 1
        self.assertTrue(cache.has_message_reference(msg, session1, runcount1))

        # Increment again. The message will now be expired for session1,
        # though it won't have actually been removed yet.
        runcount1 += 1
        self.assertFalse(cache.has_message_reference(msg, session1, runcount1))
        self.assertIsNotNone(cache.get_message(msg_hash))

        # Add another reference to the message
        session2 = _create_mock_session()
        runcount2 = 0
        cache.add_message(msg, session2, runcount2)

        # Remove session1's expired entries. This should not remove the
        # entry from the cache, because session2 still has a reference to it.
        cache.remove_expired_entries_for_session(session1, runcount1)
        self.assertFalse(cache.has_message_reference(msg, session1, runcount1))
        self.assertTrue(cache.has_message_reference(msg, session2, runcount2))

        # Expire session2's reference. The message should no longer be
        # in the cache at all.
        runcount2 += 2
        cache.remove_expired_entries_for_session(session2, runcount2)
        self.assertIsNone(cache.get_message(msg_hash))

    def test_cache_stats_provider(self):
        """Test ForwardMsgCache's CacheStatsProvider implementation."""
        cache = ForwardMsgCache()
        session = _create_mock_session()

        # Test empty cache
        self.assertEqual([], cache.get_stats())

        msg1 = create_dataframe_msg([1, 2, 3])
        populate_hash_if_needed(msg1)
        cache.add_message(msg1, session, 0)

        msg2 = create_dataframe_msg([5, 4, 3, 2, 1, 0])
        populate_hash_if_needed(msg2)
        cache.add_message(msg2, session, 0)

        # Test cache with messages
        expected = [
            CacheStat(
                category_name="ForwardMessageCache",
                cache_name="",
                byte_length=msg1.ByteSize(),
            ),
            CacheStat(
                category_name="ForwardMessageCache",
                cache_name="",
                byte_length=msg2.ByteSize(),
            ),
        ]
        self.assertEqual(set(expected), set(cache.get_stats()))
