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

import time
from typing import TYPE_CHECKING, Literal, TypeAlias, cast

from typing_extensions import Self

from streamlit.delta_generator import DeltaGenerator
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import enqueue_message

if TYPE_CHECKING:
    from types import TracebackType

    from streamlit.cursor import Cursor

StepStates: TypeAlias = Literal["running", "complete", "error"]


def _state_to_icon(state: StepStates | None) -> str:
    """Convert a step state to its corresponding icon."""
    if state == "running":
        return "spinner"
    if state == "complete":
        return ":material/check_circle:"
    if state == "error":
        return ":material/error:"
    return ":material/circle:"


def _state_to_proto(state: StepStates | None) -> BlockProto.Step.State.ValueType:
    """Convert a step state string to its protobuf enum value."""
    if state == "running":
        return BlockProto.Step.State.RUNNING
    if state == "complete":
        return BlockProto.Step.State.COMPLETE
    if state == "error":
        return BlockProto.Step.State.ERROR
    return BlockProto.Step.State.STATE_UNSPECIFIED


class StepContainer(DeltaGenerator):
    """A container for a single step within a StepsContainer.

    This class provides methods to update the step's state after creation
    and can be used as a context manager for automatic state transitions.
    """

    @staticmethod
    def _create(
        parent: StepsContainer,
        label: str,
        *,
        description: str | None = None,
        icon: str | None = None,
        state: StepStates | None = None,
    ) -> StepContainer:
        """Create a new step within a steps container."""
        from streamlit.string_util import validate_icon_or_emoji

        # Validate state if provided
        if state is not None and state not in {"running", "complete", "error"}:
            raise StreamlitAPIException(
                f"Unknown state ({state}). Must be one of 'running', 'complete', or 'error'."
            )

        step_proto = BlockProto.Step()
        step_proto.label = label or ""

        if description is not None:
            step_proto.description = description

        # Use provided icon or derive from state
        if icon is not None:
            step_proto.icon = validate_icon_or_emoji(icon)
        else:
            step_proto.icon = _state_to_icon(state)

        step_proto.state = _state_to_proto(state)
        step_proto.expanded = True

        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.step.CopyFrom(step_proto)

        # Capture delta_path from parent's cursor BEFORE calling _block(),
        # since _block() will use this path and the returned container's cursor
        # points to child positions inside the block.
        delta_path: list[int] = (
            parent._active_dg._cursor.delta_path if parent._active_dg._cursor else []
        )

        step_container = cast(
            "StepContainer",
            parent._block(block_proto=block_proto, dg_type=StepContainer),
        )

        # Apply initial configuration
        step_container._delta_path = delta_path
        step_container._current_proto = block_proto
        step_container._current_state = state
        step_container._user_icon = icon

        # We need to sleep here for a very short time to prevent issues when
        # the step is updated too quickly. If an .update() directly follows the
        # the initialization, sometimes only the latest update is applied.
        # Adding a short timeout here allows the frontend to render the update before.
        time.sleep(0.05)

        return step_container

    def __init__(
        self,
        root_container: int | None,
        cursor: Cursor | None,
        parent: DeltaGenerator | None,
        block_type: str | None,
    ) -> None:
        super().__init__(root_container, cursor, parent, block_type)

        # Initialized in `_create()`:
        self._current_proto: BlockProto | None = None
        self._current_state: StepStates | None = None
        self._delta_path: list[int] | None = None
        self._user_icon: str | None = None

    def update(
        self,
        *,
        label: str | None = None,
        description: str | None = None,
        icon: str | None = None,
        state: StepStates | None = None,
        expanded: bool | None = None,
    ) -> None:
        """Update the step.

        Only specified arguments are updated. Container contents and unspecified
        arguments remain unchanged.

        Parameters
        ----------
        label : str or None
            A new label for the step. If None, the label is not changed.

        description : str or None
            A new description for the step. If None, the description is not changed.

        icon : str or None
            A new icon for the step. If None, the icon is derived from state
            (if state is also provided) or remains unchanged.

        state : "running", "complete", "error", or None
            The new state of the step. This changes the default icon and styling.
            If None, the state is not changed.

        expanded : bool or None
            Whether the step content should be expanded. If None, the expanded
            state is not changed.
        """
        if (
            self._current_proto is None or self._delta_path is None
        ):  # pragma: no cover - defensive
            raise RuntimeError(
                "StepContainer is not correctly initialized. This should never happen."
            )

        msg = ForwardMsg()
        msg.metadata.delta_path[:] = self._delta_path
        msg.delta.add_block.CopyFrom(self._current_proto)

        if label is not None:
            msg.delta.add_block.step.label = label

        if description is not None:
            msg.delta.add_block.step.description = description

        if state is not None:
            if state not in {"running", "complete", "error"}:
                raise StreamlitAPIException(
                    f"Unknown state ({state}). Must be one of 'running', 'complete', or 'error'."
                )
            msg.delta.add_block.step.state = _state_to_proto(state)
            self._current_state = state

            # Update icon based on state if no explicit icon was set
            if icon is None and self._user_icon is None:
                msg.delta.add_block.step.icon = _state_to_icon(state)

        if icon is not None:
            from streamlit.string_util import validate_icon_or_emoji

            msg.delta.add_block.step.icon = validate_icon_or_emoji(icon)
            self._user_icon = icon

        if expanded is not None:
            msg.delta.add_block.step.expanded = expanded
        # Don't clear the expanded field when not provided - preserve existing value

        self._current_proto = msg.delta.add_block
        enqueue_message(msg)

    def __enter__(self) -> Self:  # type: ignore[override]
        super().__enter__()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> Literal[False]:
        # Only auto-transition if the current state is running
        if self._current_state == "running":
            # We need to sleep here for a very short time to prevent issues when
            # the step is updated too quickly. If an .update() is directly followed
            # by the exit of the context manager, sometimes only the last update
            # (to complete) is applied. Adding a short timeout here allows the frontend
            # to render the update before.
            time.sleep(0.05)
            if exc_type is not None:
                self.update(state="error")
            else:
                self.update(state="complete")
        return super().__exit__(exc_type, exc_val, exc_tb)


class StepsContainer(DeltaGenerator):
    """A container that displays a vertical timeline of steps.

    This class provides the `.step()` method to add steps to the container
    and can be used as a context manager.
    """

    @staticmethod
    def _create(
        parent: DeltaGenerator,
        *,
        height: int | None = None,
    ) -> StepsContainer:
        """Create a new steps container."""
        steps_proto = BlockProto.StepsContainer()

        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.steps_container.CopyFrom(steps_proto)

        # Set height if provided
        if height is not None:
            if height <= 0:
                raise StreamlitAPIException("height must be a positive integer")
            block_proto.height_config.pixel_height = height

        return cast(
            "StepsContainer",
            parent._block(block_proto=block_proto, dg_type=StepsContainer),
        )

    @gather_metrics("step")
    def step(
        self,
        label: str,
        *,
        description: str | None = None,
        icon: str | None = None,
        state: StepStates | None = None,
    ) -> StepContainer:
        """Add a step to the steps container.

        Parameters
        ----------
        label : str
            The step label. Supports markdown.

        description : str or None
            Optional subtitle shown below the label. Supports markdown.

        icon : str or None
            Icon to display. Accepts emoji, Material icon (`:material/name:`),
            or `"spinner"`. If None, icon is derived from state.

        state : "running", "complete", "error", or None
            Step state. Affects default icon and visual styling.
            If None, no state styling is applied.

        Returns
        -------
        StepContainer
            A mutable step container that can hold elements and be updated.
        """
        return StepContainer._create(
            self,
            label,
            description=description,
            icon=icon,
            state=state,
        )

    def __enter__(self) -> Self:  # type: ignore[override]
        super().__enter__()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> Literal[False]:
        return super().__exit__(exc_type, exc_val, exc_tb)
