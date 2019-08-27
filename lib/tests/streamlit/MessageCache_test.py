# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

"""Unit tests for MessageCache"""

import unittest

from mock import MagicMock

from streamlit.MessageCache import MessageCache
from streamlit.MessageCache import create_reference_msg
from streamlit.MessageCache import ensure_hash
from streamlit.elements import data_frame_proto
from streamlit.proto.BlockPath_pb2 import BlockPath
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg


def _create_dataframe_msg(df, id=1):
    msg = ForwardMsg()
    msg.metadata.delta_id = id
    msg.metadata.parent_block.container = BlockPath.SIDEBAR
    data_frame_proto.marshall_data_frame(df, msg.delta.new_element.data_frame)
    return msg


class MessageCacheTest(unittest.TestCase):
    def test_msg_id(self):
        """Test that ForwardMsg hash generation works as expected"""
        msg1 = _create_dataframe_msg([1, 2, 3])
        msg2 = _create_dataframe_msg([1, 2, 3])
        self.assertEqual(ensure_hash(msg1), ensure_hash(msg2))

        msg3 = _create_dataframe_msg([2, 3, 4])
        self.assertNotEqual(ensure_hash(msg1), ensure_hash(msg3))

    def test_delta_metadata(self):
        """Test that delta metadata doesn't change the hash"""
        msg1 = _create_dataframe_msg([1, 2, 3], 1)
        msg2 = _create_dataframe_msg([1, 2, 3], 2)
        self.assertEqual(ensure_hash(msg1), ensure_hash(msg2))

    def test_reference_msg(self):
        """Test creation of 'reference' ForwardMsgs"""
        msg = _create_dataframe_msg([1, 2, 3], 34)
        ref_msg = create_reference_msg(msg)
        self.assertEqual(ensure_hash(msg), ref_msg.ref_hash)
        self.assertEqual(msg.metadata, ref_msg.metadata)

    def test_add_message(self):
        """Test MessageCache.add_message"""
        cache = MessageCache()
        session = MagicMock()
        msg = _create_dataframe_msg([1, 2, 3])
        cache.add_message(msg, session)

        self.assertTrue(cache.has_message_reference(msg, session))
        self.assertFalse(cache.has_message_reference(msg, MagicMock()))

    def test_get_message(self):
        """Test MessageCache.get_message"""
        cache = MessageCache()
        session = MagicMock()
        msg = _create_dataframe_msg([1, 2, 3])

        msg_id = ensure_hash(msg)

        cache.add_message(msg, session)
        self.assertEqual(msg, cache.get_message(msg_id))

    def test_has_message(self):
        """Test MessageCache.has_message"""
        cache = MessageCache()
        session1 = MagicMock()
        session2 = MagicMock()
        msg = _create_dataframe_msg([1, 2, 3])
        cache.add_message(msg, session1)
        self.assertTrue(cache.has_message_reference(msg, session1))
        self.assertFalse(cache.has_message_reference(msg, session2))

    def test_clear(self):
        """Test MessageCache.clear"""
        cache = MessageCache()
        session = MagicMock()
        msg = _create_dataframe_msg([1, 2, 3])

        msg_id = ensure_hash(msg)

        cache.add_message(msg, session)
        self.assertEqual(msg, cache.get_message(msg_id))

        cache.clear()
        self.assertEqual(None, cache.get_message(msg_id))
