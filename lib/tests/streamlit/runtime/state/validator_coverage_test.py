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

"""Every widget says what a client may send it.

The boundary check (`widget_checks.check_client_value`) runs a widget's
`WidgetMetadata.validator` on every changed client value, before any callback.
A widget registered without one accepts any value of the right wire type that
its deserializer reads, so a widget with options, bounds, or other constraints
needs a validator for the server to enforce them.

This test reads every `register_widget` call in `lib/streamlit` and fails for
one that passes no `validator=`, or passes `None`, unless `_WITHOUT_VALIDATOR`
lists the function that makes the call, with the reason. It reads the calls
rather than running the element mocks, so a code path no mock reaches, such as
a custom component, a `ButtonColumn` click, or an open dialog, is covered too.
"""

from __future__ import annotations

import ast
from pathlib import Path
from typing import NamedTuple

import streamlit

_LIB = Path(streamlit.__file__).parent

# `register_widget` itself and the session state methods it calls.
_PLUMBING = "runtime/state/"

_ANY_VALUE = "any value of the right wire type is legal"
_TRIGGER = "a trigger, where any value of the right wire type is a click"
_OPEN_STATE = "an open state, and either bool is legal"
_NO_CONSTRAINTS = "a custom component declares no value constraints"
_SELECTIONS = "deferred: dataframe and chart selections are items 8 and 12"
_UPLOADS = "deferred: uploads are item 11, on the upload's HTTP path"

# The functions whose `register_widget` call passes no validator, with the
# reason. Keyed by the module's path in `lib/streamlit` and the qualified name
# of the function that makes the call.
_WITHOUT_VALIDATOR: dict[str, str] = {
    "elements/widgets/checkbox.py::CheckboxMixin._checkbox": (
        f"a checkbox or toggle, where {_ANY_VALUE}"
    ),
    "elements/widgets/button.py::ButtonMixin._button": _TRIGGER,
    "elements/widgets/button.py::ButtonMixin._download_button": _TRIGGER,
    "elements/widgets/button.py::ButtonMixin._link_button": _TRIGGER,
    # A dialog reports its dismissal as a trigger.
    "elements/lib/dialog.py::Dialog._create": _TRIGGER,
    "elements/layouts.py::LayoutsMixin.expander": _OPEN_STATE,
    "elements/layouts.py::LayoutsMixin.popover": _OPEN_STATE,
    "components/v1/custom_component.py::CustomComponent.create_instance."
    "marshall_component": _NO_CONSTRAINTS,
    # The component's state and its trigger aggregator.
    "components/v2/bidi_component/main.py::BidiComponentMixin._bidi_component": (
        _NO_CONSTRAINTS
    ),
    "elements/widgets/data_editor.py::DataEditorMixin.data_editor": (
        "deferred: the data editor's edit policy is item 6"
    ),
    "elements/lib/column_config_utils.py::register_button_column_widgets": (
        "deferred: a ButtonColumn click's row bound is part of item 8"
    ),
    "elements/arrow.py::ArrowMixin.dataframe": _SELECTIONS,
    "elements/vega_charts.py::VegaChartsMixin._vega_lite_chart": _SELECTIONS,
    "elements/plotly_chart.py::PlotlyMixin.plotly_chart": _SELECTIONS,
    "elements/echarts_chart.py::EChartsMixin.echarts_chart": _SELECTIONS,
    "elements/deck_gl_json_chart.py::PydeckMixin.pydeck_chart": _SELECTIONS,
    "elements/widgets/file_uploader.py::FileUploaderMixin._file_uploader": _UPLOADS,
    "elements/widgets/camera_input.py::CameraInputMixin._camera_input": _UPLOADS,
    "elements/widgets/audio_input.py::AudioInputMixin._audio_input": _UPLOADS,
}


class _Call(NamedTuple):
    site: str
    line: int
    has_validator: bool


def _register_widget_calls() -> list[_Call]:
    """Every `register_widget` call outside the state package, in file order."""
    calls: list[_Call] = []
    for path in sorted(_LIB.rglob("*.py")):
        module = path.relative_to(_LIB).as_posix()
        if module.startswith(_PLUMBING):
            continue
        source = path.read_text(encoding="utf-8")
        if "register_widget(" not in source:
            continue
        calls.extend(_calls_in(module, ast.parse(source)))
    return calls


def _calls_in(module: str, tree: ast.Module) -> list[_Call]:
    calls: list[_Call] = []
    scope: list[str] = []

    def visit(node: ast.AST) -> None:
        is_scope = isinstance(
            node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
        )
        if is_scope:
            scope.append(node.name)
        if isinstance(node, ast.Call) and _callee(node) == "register_widget":
            validator = next(
                (kw.value for kw in node.keywords if kw.arg == "validator"), None
            )
            has_validator = validator is not None and not (
                isinstance(validator, ast.Constant) and validator.value is None
            )
            calls.append(
                _Call(f"{module}::{'.'.join(scope)}", node.lineno, has_validator)
            )
        for child in ast.iter_child_nodes(node):
            visit(child)
        if is_scope:
            scope.pop()

    visit(tree)
    return calls


def _callee(call: ast.Call) -> str | None:
    if isinstance(call.func, ast.Name):
        return call.func.id
    if isinstance(call.func, ast.Attribute):
        return call.func.attr
    return None


_CALLS = _register_widget_calls()


def test_the_walk_finds_the_widgets() -> None:
    """The walk reads real calls, so an empty result cannot pass the check below."""
    sites = {call.site for call in _CALLS if call.has_validator}
    assert "elements/widgets/selectbox.py::SelectboxMixin._selectbox" in sites
    assert "elements/layouts.py::LayoutsMixin.tabs" in sites


def test_every_widget_registers_a_validator() -> None:
    """A widget without a validator is listed with the reason any value is legal."""
    missing = [
        f"{call.site} (line {call.line})"
        for call in _CALLS
        if not call.has_validator and call.site not in _WITHOUT_VALIDATOR
    ]
    assert not missing, (
        "These widgets register without a validator, so the server accepts any "
        f"value of the right wire type for them: {missing}. Add a `validate` "
        "method to the widget's serde and pass `validator=serde.validate` to "
        "`register_widget`, or, if any such value is legal, list the function in "
        "_WITHOUT_VALIDATOR with the reason."
    )


def test_the_list_without_a_validator_is_current() -> None:
    """A listed function that no longer registers, or now has a validator, is stale."""
    without = {call.site for call in _CALLS if not call.has_validator}
    stale = sorted(set(_WITHOUT_VALIDATOR) - without)
    assert not stale, (
        f"_WITHOUT_VALIDATOR lists {stale}, which no longer register a widget "
        "without a validator. Remove them."
    )
