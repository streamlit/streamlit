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
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, cast

from streamlit.components.v2.bidi_component.constants import (
    EVENT_DELIM,
    INTERNAL_COMPONENT_NAME,
)
from streamlit.components.v2.bidi_component.serialization import (
    BidiComponentSerde,
    deserialize_trigger_list,
    serialize_mixed_data,
)
from streamlit.components.v2.bidi_component.state import (
    BidiComponentResult,
    unwrap_component_state,
)
from streamlit.components.v2.presentation import make_bidi_component_presenter
from streamlit.dataframe_util import (
    DataFormat,
    convert_anything_to_arrow_bytes,
    determine_data_format,
)
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import (
    Height,
    LayoutConfig,
    Width,
    validate_width,
)
from streamlit.elements.lib.policies import check_cache_replay_rules
from streamlit.elements.lib.utils import compute_and_register_element_id, to_key
from streamlit.errors import (
    BidiComponentInvalidCallbackNameError,
    BidiComponentInvalidDefaultKeyError,
    BidiComponentInvalidIdError,
    BidiComponentUnserializableDataError,
)
from streamlit.proto.ArrowData_pb2 import ArrowData as ArrowDataProto
from streamlit.proto.BidiComponent_pb2 import BidiComponent as BidiComponentProto
from streamlit.proto.BidiComponent_pb2 import MixedData as MixedDataProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import register_widget
from streamlit.util import calc_md5

if TYPE_CHECKING:
    from streamlit.components.v2.types import (
        BidiComponentData,
        BidiComponentDefaults,
        BidiComponentKey,
        ComponentIsolateStyles,
    )

if TYPE_CHECKING:
    # Define DeltaGenerator for type checking the dg property
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.state.common import WidgetCallback


def _make_trigger_id(base: str, event: str) -> str:
    """Construct the per-event *trigger widget* identifier.

    The widget ID for a trigger is derived from the *base* component ID plus
    an *event* name. We join those two parts with :py:const:`EVENT_DELIM` and
    perform a couple of validations so that downstream logic can always split
    the identifier unambiguously.

    Trigger widgets are marked as internal by prefixing with an internal key prefix,
    so they won't be exposed in `st.session_state` to end users.

    Parameters
    ----------
    base
        The unique, framework-assigned ID of the component instance.
    event
        The event name as provided by either the frontend or the developer
        (e.g., "click", "change").

    Returns
    -------
    str
        The composite widget ID in the form ``"$$STREAMLIT_INTERNAL_KEY_{base}__{event}"``
        where ``__`` is the delimiter.

    Raises
    ------
    StreamlitAPIException
        If either `base` or `event` already contains the delimiter sequence.

    """
    from streamlit.runtime.state.session_state import STREAMLIT_INTERNAL_KEY_PREFIX

    if EVENT_DELIM in base:
        raise BidiComponentInvalidIdError("base", EVENT_DELIM)
    if EVENT_DELIM in event:
        raise BidiComponentInvalidIdError("event", EVENT_DELIM)

    return f"{STREAMLIT_INTERNAL_KEY_PREFIX}_{base}{EVENT_DELIM}{event}"


class BidiComponentMixin:
    """Mixin class for the bidi_component DeltaGenerator method."""

    def _canonicalize_json_for_identity(self, payload: str) -> str:
        """Return a deterministic JSON string for identity comparisons.

        Payloads that cannot be parsed (or re-serialized) are returned as-is to
        avoid mutating developer data.
        """

        if not payload:
            return payload

        try:
            parsed = json.loads(payload)
        except (TypeError, ValueError):
            return payload

        try:
            return json.dumps(parsed, sort_keys=True)
        except (TypeError, ValueError):
            return payload

    def _canonical_json_digest_for_identity(self, payload: str) -> str:
        """Return the hash of the canonicalized JSON payload for identity use.

        Hashing keeps the kwargs passed to ``compute_and_register_element_id``
        small even when the JSON payload is very large, while still changing the
        identity whenever the canonical JSON content changes.
        """

        canonical = self._canonicalize_json_for_identity(payload)
        return calc_md5(canonical)

    def _build_bidi_identity_kwargs(
        self,
        *,
        component_name: str,
        isolate_styles: bool,
        width: Width,
        height: Height,
        proto: BidiComponentProto,
        data: BidiComponentData = None,
        default: BidiComponentDefaults = None,
    ) -> dict[str, Any]:
        """Build deterministic identity kwargs for ID computation.

        Construct a stable mapping of identity-relevant properties for
        ``compute_and_register_element_id``. This includes structural
        properties (name, style isolation, layout), default state values, and
        an explicit, typed handling of the ``BidiComponent`` ``oneof data``
        field to ensure unkeyed components change identity when their
        serialized payload or defaults change.

        Parameters
        ----------
        component_name : str
            The registered component name.
        isolate_styles : bool
            Whether the component styles are rendered in a Shadow DOM.
        width : Width
            Desired width configuration passed to the component.
        height : Height
            Desired height configuration passed to the component.
        proto : BidiComponentProto
            The populated component protobuf. Its ``data`` oneof determines
            which serialized payload (JSON, Arrow, bytes, or Mixed) contributes
            to identity.
        data : BidiComponentData, optional
            The raw data passed to the component. Used to optimize identity
            calculation for JSON payloads by avoiding a parse/serialize cycle.
            When omitted, the helper falls back to canonicalizing the JSON
            content stored on the protobuf.
        default : BidiComponentDefaults, optional
            The default state mapping for the component instance. Defaults are
            included in the identity for unkeyed components so that changing
            default values produces a new backend identity. When a user key is
            provided with ``key_as_main_identity=True``, these defaults are
            ignored by :func:`compute_and_register_element_id`.

        Returns
        -------
        dict[str, Any]
            A mapping of deterministic values to be forwarded into
            ``compute_and_register_element_id``.

        Raises
        ------
        RuntimeError
            If an unhandled ``oneof data`` variant is encountered (guards
            against adding new fields without updating identity computation).
        """
        identity: dict[str, Any] = {
            "component_name": component_name,
            "isolate_styles": isolate_styles,
            "width": width,
            "height": height,
            "default": default,
        }

        data_field = proto.WhichOneof("data")
        if data_field is None:
            return identity

        if data_field == "json":
            # Canonicalize only for identity so unkeyed widgets don't churn when
            # dict insertion order changes.
            #
            # Optimization: Use raw `data` if available to avoid the overhead of
            # parsing `proto.json` back into a dict.
            canonical_digest = None

            if data is not None:
                try:
                    canonical = json.dumps(data, sort_keys=True)
                    canonical_digest = calc_md5(canonical)
                except (TypeError, ValueError):
                    # Fallback to existing logic if direct dump fails
                    pass

            if canonical_digest is None:
                canonical_digest = self._canonical_json_digest_for_identity(proto.json)

            identity["json"] = canonical_digest
        elif data_field == "arrow_data":
            # Hash large payloads instead of shoving raw bytes through the ID
            # hasher for performance.
            identity["arrow_data"] = calc_md5(proto.arrow_data.data)
        elif data_field == "bytes":
            # Same story for arbitrary bytes payloads: content-address the data
            # so identity changes track real mutations without re-hashing the
            # whole blob every run.
            identity["bytes"] = calc_md5(proto.bytes)
        elif data_field == "mixed":
            mixed: MixedDataProto = proto.mixed
            # Add the JSON content of the MixedData to the identity.
            identity["mixed_json"] = self._canonical_json_digest_for_identity(
                mixed.json
            )
            # Add the sorted content-addressed ref IDs of the Arrow blobs to the identity.
            # Unlike other data types where we include actual bytes, here we only include
            # the blob keys. This is sufficient because keys are MD5 hashes of the blob
            # content (content-addressed), so identical content produces identical keys.
            identity["mixed_arrow_blobs"] = ",".join(sorted(mixed.arrow_blobs.keys()))
        else:
            raise RuntimeError(
                f"Unhandled BidiComponent.data oneof field: {data_field}"
            )

        return identity

    @gather_metrics("_bidi_component")
    def _bidi_component(
        self,
        component_name: str,
        key: BidiComponentKey = None,
        isolate_styles: ComponentIsolateStyles = True,
        data: BidiComponentData = None,
        default: BidiComponentDefaults = None,
        width: Width = "stretch",
        height: Height = "content",
        **kwargs: WidgetCallback | None,
    ) -> BidiComponentResult:
        """Add a bidirectional component instance to the app.

        This method uses a component that has already been registered with the
        application.

        Parameters
        ----------
        component_name
            The name of the registered component to use. The component's HTML,
            CSS, and JavaScript will be loaded from the registry.
        key
            An optional string to use as the unique key for the component.
            If this is omitted, a key will be generated based on the
            component's execution sequence.
        isolate_styles
            Whether to sandbox the component's styles in a shadow root.
            Defaults to True.
        data
            Data to pass to the component. This can be any JSON-serializable
            data, or a pandas DataFrame, NumPy array, or other dataframe-like
            object that can be serialized to Arrow.
        default
            A dictionary of default values for the component's state properties.
            These defaults are applied only when the state key doesn't exist
            in session state. Keys must correspond to valid state names (those
            with `on_*_change` callbacks). Trigger values do not support
            defaults.
        width
            The desired width of the component. This can be one of "stretch",
            "content", or a number of pixels.
        height
            The desired height of the component. This can be one of "stretch",
            "content", or a number of pixels.
        **kwargs
            Keyword arguments to pass to the component. Callbacks can be passed
            here, with the naming convention `on_{event_name}_change`.

        Returns
        -------
        BidiComponentResult
            A dictionary-like object that holds the component's state and
            trigger values.

        Raises
        ------
        ValueError
            If the component name is not found in the registry.
        StreamlitAPIException
            If the component does not have the required JavaScript or HTML
            content, or if the provided data cannot be serialized.

        """
        check_cache_replay_rules()

        key = to_key(key)
        ctx = get_script_run_ctx()

        if ctx is None:
            # Create an empty state with the default value and return it
            return BidiComponentResult({}, {})

        # Get the component definition from the registry
        from streamlit.runtime import Runtime

        registry = Runtime.instance().bidi_component_registry
        component_def = registry.get(component_name)

        if component_def is None:
            raise ValueError(f"Component '{component_name}' is not registered")

        # ------------------------------------------------------------------
        # 1. Parse user-supplied callbacks
        # ------------------------------------------------------------------
        # Event-specific callbacks follow the pattern ``on_<event>_change``.
        # We deliberately *do not* support the legacy generic ``on_change``
        # or ``on_<event>`` forms.
        callbacks_by_event: dict[str, WidgetCallback] = {}
        for kwarg_key, kwarg_value in list(kwargs.items()):
            if not callable(kwarg_value):
                continue

            if kwarg_key.startswith("on_") and kwarg_key.endswith("_change"):
                # Preferred pattern: on_<event>_change
                event_name = kwarg_key[3:-7]  # strip prefix + suffix
            else:
                # Not an event callback we recognize - skip.
                continue

            if not event_name or event_name == "_":
                raise BidiComponentInvalidCallbackNameError(kwarg_key)

            callbacks_by_event[event_name] = kwarg_value

        # ------------------------------------------------------------------
        # 2. Validate default keys against registered callbacks
        # ------------------------------------------------------------------
        if default is not None:
            for state_key in default:
                if state_key not in callbacks_by_event:
                    raise BidiComponentInvalidDefaultKeyError(
                        state_key, list(callbacks_by_event.keys())
                    )

        # Set up the component proto
        bidi_component_proto = BidiComponentProto()
        bidi_component_proto.component_name = component_name
        bidi_component_proto.isolate_styles = isolate_styles
        bidi_component_proto.js_content = component_def.js_content or ""
        bidi_component_proto.js_source_path = component_def.js_url or ""
        bidi_component_proto.html_content = component_def.html_content or ""
        bidi_component_proto.css_content = component_def.css_content or ""
        bidi_component_proto.css_source_path = component_def.css_url or ""

        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width, height=height)

        if data is not None:
            try:
                # 1. Raw byte payloads - forward as-is.
                if isinstance(data, (bytes, bytearray)):
                    bidi_component_proto.bytes = bytes(data)

                # 2. Mapping-like structures (e.g. plain dict) - check for mixed data.
                elif isinstance(data, (Mapping, list, tuple)):
                    serialize_mixed_data(data, bidi_component_proto)

                # 3. Dataframe-like structures - attempt Arrow serialization.
                else:
                    data_format = determine_data_format(data)

                    if data_format != DataFormat.UNKNOWN:
                        arrow_bytes = convert_anything_to_arrow_bytes(data)

                        arrow_data_proto = ArrowDataProto()
                        arrow_data_proto.data = arrow_bytes

                        bidi_component_proto.arrow_data.CopyFrom(arrow_data_proto)
                    else:
                        # Fallback to JSON.
                        bidi_component_proto.json = json.dumps(data)
            except Exception:
                # As a last resort attempt JSON serialization so that we don't
                # silently drop developer data.
                try:
                    bidi_component_proto.json = json.dumps(data)
                except Exception:
                    raise BidiComponentUnserializableDataError()
        bidi_component_proto.form_id = current_form_id(self.dg)

        # Build identity kwargs for the component instance now that the proto is
        # populated.
        identity_kwargs = self._build_bidi_identity_kwargs(
            component_name=component_name,
            isolate_styles=isolate_styles,
            width=width,
            height=height,
            proto=bidi_component_proto,
            data=data,
            default=default,
        )
        # Compute a unique ID for this component instance now that the proto is
        # populated.
        computed_id = compute_and_register_element_id(
            "bidi_component",
            user_key=key,
            key_as_main_identity=True,
            dg=self.dg,
            **identity_kwargs,
        )
        bidi_component_proto.id = computed_id

        # Instantiate the Serde for this component instance
        serde = BidiComponentSerde(default=default)

        # ------------------------------------------------------------------
        # 3. Prepare IDs and register widgets
        # ------------------------------------------------------------------

        # Compute trigger aggregator id from the base id
        def _make_trigger_aggregator_id(base: str) -> str:
            return _make_trigger_id(base, "events")

        aggregator_id = _make_trigger_aggregator_id(computed_id)

        # With generalized runtime dispatch, we can attach per-key callbacks
        # directly to the state widget by passing the callbacks mapping.
        # We also register a presenter to shape the user-visible session_state.
        # Allowed state keys are the ones that have callbacks registered.
        allowed_state_keys = (
            set(callbacks_by_event.keys()) if callbacks_by_event else None
        )
        presenter = make_bidi_component_presenter(
            aggregator_id,
            computed_id,
            allowed_state_keys,
        )

        component_state = register_widget(
            bidi_component_proto.id,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            callbacks=callbacks_by_event or None,
            value_type="json_value",
            presenter=presenter,
        )

        # ------------------------------------------------------------------
        # 4. Register a single *trigger aggregator* widget
        # ------------------------------------------------------------------
        trigger_vals: dict[str, Any] = {}

        trig_state = register_widget(
            aggregator_id,
            deserializer=deserialize_trigger_list,  # always returns list or None
            serializer=lambda v: json.dumps(v),  # send dict as JSON
            ctx=ctx,
            callbacks=callbacks_by_event or None,
            value_type="json_trigger_value",
        )

        # Surface per-event trigger values derived from the aggregator payload list.
        payloads: list[object] = trig_state.value or []

        event_to_value: dict[str, Any] = {}
        for payload in payloads:
            if isinstance(payload, dict):
                ev = payload.get("event")
                if isinstance(ev, str):
                    event_to_value[ev] = payload.get("value")

        for evt_name in callbacks_by_event:
            trigger_vals[evt_name] = event_to_value.get(evt_name)

        # Note: We intentionally do not inspect SessionState for additional
        # trigger widget IDs here because doing so can raise KeyErrors when
        # widgets are freshly registered but their values haven't been
        # populated yet. Only the triggers explicitly registered above are
        # included in the result object.

        # ------------------------------------------------------------------
        # 5. Enqueue proto and assemble the result object
        # ------------------------------------------------------------------
        self.dg._enqueue(
            INTERNAL_COMPONENT_NAME,
            bidi_component_proto,
            layout_config=layout_config,
        )

        state_vals = unwrap_component_state(component_state.value)

        return BidiComponentResult(state_vals, trigger_vals)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
