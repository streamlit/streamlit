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

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, cast

from streamlit.components.v2.bidi_component.constants import ARROW_REF_KEY
from streamlit.dataframe_util import convert_anything_to_arrow_bytes, is_dataframe_like
from streamlit.logger import get_logger
from streamlit.proto.BidiComponent_pb2 import BidiComponent as BidiComponentProto
from streamlit.proto.BidiComponent_pb2 import MixedData as MixedDataProto
from streamlit.util import AttributeDictionary, calc_md5

if TYPE_CHECKING:
    from streamlit.components.v2.bidi_component.state import BidiComponentState

_LOGGER = get_logger(__name__)


def _extract_dataframes_from_dict(
    data: dict[str, Any], arrow_blobs: dict[str, bytes] | None = None
) -> dict[str, Any]:
    """Extract dataframe-like objects from a dictionary and replace them with
    placeholders.

    This function traverses the first level of a dictionary, detects any
    dataframe-like objects, stores their Arrow bytes representation in the
    `arrow_blobs` dictionary, and replaces them with JSON-serializable
    placeholder objects.

    Parameters
    ----------
    data
        The dictionary to process. Only the first level is checked for
        dataframe-like objects.
    arrow_blobs
        The dictionary to store the extracted Arrow bytes in, keyed by a unique
        reference ID.

    Returns
    -------
    dict[str, Any]
        A new dictionary with dataframe-like objects replaced by placeholders.
    """
    if arrow_blobs is None:
        arrow_blobs = {}

    processed_data = {}

    for key, value in data.items():
        if is_dataframe_like(value):
            # This is a dataframe-like object, serialize it to Arrow
            try:
                arrow_bytes = convert_anything_to_arrow_bytes(value)
                # Use deterministic, content-addressed ref IDs so placeholders
                # are stable for identical content on each run. This also provides
                # natural deduplication - identical DataFrames share a single blob.
                ref_id = calc_md5(arrow_bytes)
                arrow_blobs[ref_id] = arrow_bytes
                processed_data[key] = {ARROW_REF_KEY: ref_id}
            except Exception as e:
                # If Arrow serialization fails, keep the original value for JSON
                # serialization attempt downstream.
                _LOGGER.debug(
                    "Arrow serialization failed for key %r, keeping original value: %s",
                    key,
                    e,
                )
                processed_data[key] = value
        else:
            # Not dataframe-like, keep as-is
            processed_data[key] = value

    return processed_data


def serialize_mixed_data(data: Any, bidi_component_proto: BidiComponentProto) -> None:
    """Serialize mixed data with automatic dataframe detection into a protobuf message.

    This function detects dataframe-like objects in the first level of a dictionary,
    extracts them into separate Arrow blobs, and populates a `MixedDataProto`
    protobuf message for efficient serialization.

    Parameters
    ----------
    data
        The data structure to serialize. If it is a dictionary, its first
        level will be scanned for dataframe-like objects.
    bidi_component_proto
        The protobuf message to populate with the serialized data.

    """
    arrow_blobs: dict[str, bytes] = {}

    # Only process dictionaries for automatic dataframe detection
    if isinstance(data, dict):
        processed_data = _extract_dataframes_from_dict(data, arrow_blobs)
    else:
        # For non-dict data (lists, tuples, etc.), pass through as-is
        # We don't automatically detect dataframes in these structures
        processed_data = data

    if arrow_blobs:
        # We have dataframes, use mixed data serialization
        mixed_proto = MixedDataProto()
        try:
            mixed_proto.json = json.dumps(processed_data)
        except TypeError:
            # If JSON serialization fails (e.g., due to undetected dataframes),
            # fall back to string representation
            mixed_proto.json = json.dumps(str(processed_data))

        # Add Arrow blobs to the protobuf
        for ref_id, arrow_bytes in arrow_blobs.items():
            mixed_proto.arrow_blobs[ref_id].data = arrow_bytes

        bidi_component_proto.mixed.CopyFrom(mixed_proto)
    else:
        # No dataframes found, use regular JSON serialization
        try:
            bidi_component_proto.json = json.dumps(processed_data)
        except TypeError:
            # If JSON serialization fails (e.g., due to dataframes in lists/tuples),
            # fall back to string representation
            bidi_component_proto.json = json.dumps(str(processed_data))


def handle_deserialize(s: str | None) -> Any:
    """Deserialize a JSON string, returning the string itself if it's not valid JSON.

    Parameters
    ----------
    s
        The string to deserialize.

    Returns
    -------
    Any
        The deserialized JSON object, or the original string if parsing fails.
        Returns `None` if the input is `None`.

    """
    if s is None:
        return None
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return s


def deserialize_trigger_list(s: str | None) -> list[Any] | None:
    """Deserialize trigger aggregator payloads as a list.

    For bidirectional components, the frontend always sends a JSON array of payload
    objects. This deserializer normalizes older or singular payloads into a list
    while preserving ``None`` for cleared values.

    Parameters
    ----------
    s
        The JSON string to deserialize, hopefully representing a list of payloads.

    Returns
    -------
    list[Any] or None
        A list of payloads, or `None` if the input was `None`.

    """
    value = handle_deserialize(s)
    if value is None:
        return None
    if isinstance(value, list):
        return value
    return [value]


@dataclass
class BidiComponentSerde:
    """Serialization and deserialization logic for a bidirectional component.

    This class handles the conversion of component state between the frontend
    (JSON strings) and the backend (Python objects).

    The canonical shape is a flat mapping of state keys to values.

    Parameters
    ----------
    default
        A dictionary of default values to be applied to the state when
        deserializing, if the corresponding keys are not already present.

    """

    default: dict[str, Any] | None = None

    def deserialize(self, ui_value: str | dict[str, Any] | None) -> BidiComponentState:
        """Deserialize the component's state from a frontend value.

        Parameters
        ----------
        ui_value
            The value received from the frontend, which can be a JSON string,
            a dictionary, or `None`.

        Returns
        -------
        BidiComponentState
            The deserialized state as a flat mapping.

        """
        # Normalize the incoming JSON payload into a dict. Any failure to decode
        # (or an unexpected non-mapping structure) results in an empty mapping
        # so that the returned type adheres to :class:`BidiComponentState`.

        deserialized_value: dict[str, Any]

        if isinstance(ui_value, dict):
            deserialized_value = ui_value
        elif isinstance(ui_value, str):
            try:
                parsed = json.loads(ui_value)
                deserialized_value = parsed if isinstance(parsed, dict) else {}
            except (json.JSONDecodeError, TypeError) as e:
                _LOGGER.warning(
                    "Failed to deserialize component state from frontend: %s",
                    e,
                    exc_info=e,
                )
                deserialized_value = {}
        else:
            deserialized_value = {}

        # Apply default values for keys that don't exist in the current state
        if self.default is not None:
            for default_key, default_value in self.default.items():
                if default_key not in deserialized_value:
                    deserialized_value[default_key] = default_value

        state: BidiComponentState = cast(
            "BidiComponentState", AttributeDictionary(deserialized_value)
        )
        return state

    def serialize(self, value: Any) -> str:
        """Serialize the component's state into a JSON string for the frontend.

        Parameters
        ----------
        value
            The component state to serialize.

        Returns
        -------
        str
            A JSON string representation of the value.

        """
        return json.dumps(value)
