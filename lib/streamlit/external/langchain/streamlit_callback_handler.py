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

"""
LangChain CallbackHandler that prints to streamlit.

This is a special API that's imported and used by LangChain itself. Any updates
to the public API (the StreamlitCallbackHandler constructor, and the entirety
of LLMThoughtLabeler) *must* remain backwards-compatible to avoid breaking
LangChain.

This means that it's acceptable to add new optional kwargs to StreamlitCallbackHandler,
but no new positional args or required kwargs should be added, and no existing
args should be removed. If we need to overhaul the API, we must ensure that a
compatible API continues to exist.

Any major change to the StreamlitCallbackHandler should be tested by importing
the API *from LangChain itself*.

This module is lazy-loaded.
"""

# NOTE: We ignore all mypy import-not-found errors as top-level since
# this module is optional and the langchain dependency is not installed
# by default.
# mypy: disable-error-code="import-not-found, unused-ignore, misc"

from __future__ import annotations

import time
from enum import Enum
from typing import TYPE_CHECKING, Any, NamedTuple

from langchain.callbacks.base import (
    BaseCallbackHandler,
)

from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from langchain.schema import (
        AgentAction,
        AgentFinish,
        LLMResult,
    )

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.mutable_status_container import StatusContainer


def _convert_newlines(text: str) -> str:
    """Convert newline characters to markdown newline sequences
    (space, space, newline).
    """
    return text.replace("\n", "  \n")


# The maximum length of the "input_str" portion of a tool label.
# Strings that are longer than this will be truncated with "..."
MAX_TOOL_INPUT_STR_LENGTH = 60


class LLMThoughtState(Enum):
    # The LLM is thinking about what to do next. We don't know which tool we'll run.
    THINKING = "THINKING"
    # The LLM has decided to run a tool. We don't have results from the tool yet.
    RUNNING_TOOL = "RUNNING_TOOL"
    # We have results from the tool.
    COMPLETE = "COMPLETE"
    # The LLM completed with an error.
    ERROR = "ERROR"


class ToolRecord(NamedTuple):
    name: str
    input_str: str


class LLMThoughtLabeler:
    """
    Generates markdown labels for LLMThought containers. Pass a custom
    subclass of this to StreamlitCallbackHandler to override its default
    labeling logic.
    """

    def get_initial_label(self) -> str:
        """Return the markdown label for a new LLMThought that doesn't have
        an associated tool yet.
        """
        return "Thinking..."

    def get_tool_label(self, tool: ToolRecord, is_complete: bool) -> str:
        """Return the label for an LLMThought that has an associated
        tool.

        Parameters
        ----------
        tool
            The tool's ToolRecord

        is_complete
            True if the thought is complete; False if the thought
            is still receiving input.

        Returns
        -------
        The markdown label for the thought's container.

        """
        input_str = tool.input_str
        name = tool.name
        if name == "_Exception":
            name = "Parsing error"
        input_str_len = min(MAX_TOOL_INPUT_STR_LENGTH, len(input_str))
        input_str = input_str[:input_str_len]
        if len(tool.input_str) > input_str_len:
            input_str = input_str + "..."
        input_str = input_str.replace("\n", " ")
        return f"**{name}:** {input_str}"

    def get_final_agent_thought_label(self) -> str:
        """Return the markdown label for the agent's final thought -
        the "Now I have the answer" thought, that doesn't involve
        a tool.
        """
        return "**Complete!**"


class LLMThought:
    """Encapsulates the Streamlit UI for a single LLM 'thought' during a LangChain Agent
    run. Each tool usage gets its own thought; and runs also generally having a
    concluding thought where the Agent determines that it has an answer to the prompt.

    Each thought gets its own expander UI.
    """

    def __init__(
        self,
        parent_container: DeltaGenerator,
        labeler: LLMThoughtLabeler,
        expanded: bool,
        collapse_on_complete: bool,
    ):
        self._container = parent_container.status(
            labeler.get_initial_label(), expanded=expanded
        )

        self._state = LLMThoughtState.THINKING
        self._llm_token_stream = ""
        self._llm_token_stream_placeholder: DeltaGenerator | None = None
        self._last_tool: ToolRecord | None = None
        self._collapse_on_complete = collapse_on_complete
        self._labeler = labeler

    @property
    def container(self) -> StatusContainer:
        """The container we're writing into."""
        return self._container

    @property
    def last_tool(self) -> ToolRecord | None:
        """The last tool executed by this thought."""
        return self._last_tool

    def _reset_llm_token_stream(self) -> None:
        if self._llm_token_stream_placeholder is not None:
            self._llm_token_stream_placeholder.markdown(self._llm_token_stream)

        self._llm_token_stream = ""
        self._llm_token_stream_placeholder = None

    def on_llm_start(self, serialized: dict[str, Any], prompts: list[str]) -> None:
        self._reset_llm_token_stream()

    def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        # This is only called when the LLM is initialized with `streaming=True`
        self._llm_token_stream += _convert_newlines(token)
        if self._llm_token_stream_placeholder is None:
            self._llm_token_stream_placeholder = self._container.empty()
        self._llm_token_stream_placeholder.markdown(self._llm_token_stream + "▕")

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        # `response` is the concatenation of all the tokens received by the LLM.
        # If we're receiving streaming tokens from `on_llm_new_token`, this response
        # data is redundant
        self._reset_llm_token_stream()
        # set the container status to complete
        self.complete(self._labeler.get_final_agent_thought_label())

    def on_llm_error(self, error: BaseException, *args: Any, **kwargs: Any) -> None:
        self._container.exception(error)
        self._state = LLMThoughtState.ERROR
        self.complete("LLM encountered an error...")

    def on_tool_start(
        self, serialized: dict[str, Any], input_str: str, **kwargs: Any
    ) -> None:
        # Called with the name of the tool we're about to run (in `serialized[name]`),
        # and its input. We change our container's label to be the tool name.
        self._state = LLMThoughtState.RUNNING_TOOL
        tool_name = serialized["name"]
        self._last_tool = ToolRecord(name=tool_name, input_str=input_str)
        self._container.update(
            label=self._labeler.get_tool_label(self._last_tool, is_complete=False),
            state="running",
        )
        if len(input_str) > MAX_TOOL_INPUT_STR_LENGTH:
            # output is printed later in on_tool_end
            self._container.markdown(f"**Input:**\n\n{input_str}\n\n**Output:**")

    def on_tool_end(
        self,
        output: str,
        color: str | None = None,
        observation_prefix: str | None = None,
        llm_prefix: str | None = None,
        **kwargs: Any,
    ) -> None:
        self._container.markdown(output)

    def on_tool_error(self, error: BaseException, *args: Any, **kwargs: Any) -> None:
        self._container.markdown("**Tool encountered an error...**")
        self._container.exception(error)
        self._container.update(state="error")

    def on_agent_action(
        self, action: AgentAction, color: str | None = None, **kwargs: Any
    ) -> Any:
        # Called when we're about to kick off a new tool. The `action` data
        # tells us the tool we're about to use, and the input we'll give it.
        # We don't output anything here, because we'll receive this same data
        # when `on_tool_start` is called immediately after.
        pass

    def complete(self, final_label: str | None = None) -> None:
        """Finish the thought."""
        if final_label is None and self._state == LLMThoughtState.RUNNING_TOOL:
            assert self._last_tool is not None, (
                "_last_tool should never be null when _state == RUNNING_TOOL"
            )
            final_label = self._labeler.get_tool_label(
                self._last_tool, is_complete=True
            )

        if self._last_tool and self._last_tool.name == "_Exception":
            self._state = LLMThoughtState.ERROR
        elif self._state != LLMThoughtState.ERROR:
            self._state = LLMThoughtState.COMPLETE

        if self._collapse_on_complete:
            # Add a quick delay to show the user the final output before we collapse
            time.sleep(0.25)

        self._container.update(
            label=final_label,
            expanded=False if self._collapse_on_complete else None,
            state="error" if self._state == LLMThoughtState.ERROR else "complete",
        )


class StreamlitCallbackHandler(BaseCallbackHandler):
    @gather_metrics("external.langchain.StreamlitCallbackHandler")
    def __init__(
        self,
        parent_container: DeltaGenerator,
        *,
        max_thought_containers: int = 4,
        expand_new_thoughts: bool = False,
        collapse_completed_thoughts: bool = False,
        thought_labeler: LLMThoughtLabeler | None = None,
    ):
        """Construct a new StreamlitCallbackHandler. This CallbackHandler is geared
        towards use with a LangChain Agent; it displays the Agent's LLM and tool-usage
        "thoughts" inside a series of Streamlit expanders.

        Parameters
        ----------
        parent_container
            The `st.container` that will contain all the Streamlit elements that the
            Handler creates.

        max_thought_containers

            .. note::
                This parameter is deprecated and is ignored in the latest version of
                the callback handler.

            The max number of completed LLM thought containers to show at once. When
            this threshold is reached, a new thought will cause the oldest thoughts to
            be collapsed into a "History" expander. Defaults to 4.

        expand_new_thoughts
            Each LLM "thought" gets its own `st.expander`. This param controls whether
            that expander is expanded by default. Defaults to False.

        collapse_completed_thoughts
            If True, LLM thought expanders will be collapsed when completed.
            Defaults to False.

        thought_labeler
            An optional custom LLMThoughtLabeler instance. If unspecified, the handler
            will use the default thought labeling logic. Defaults to None.
        """
        self._parent_container = parent_container
        self._history_parent = parent_container.container()
        self._current_thought: LLMThought | None = None
        self._completed_thoughts: list[LLMThought] = []
        self._max_thought_containers = max(max_thought_containers, 1)
        self._expand_new_thoughts = expand_new_thoughts
        self._collapse_completed_thoughts = collapse_completed_thoughts
        self._thought_labeler = thought_labeler or LLMThoughtLabeler()

    def _require_current_thought(self) -> LLMThought:
        """Return our current LLMThought. Raise an error if we have no current
        thought.
        """
        if self._current_thought is None:
            raise RuntimeError("Current LLMThought is unexpectedly None!")
        return self._current_thought

    def _get_last_completed_thought(self) -> LLMThought | None:
        """Return our most recent completed LLMThought, or None if we don't have one."""
        if len(self._completed_thoughts) > 0:
            return self._completed_thoughts[len(self._completed_thoughts) - 1]
        return None

    def _complete_current_thought(self, final_label: str | None = None) -> None:
        """Complete the current thought, optionally assigning it a new label.
        Add it to our _completed_thoughts list.
        """
        thought = self._require_current_thought()
        thought.complete(final_label)
        self._completed_thoughts.append(thought)
        self._current_thought = None

    def on_llm_start(
        self, serialized: dict[str, Any], prompts: list[str], **kwargs: Any
    ) -> None:
        if self._current_thought is None:
            self._current_thought = LLMThought(
                parent_container=self._parent_container,
                expanded=self._expand_new_thoughts,
                collapse_on_complete=self._collapse_completed_thoughts,
                labeler=self._thought_labeler,
            )

        self._current_thought.on_llm_start(serialized, prompts)

        # We don't prune_old_thought_containers here, because our container won't
        # be visible until it has a child.

    def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        self._require_current_thought().on_llm_new_token(token, **kwargs)

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        self._require_current_thought().on_llm_end(response, **kwargs)

    def on_llm_error(self, error: BaseException, *args: Any, **kwargs: Any) -> None:
        self._require_current_thought().on_llm_error(error, **kwargs)

    def on_tool_start(
        self, serialized: dict[str, Any], input_str: str, **kwargs: Any
    ) -> None:
        self._require_current_thought().on_tool_start(serialized, input_str, **kwargs)

    def on_tool_end(
        self,
        output: str,
        color: str | None = None,
        observation_prefix: str | None = None,
        llm_prefix: str | None = None,
        **kwargs: Any,
    ) -> None:
        self._require_current_thought().on_tool_end(
            output, color, observation_prefix, llm_prefix, **kwargs
        )
        self._complete_current_thought()

    def on_tool_error(self, error: BaseException, *args: Any, **kwargs: Any) -> None:
        self._require_current_thought().on_tool_error(error, **kwargs)

    def on_agent_action(
        self, action: AgentAction, color: str | None = None, **kwargs: Any
    ) -> Any:
        self._require_current_thought().on_agent_action(action, color, **kwargs)

    def on_agent_finish(
        self, finish: AgentFinish, color: str | None = None, **kwargs: Any
    ) -> None:
        if self._current_thought is not None:
            self._current_thought.complete(
                self._thought_labeler.get_final_agent_thought_label()
            )
            self._current_thought = None
