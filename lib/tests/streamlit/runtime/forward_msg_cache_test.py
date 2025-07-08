# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from __future__ import annotations

import unittest

from streamlit.runtime.forward_msg_cache import (
    create_reference_msg,
    populate_hash_if_needed,
)
from streamlit.testing.v1.util import patch_config_options
from tests.streamlit.message_mocks import (
    create_container_msg,
    create_dataframe_msg,
)


class ForwardMsgCacheTest(unittest.TestCase):
    def test_msg_hash(self):
        """Test that ForwardMsg hash generation works as expected"""
        with patch_config_options({"global.minCachedMessageSize": 0}):
            msg1 = create_dataframe_msg([1, 2, 3])
            msg2 = create_dataframe_msg([1, 2, 3])
            populate_hash_if_needed(msg1)
            populate_hash_if_needed(msg2)

            assert msg1.hash != ""
            assert msg2.hash != ""

            assert msg1.hash == msg2.hash
            assert msg1.metadata.cacheable
            assert msg2.metadata.cacheable

            msg3 = create_dataframe_msg([2, 3, 4])
            populate_hash_if_needed(msg3)
            assert msg1.hash != msg3.hash
            assert msg3.metadata.cacheable

    def test_container_msg_hash(self):
        """Test that container ForwardMsg hash generation works as expected
        but aren't marked as cacheable."""
        with patch_config_options({"global.minCachedMessageSize": 0}):
            msg1 = create_container_msg()
            msg2 = create_container_msg()
            populate_hash_if_needed(msg1)
            populate_hash_if_needed(msg2)

            assert msg1.hash != ""
            assert msg2.hash != ""
            assert msg1.hash == msg2.hash
            # Container messages (add_block) are never cacheable
            assert not msg1.metadata.cacheable
            assert not msg2.metadata.cacheable

    def test_not_cacheable_if_below_min_cached_message_size(self):
        """Test that a ForwardMsg is not cacheable if its below the min cached
        message size."""
        with patch_config_options({"global.minCachedMessageSize": 1000}):
            msg = create_dataframe_msg([1, 2, 3])
            populate_hash_if_needed(msg)
            assert not msg.metadata.cacheable

    def test_delta_metadata(self):
        """Test that delta metadata doesn't change the hash"""
        msg1 = create_dataframe_msg([1, 2, 3], 1)
        msg2 = create_dataframe_msg([1, 2, 3], 2)
        populate_hash_if_needed(msg1)
        populate_hash_if_needed(msg2)
        assert msg1.hash == msg2.hash

    def test_reference_msg(self):
        """Test creation of 'reference' ForwardMsgs"""
        msg = create_dataframe_msg([1, 2, 3], 34)
        populate_hash_if_needed(msg)
        ref_msg = create_reference_msg(msg)

        assert msg.hash == ref_msg.ref_hash
        assert msg.metadata == ref_msg.metadata
        assert not ref_msg.metadata.cacheable

    def test_no_hash_for_reference_msg(self):
        """Test that reference message doesn't get a hash."""
        with patch_config_options({"global.minCachedMessageSize": 0}):
            msg = create_dataframe_msg([1, 2, 3], 34)
            populate_hash_if_needed(msg)
            ref_msg = create_reference_msg(msg)
            populate_hash_if_needed(ref_msg)
            assert ref_msg.hash == ""
            assert not ref_msg.metadata.cacheable
