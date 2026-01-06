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

from typing import Final

from streamlit import config, util
from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg

_LOGGER: Final = get_logger(__name__)


def populate_hash_if_needed(msg: ForwardMsg) -> None:
    """Computes and assigns the unique hash for a ForwardMsg.

    If the ForwardMsg already has a hash, this is a no-op.

    Parameters
    ----------
    msg : ForwardMsg

    """
    if msg.hash == "" and msg.WhichOneof("type") not in {"ref_hash", "initialize"}:
        # Move the message's metadata aside. It's not part of the
        # hash calculation.
        metadata = msg.metadata
        msg.ClearField("metadata")

        # Serialize the message to bytes using the deterministic serializer to
        # ensure consistent hashing.
        serialized_msg = msg.SerializeToString(deterministic=True)

        # TODO(lukasmasuch): Evaluate more optimized hashing for larger messages:
        # - Add the type element type and number of bytes to the hash.
        # - Only hash the first N bytes of the message.

        # MD5 is good enough for what we need, which is uniqueness.
        msg.hash = util.calc_md5(serialized_msg)

        # Restore metadata.
        msg.metadata.CopyFrom(metadata)

        # Set cacheable flag if above the min cached size and if its a `new_element`
        # delta. We only cache new_element and add_block deltas since container's
        # are not expected to be larger than a few KB and have other side-effects
        # to consider if cached. But `add_block` deltas should still get a hash.
        # In case we ever allow other delta types to be cached, we should
        # also need to adapt the composable logic in forward_msg_queue.
        msg.metadata.cacheable = (
            len(serialized_msg) >= int(config.get_option("global.minCachedMessageSize"))
            and msg.WhichOneof("type") == "delta"
            and msg.delta.WhichOneof("type") == "new_element"
        )


def create_reference_msg(msg: ForwardMsg) -> ForwardMsg:
    """Create a ForwardMsg that refers to the given message via its hash.

    The reference message will also get a copy of the source message's
    metadata.

    Parameters
    ----------
    msg : ForwardMsg
        The ForwardMsg to create the reference to.

    Returns
    -------
    ForwardMsg
        A new ForwardMsg that "points" to the original message via the
        ref_hash field.

    """
    if not msg.hash:
        _LOGGER.warning(
            "Failed to create a reference message for a ForwardMsg since the "
            "message does not have a hash. This is not expected to happen, "
            "please report this as a bug. Falling back to the original message."
        )
        # Fallback to the original message if the hash is not set.
        # This is not expected to happen.
        return msg

    ref_msg = ForwardMsg()
    ref_msg.ref_hash = msg.hash
    ref_msg.metadata.CopyFrom(msg.metadata)
    ref_msg.metadata.cacheable = False
    return ref_msg
