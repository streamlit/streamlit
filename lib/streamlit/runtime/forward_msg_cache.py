# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import hashlib

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.util import HASHLIB_KWARGS


def populate_hash_if_needed(msg: ForwardMsg) -> str:
    """Computes and assigns the unique hash for a ForwardMsg.

    If the ForwardMsg already has a hash, this is a no-op.

    Parameters
    ----------
    msg : ForwardMsg

    Returns
    -------
    string
        The message's hash, returned here for convenience. (The hash
        will also be assigned to the ForwardMsg; callers do not need
        to do this.)

    """
    if msg.hash == "":
        # Move the message's metadata aside. It's not part of the
        # hash calculation.
        metadata = msg.metadata
        msg.ClearField("metadata")

        # MD5 is good enough for what we need, which is uniqueness.
        hasher = hashlib.md5(**HASHLIB_KWARGS)
        hasher.update(msg.SerializeToString())
        msg.hash = hasher.hexdigest()

        # Restore metadata.
        msg.metadata.CopyFrom(metadata)

    return msg.hash


def create_reference_msg(msg: ForwardMsg, hash: str) -> ForwardMsg:
    """Create a ForwardMsg that refers to the given message via its hash.

    The reference message will also get a copy of the source message's
    metadata.

    Parameters
    ----------
    msg : ForwardMsg
        The ForwardMsg to create the reference to.

    hash : str
        The hash of the message to create the reference to.

    Returns
    -------
    ForwardMsg
        A new ForwardMsg that "points" to the original message via the
        ref_hash field.

    """
    ref_msg = ForwardMsg()
    ref_msg.ref_hash = hash
    ref_msg.metadata.CopyFrom(msg.metadata)
    return ref_msg
