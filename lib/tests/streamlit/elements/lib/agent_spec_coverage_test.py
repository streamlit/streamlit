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
    {
        "key",
        "action",
        "value_schema",
        "support",
        "transparent",
        "clearable",
        "choices",
        "data_url",
        "data_summary",
    }
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
    # A click or submit already reaches the server, so this is not a mode.
    # Buttons that accept on_click="ignore" still report that mode.
    "on_click": _CALLBACK,
    "on_submit": _CALLBACK,
    "format_func": _FORMATTER,
    "default": _STARTING_VALUE,
    "index": _STARTING_VALUE,
    "selection_default": _STARTING_VALUE,
    "bind": "reported by the snapshot from the widget registry, which every widget fills",
    "persist_state": _STATE_HANDLING,
    "shortcut": _BROWSER_AFFORDANCE,
    "data": _CONTENT,
}

# Omitted for one command only.
_OMITTED: dict[str, dict[str, str]] = {
    "altair_chart": {"altair_chart": _CONTENT, "theme": _PRESENTATION},
    "audio": {"sample_rate": _ENCODING},
    "checkbox": {"value": _STARTING_VALUE},
    "code": {"wrap_lines": _PRESENTATION},
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
    "echarts_chart": {
        "spec": _CONTENT,
        "renderer": _PRESENTATION,
        "theme": _PRESENTATION,
    },
    "exception": {"exception": _CONTENT},
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
    "plotly_chart": {
        "figure_or_data": _CONTENT,
        "config": _PRESENTATION,
        "theme": _PRESENTATION,
    },
    "pydeck_chart": {"pydeck_obj": _CONTENT},
    "pyplot": {
        "fig": _CONTENT,
        "clear_figure": "acts on the figure after it is drawn, not on the page",
    },
    "radio": {"horizontal": _PRESENTATION},
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
    "vega_lite_chart": {"spec": _CONTENT, "theme": _PRESENTATION},
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


def _html_with_javascript() -> None:
    st.html("<b>Hello</b>", unsafe_allow_javascript=True)


def _url_iframe() -> None:
    st.iframe("https://example.com")


_PRODUCER_OVERRIDES: dict[str, ELEMENT_PRODUCER] = {
    "dialog": _dialog,
    "form_submit_button": _form_submit_button,
}

# Extra calls so a command with more than one support signature is exercised.
_EXTRA_PRODUCERS: dict[str, list[ELEMENT_PRODUCER]] = {
    "html": [_html_with_javascript],
    "iframe": [_url_iframe],
}


def _producers_by_command() -> dict[str, list[ELEMENT_PRODUCER]]:
    producers: dict[str, list[ELEMENT_PRODUCER]] = defaultdict(list)
    for command, producer in WIDGET_ELEMENTS + NON_WIDGET_ELEMENTS + CONTAINER_ELEMENTS:
        producers[command].append(producer)
    for command, producer in _PRODUCER_OVERRIDES.items():
        producers[command] = [producer]
    for command, extras in _EXTRA_PRODUCERS.items():
        producers[command].extend(extras)
    return dict(producers)


_PRODUCERS = _producers_by_command()
_DESCRIBED_COMMANDS = sorted(set(_PRODUCERS) - set(_NOT_DESCRIBED))

# (action, key is set, support, value_schema type). Every signature a command's
# producers emit. More than one entry is an intentional path difference.
_RESERVED_FIELDS: dict[
    str, frozenset[tuple[str | None, bool, str | None, str | None]]
] = {
    "altair_chart": frozenset(
        {(None, False, None, None), (None, True, "action_unsupported", None)}
    ),
    "area_chart": frozenset({(None, False, None, None)}),
    "audio": frozenset({(None, False, None, None)}),
    "audio_input": frozenset({(None, True, "action_unsupported", None)}),
    "badge": frozenset({(None, False, None, None)}),
    "balloons": frozenset({(None, False, None, None)}),
    "bar_chart": frozenset({(None, False, None, None)}),
    "button": frozenset({("trigger", True, None, None)}),
    "camera_input": frozenset({(None, True, "action_unsupported", None)}),
    "caption": frozenset({(None, False, None, None)}),
    "chat_input": frozenset({("trigger", True, None, "string")}),
    "chat_message": frozenset({(None, False, None, None)}),
    "checkbox": frozenset({("value", True, None, "boolean")}),
    "code": frozenset({(None, False, None, None)}),
    "color_picker": frozenset({("value", True, None, "string")}),
    "columns": frozenset({(None, False, None, None)}),
    "container": frozenset({(None, False, None, None)}),
    "data_editor": frozenset({(None, True, "action_unsupported", None)}),
    "dataframe": frozenset(
        {(None, False, None, None), (None, True, "action_unsupported", None)}
    ),
    "date_input": frozenset({("value", True, None, "string")}),
    "datetime_input": frozenset({("value", True, None, "string")}),
    "dialog": frozenset({(None, False, None, None)}),
    "divider": frozenset({(None, False, None, None)}),
    "download_button": frozenset({("trigger", True, None, None)}),
    "echarts_chart": frozenset({(None, False, None, None)}),
    "empty": frozenset({(None, False, None, None)}),
    "error": frozenset({(None, False, None, None)}),
    "exception": frozenset({(None, False, None, None)}),
    "expander": frozenset({(None, False, None, None)}),
    "feedback": frozenset({("value", True, None, "integer")}),
    "file_uploader": frozenset({(None, True, "action_unsupported", None)}),
    "form": frozenset({(None, True, None, None)}),
    "form_submit_button": frozenset({("trigger", True, None, None)}),
    "graphviz_chart": frozenset({(None, False, None, None)}),
    "header": frozenset({(None, False, None, None)}),
    "help": frozenset({(None, False, None, None)}),
    "html": frozenset(
        {(None, False, None, None), (None, False, "browser_required", None)}
    ),
    "iframe": frozenset(
        {(None, False, None, None), (None, False, "browser_required", None)}
    ),
    "image": frozenset({(None, False, None, None)}),
    "info": frozenset({(None, False, None, None)}),
    "json": frozenset({(None, False, None, None)}),
    "latex": frozenset({(None, False, None, None)}),
    "line_chart": frozenset({(None, False, None, None)}),
    "link_button": frozenset({(None, False, None, None)}),
    "map": frozenset({(None, False, None, None)}),
    "markdown": frozenset({(None, False, None, None)}),
    "menu_button": frozenset({("trigger", True, None, "string")}),
    "mermaid_chart": frozenset({(None, False, None, None)}),
    "metric": frozenset({(None, False, None, None)}),
    "multiselect": frozenset({("value", True, None, "array")}),
    "number_input": frozenset({("value", True, None, "number")}),
    "page_link": frozenset({(None, False, None, None)}),
    "pagination": frozenset({("value", True, None, "integer")}),
    "pills": frozenset({("value", True, None, "string")}),
    "plotly_chart": frozenset(
        {(None, False, None, None), (None, True, "action_unsupported", None)}
    ),
    "popover": frozenset({(None, False, None, None)}),
    "progress": frozenset({(None, False, None, None)}),
    "pydeck_chart": frozenset(
        {(None, False, None, None), (None, True, "action_unsupported", None)}
    ),
    "pyplot": frozenset({(None, False, None, None)}),
    "radio": frozenset({("value", True, None, "string")}),
    "scatter_chart": frozenset({(None, False, None, None)}),
    "segmented_control": frozenset({("value", True, None, "string")}),
    "select_slider": frozenset({("value", True, None, "string")}),
    "selectbox": frozenset({("value", True, None, "string")}),
    "skeleton": frozenset({(None, False, None, None)}),
    "slider": frozenset({("value", True, None, "integer")}),
    "snow": frozenset({(None, False, None, None)}),
    "space": frozenset({(None, False, None, None)}),
    "status": frozenset({(None, False, None, None)}),
    "subheader": frozenset({(None, False, None, None)}),
    "success": frozenset({(None, False, None, None)}),
    "table": frozenset({(None, False, None, None)}),
    "tabs": frozenset({(None, False, None, None)}),
    "text": frozenset({(None, False, None, None)}),
    "text_area": frozenset({("value", True, None, "string")}),
    "text_input": frozenset({("value", True, None, "string")}),
    "time_input": frozenset({("value", True, None, "string")}),
    "title": frozenset({(None, False, None, None)}),
    "toast": frozenset({(None, False, None, None)}),
    "toggle": frozenset({("value", True, None, "boolean")}),
    "vega_lite_chart": frozenset(
        {(None, False, None, None), (None, True, "action_unsupported", None)}
    ),
    "video": frozenset({(None, False, None, None)}),
    "warning": frozenset({(None, False, None, None)}),
}


def _reserved_signature(
    keywords: dict[str, Any],
) -> tuple[str | None, bool, str | None, str | None]:
    """action, whether key is set, support, and the value schema's JSON type."""
    schema = keywords.get("value_schema")
    schema_type = schema.get("type") if isinstance(schema, dict) else None
    return (
        keywords.get("action"),
        keywords.get("key") is not None,
        keywords.get("support"),
        schema_type if isinstance(schema_type, str) else None,
    )


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
        """The prop names `command` passes when it describes itself, or None."""
        own = self._own_calls(command)
        if not own:
            return None
        return {name for keywords in own for name in keywords} - _RESERVED_KEYWORDS

    def _own_calls(self, command: str) -> list[dict[str, Any]]:
        """The keywords of every description `command` builds for itself.

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

        return [keywords for name, keywords in calls if name == command]

    @parameterized.expand(_DESCRIBED_COMMANDS)
    def test_values_declare_their_schema(self, command: str) -> None:
        """A widget that holds a value says what JSON a request sends it."""
        undeclared = [
            keywords
            for keywords in self._own_calls(command)
            if keywords.get("action") == "value" and not keywords.get("value_schema")
        ]
        assert not undeclared, (
            f"st.{command} has `action='value'` but no `value_schema`. Pass the "
            "JSON Schema of its value, built from the constants in agent_spec."
        )

    @parameterized.expand(_DESCRIBED_COMMANDS)
    def test_reserved_fields_match_the_command(self, command: str) -> None:
        """action, key, support, and value_schema are fixed per command.

        Checking them only when a call already sets one would let a widget
        drop its action or schema and still pass. Each command lists every
        signature its producers emit. A command with more than one entry has
        paths that differ, such as a chart with and without selections.
        """
        observed = frozenset(
            _reserved_signature(keywords) for keywords in self._own_calls(command)
        )
        expected = _RESERVED_FIELDS[command]
        assert observed == expected, (
            f"st.{command} reserved fields are {sorted(observed)}, expected "
            f"{sorted(expected)}. Update the description, or _RESERVED_FIELDS "
            "when a path is an intentional exception."
        )

    @parameterized.expand(_DESCRIBED_COMMANDS)
    def test_deferring_widgets_report_on_change(self, command: str) -> None:
        """A widget that can defer its rerun says whether it does.

        With `on_change="ignore"` the browser applies a change without
        rerunning, so a client batches such a widget with the trigger that
        should rerun, which it can only do if the description names the mode.
        """
        on_change = inspect.signature(getattr(st, command)).parameters.get("on_change")
        if on_change is None or not any(
            mode in str(on_change.annotation) for mode in ("OnChangeMode", "ignore")
        ):
            return
        unreported = [
            keywords
            for keywords in self._own_calls(command)
            if keywords.get("action") == "value" and "on_change" not in keywords
        ]
        assert not unreported, (
            f"st.{command} can defer its rerun with `on_change='ignore'`, but its "
            "description does not report `on_change`. Pass "
            "`on_change='ignore' if on_change == 'ignore' else 'rerun'`."
        )

    @parameterized.expand(_DESCRIBED_COMMANDS)
    def test_optional_triggers_report_on_click(self, command: str) -> None:
        """A button whose click may stay in the browser says whether it does.

        With `on_click="ignore"` a click never reaches the server, so whether
        the element is a trigger at all depends on the mode.
        """
        on_click = inspect.signature(getattr(st, command)).parameters.get("on_click")
        if on_click is None or "ignore" not in str(on_click.annotation):
            return
        unreported = [
            keywords
            for keywords in self._own_calls(command)
            if "on_click" not in keywords
        ]
        assert not unreported, (
            f"st.{command} can keep a click in the browser with "
            "`on_click='ignore'`, but its description does not report `on_click`. "
            "Pass the mode, and `action='trigger'` when a click reaches the server."
        )

    @parameterized.expand(_DESCRIBED_COMMANDS)
    def test_description_matches_signature(self, command: str) -> None:
        """Every described command accounts for every public parameter."""
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
        """All coverage tables reference commands with element mocks."""
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
