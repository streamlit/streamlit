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

"""Every command's agent-API description matches its public signature.

The agent API reports an element as its command name, with the command's own
parameter names as `props`. This test holds every command in `element_mocks` to
that rule in both directions:

- Every name a command passes to `agent_spec.element` or `agent_spec.block` is
  one of its parameters, or a fact Streamlit derived, listed in
  `_DERIVED_PROPS`.
- Every parameter is either passed, or listed in `_OMITTED_EVERYWHERE` or
  `_OMITTED` with the reason it is left out.

So adding a parameter to a command fails here until someone decides whether an
agent needs it. `streamlit_test.py` already requires every public command to
have an element mock, so a new command is covered as soon as it gets one.

Names are read from the calls rather than from the emitted JSON, which drops
unset parameters: a command's coverage does not depend on which arguments its
mock happens to set.
"""

from __future__ import annotations

import inspect
from collections import defaultdict
from typing import TYPE_CHECKING, Any
from unittest.mock import patch

from parameterized import parameterized

import streamlit as st
from streamlit.elements.lib import agent_spec
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.element_mocks import (
    CONTAINER_ELEMENTS,
    NON_WIDGET_ELEMENTS,
    WIDGET_ELEMENTS,
)

if TYPE_CHECKING:
    from tests.streamlit.element_mocks import ELEMENT_PRODUCER

# Keywords of `agent_spec.element` and `agent_spec.block` that are not props.
_RESERVED_KEYWORDS = frozenset(
    {"key", "action", "support", "data_url", "data_summary", "transparent"}
)

# Why a parameter is not in its command's `props`.
_PRESENTATION = "presentation, which the snapshot leaves out"
_IDENTITY = "reported as the node's `key`"
_CALLBACK = "callback wiring, which a client can neither see nor send"
_FORMATTER = "already applied to the reported `options`"
_STARTING_VALUE = "only picks the starting value, which the node's `value` reports"
_STATE_HANDLING = "how the server keeps the value, not what the element means"
_BROWSER_AFFORDANCE = "a browser affordance, with nothing to read or send without one"
_CONTENT = "the content itself, reported under `data`, as a `url`, or as derived props"
_UPLOAD = "applies to uploads, which this interface cannot send"
_ENCODING = "applied when the media is encoded; the reported `url` serves the result"

# Omitted for every command that has them.
_OMITTED_EVERYWHERE: dict[str, str] = {
    "width": _PRESENTATION,
    "height": _PRESENTATION,
    "use_container_width": _PRESENTATION,
    "use_column_width": _PRESENTATION,
    "wrap": _PRESENTATION,
    "text_alignment": _PRESENTATION,
    "icon_position": _PRESENTATION,
    "border": _PRESENTATION,
    "gap": _PRESENTATION,
    "vertical_alignment": _PRESENTATION,
    "horizontal_alignment": _PRESENTATION,
    "key": _IDENTITY,
    "args": _CALLBACK,
    "kwargs": _CALLBACK,
    "on_change": _CALLBACK,
    "on_click": _CALLBACK,
    "on_submit": _CALLBACK,
    "on_select": _CALLBACK,
    "on_dismiss": _CALLBACK,
    "format_func": _FORMATTER,
    "default": _STARTING_VALUE,
    "index": _STARTING_VALUE,
    "selection_default": _STARTING_VALUE,
    "bind": _STATE_HANDLING,
    "persist_state": _STATE_HANDLING,
    "shortcut": _BROWSER_AFFORDANCE,
    "data": _CONTENT,
}

# Omitted for one command only.
_OMITTED: dict[str, dict[str, str]] = {
    "altair_chart": {"altair_chart": _CONTENT},
    "audio": {"sample_rate": _ENCODING},
    "audio_input": {"sample_rate": _UPLOAD},
    "camera_input": {"resolution": _UPLOAD},
    "chat_input": {"audio_sample_rate": _UPLOAD, "max_upload_size": _UPLOAD},
    "checkbox": {"value": _STARTING_VALUE},
    "color_picker": {"value": _STARTING_VALUE},
    "columns": {"spec": _PRESENTATION},
    "container": {"autoscroll": _BROWSER_AFFORDANCE, "horizontal": _PRESENTATION},
    "data_editor": {"row_height": _PRESENTATION},
    "dataframe": {
        "lazy": "how the data is delivered; `data.complete` reports the result",
        "row_height": _PRESENTATION,
    },
    "date_input": {"value": _STARTING_VALUE},
    "datetime_input": {"value": _STARTING_VALUE},
    "echarts_chart": {"spec": _CONTENT, "renderer": _PRESENTATION},
    "exception": {"exception": _CONTENT},
    "file_uploader": {"max_upload_size": _UPLOAD},
    "header": {"divider": _PRESENTATION},
    "help": {"obj": _CONTENT},
    "iframe": {"tab_index": _BROWSER_AFFORDANCE},
    "image": {
        "image": _CONTENT,
        "channels": _ENCODING,
        "clamp": _ENCODING,
        "output_format": _ENCODING,
    },
    "markdown": {"anchors": _BROWSER_AFFORDANCE},
    "multiselect": {"select_all": _BROWSER_AFFORDANCE},
    "number_input": {"value": _STARTING_VALUE},
    "pagination": {"max_visible_pages": _PRESENTATION},
    "plotly_chart": {"figure_or_data": _CONTENT, "config": _PRESENTATION},
    "pydeck_chart": {"pydeck_obj": _CONTENT},
    "pyplot": {
        "fig": _CONTENT,
        "clear_figure": "acts on the figure after it is drawn, not on the page",
    },
    "select_slider": {"value": _STARTING_VALUE},
    "slider": {"value": _STARTING_VALUE},
    "space": {"size": _PRESENTATION},
    "subheader": {"divider": _PRESENTATION},
    "text_area": {"value": _STARTING_VALUE},
    "text_input": {
        "value": _STARTING_VALUE,
        "live": "whether the browser reruns on every keystroke",
    },
    "time_input": {"value": _STARTING_VALUE},
    "toggle": {"value": _STARTING_VALUE},
    "vega_lite_chart": {"spec": _CONTENT},
}

# Reported names that are not parameters: facts Streamlit derived from what the
# author passed.
_MEDIA_URL = "the media URL the app registered for its own client"
_DERIVED_PROPS: dict[str, dict[str, str]] = {
    "audio": {"url": _MEDIA_URL},
    "dialog": {"is_open": "whether the dialog is open in this run"},
    "download_button": {"url": _MEDIA_URL},
    "exception": {
        "message": "read from the exception",
        "type": "read from the exception",
        "stack_trace": "read from the exception",
        "is_warning": "read from the exception",
        "uncaught": "whether the runtime, not the app, displayed it",
    },
    "graphviz_chart": {"engine": "read from the graph"},
    "help": {
        "name": "read from the object",
        "type": "read from the object",
        "doc_string": "read from the object",
    },
    "image": {"url": _MEDIA_URL},
    "page_link": {"external": "whether `page` leaves the app"},
    "popover": {"open": "whether the popover is open in this run"},
    "pyplot": {"url": _MEDIA_URL},
    "video": {"url": _MEDIA_URL},
}

# Commands whose element mock emits no description of its own.
_NOT_DESCRIBED: dict[str, str] = {
    "echo": "delegates to `code`",
    "logo": "app chrome, sent outside the element tree",
    "pdf": "delegates to a custom component",
    "spinner": "transient: gone by the time a run settles",
    "write": "delegates to the command that fits its argument, such as `markdown`",
    "write_stream": "delegates to `markdown` for each chunk",
}


def _form_submit_button() -> None:
    # The element mock proxies this with a text input, since it needs a form.
    with st.form("agent_spec_coverage_form"):
        st.form_submit_button("Submit")


def _dialog() -> None:
    # The element mock returns the decorator without opening a dialog.
    @st.dialog("Dialog")
    def show() -> None:
        st.write("Body")

    show()


_PRODUCER_OVERRIDES: dict[str, ELEMENT_PRODUCER] = {
    "dialog": _dialog,
    "form_submit_button": _form_submit_button,
}


def _producers_by_command() -> dict[str, list[ELEMENT_PRODUCER]]:
    producers: dict[str, list[ELEMENT_PRODUCER]] = defaultdict(list)
    for command, producer in WIDGET_ELEMENTS + NON_WIDGET_ELEMENTS + CONTAINER_ELEMENTS:
        producers[command].append(producer)
    for command, producer in _PRODUCER_OVERRIDES.items():
        producers[command] = [producer]
    return dict(producers)


_PRODUCERS = _producers_by_command()
_DESCRIBED_COMMANDS = sorted(set(_PRODUCERS) - set(_NOT_DESCRIBED))


def _parameters(command: str) -> set[str]:
    signature = inspect.signature(getattr(st, command))
    return {
        name
        for name, parameter in signature.parameters.items()
        if parameter.kind not in {parameter.VAR_POSITIONAL, parameter.VAR_KEYWORD}
    }


class AgentDescriptionCoverageTest(DeltaGeneratorTestCase):
    """Hold each command's description to its signature."""

    def _described_names(self, command: str) -> set[str] | None:
        """The prop names `command` passes when it describes itself, or None.

        Runs every element mock for the command with recording forced on, so
        commands with several code paths, such as a dataframe with and without
        selections, are covered by their union.
        """
        calls: list[tuple[str, dict[str, Any]]] = []
        real_element, real_block = agent_spec.element, agent_spec.block

        def element(name: str, /, **keywords: Any) -> str | None:
            calls.append((name, keywords))
            return real_element(name, **keywords)

        def block(name: str, /, **keywords: Any) -> str | None:
            calls.append((name, keywords))
            return real_block(name, **keywords)

        with (
            patch.object(agent_spec, "is_recording", return_value=True),
            patch.object(agent_spec, "element", element),
            patch.object(agent_spec, "block", block),
        ):
            for producer in _PRODUCERS[command]:
                producer()

        own = [keywords for name, keywords in calls if name == command]
        if not own:
            return None
        return {name for keywords in own for name in keywords} - _RESERVED_KEYWORDS

    @parameterized.expand(_DESCRIBED_COMMANDS)
    def test_description_matches_signature(self, command: str) -> None:
        described = self._described_names(command)
        assert described is not None, (
            f"st.{command} emitted no agent-API description of its own. Describe "
            "it with `agent_spec.element` or `agent_spec.block` where it fills "
            "its proto, or list it in _NOT_DESCRIBED with the reason."
        )

        parameters = _parameters(command)
        omitted = _OMITTED_EVERYWHERE.keys() | _OMITTED.get(command, {}).keys()
        derived = set(_DERIVED_PROPS.get(command, {}))

        not_parameters = described - parameters - derived
        assert not not_parameters, (
            f"st.{command} reports {sorted(not_parameters)} in its agent "
            "description, which are not parameters of the command. Use the "
            "public parameter name, or, for a fact Streamlit derived, list it in "
            "_DERIVED_PROPS with what it is derived from."
        )

        undecided = parameters - described - omitted
        assert not undecided, (
            f"st.{command} has parameters its agent description neither reports "
            f"nor lists as omitted: {sorted(undecided)}. If a parameter changes "
            "what the element means or how it can be used, pass it in the "
            "command's `agent_spec.element(...)` call; otherwise add it to "
            "_OMITTED with the reason it is left out."
        )

    @parameterized.expand(sorted(_OMITTED))
    def test_command_omissions_are_current(self, command: str) -> None:
        """An omission for a parameter the command lost, or now reports, is stale."""
        listed = set(_OMITTED[command])
        missing = listed - _parameters(command)
        assert not missing, (
            f"_OMITTED lists {sorted(missing)} for st.{command}, which has no such "
            "parameters. Remove them."
        )
        described = self._described_names(command) or set()
        reported = listed & described
        assert not reported, (
            f"_OMITTED lists {sorted(reported)} for st.{command}, but its "
            "description now reports them. Remove them from _OMITTED."
        )

    @parameterized.expand(sorted(_DERIVED_PROPS))
    def test_derived_props_are_current(self, command: str) -> None:
        """A derived prop that is now a parameter, or no longer reported, is stale."""
        listed = set(_DERIVED_PROPS[command])
        now_parameters = listed & _parameters(command)
        assert not now_parameters, (
            f"_DERIVED_PROPS lists {sorted(now_parameters)} for st.{command}, "
            "which are parameters of the command. Remove them."
        )
        unreported = listed - (self._described_names(command) or set())
        assert not unreported, (
            f"_DERIVED_PROPS lists {sorted(unreported)} for st.{command}, which "
            "its description no longer reports. Remove them."
        )

    def test_lists_name_real_commands(self) -> None:
        for name, listing in (
            ("_OMITTED", _OMITTED),
            ("_DERIVED_PROPS", _DERIVED_PROPS),
            ("_NOT_DESCRIBED", _NOT_DESCRIBED),
        ):
            unknown = set(listing) - set(_PRODUCERS)
            assert not unknown, (
                f"{name} lists {sorted(unknown)}, which have no element mock. "
                "Remove them, or add the commands to element_mocks."
            )
