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
from typing import TYPE_CHECKING, Any

import pandas as pd

import streamlit as st

if TYPE_CHECKING:
    from streamlit.components.v2.bidi_component import ComponentResult
    from streamlit.elements.lib.layout_utils import Height, Width
    from streamlit.runtime.state.common import WidgetCallback


st.header("Custom Components v2 - Basics")


# ---------------------------------------------------------------------------
# Empty content: component with no HTML/CSS/JS should not error
# ---------------------------------------------------------------------------
_EMPTY_CMP = st.components.v2.component("bidi_empty_content", isolate_styles=False)

with st.container(key="empty_component_container"):
    st.subheader("Empty content")
    _EMPTY_CMP(key="empty_component")
    st.write("After empty component")


# ---------------------------------------------------------------------------
# Shared: simple stateful component (range + text) used in multiple sections
# ---------------------------------------------------------------------------
_STATEFUL_JS = """
let hasMounted = {}

export default function(component) {
  const { parentElement, setStateValue, data, key } = component

  const rangeInput = parentElement.querySelector('#range')
  const textInput = parentElement.querySelector('#text')

  const hasMountedForKey = hasMounted[key]

  if (typeof data?.initialRange !== 'undefined' && !hasMountedForKey) {
    rangeInput.value = String(data.initialRange)
  }
  if (typeof data?.initialText !== 'undefined' && !hasMountedForKey) {
    textInput.value = String(data.initialText)
  }

  const handleRangeChange = (event) => {
    setStateValue('range', event.target.value)
  }

  const handleTextChange = (event) => {
    setStateValue('text', event.target.value)
  }

  rangeInput.addEventListener('change', handleRangeChange)
  textInput.addEventListener('input', handleTextChange)

  hasMounted[key] = true

  return () => {
    rangeInput.removeEventListener('change', handleRangeChange)
    textInput.removeEventListener('input', handleTextChange)
  }
}
"""

_STATEFUL_HTML = """
<div>
  <label for="range">Range</label>
  <input type="range" id="range" min="0" max="100" value="50" />
  <label for="text">Text</label>
  <input type="text" id="text" value="Text input" />
  <!-- Accessible labels used for selection in tests (no data-testids) -->
</div>
"""

_STATEFUL_CMP = st.components.v2.component(
    "bidi_stateful",
    js=_STATEFUL_JS,
    html=_STATEFUL_HTML,
)


def stateful_component(
    *,
    key: str | None = None,
    data: Any | None = None,
    on_range_change: WidgetCallback | None = None,
    on_text_change: WidgetCallback | None = None,
    width: Width = "stretch",
    height: Height = "content",
    default: dict[str, Any] | None = None,
) -> ComponentResult:
    return _STATEFUL_CMP(
        key=key,
        data=data,
        on_range_change=on_range_change,
        on_text_change=on_text_change,
        width=width,
        height=height,
        default=default,
    )


# ---------------------------------------------------------------------------
# Shared: trigger component (foo/bar/both)
# ---------------------------------------------------------------------------
_TRIGGER_JS = """
export default function(component) {
  const { parentElement, setTriggerValue } = component

  const handleClickFoo = () => { setTriggerValue('foo', true) }
  const handleClickBar = () => { setTriggerValue('bar', true) }
  const handleClickBoth = () => { setTriggerValue('foo', true); setTriggerValue('bar', true) }

  const fooButton = parentElement.querySelector('#foo-button')
  const barButton = parentElement.querySelector('#bar-button')
  const bothButton = parentElement.querySelector('#both-button')

  fooButton.addEventListener('click', handleClickFoo)
  barButton.addEventListener('click', handleClickBar)
  bothButton.addEventListener('click', handleClickBoth)

  return () => {
    fooButton.removeEventListener('click', handleClickFoo)
    barButton.removeEventListener('click', handleClickBar)
    bothButton.removeEventListener('click', handleClickBoth)
  }
}
"""

_TRIGGER_HTML = """
<div>
  <button id="foo-button">Trigger foo</button>
  <button id="bar-button">Trigger bar</button>
  <button id="both-button">Trigger both</button>
</div>
"""

_TRIGGER_CMP = st.components.v2.component(
    "bidi_trigger", js=_TRIGGER_JS, html=_TRIGGER_HTML
)


def trigger_component(
    *,
    key: str | None = None,
    data: Any | None = None,
    on_foo_change: WidgetCallback | None = None,
    on_bar_change: WidgetCallback | None = None,
) -> ComponentResult:
    return _TRIGGER_CMP(
        key=key,
        data=data,
        on_foo_change=on_foo_change,
        on_bar_change=on_bar_change,
    )


# ---------------------------------------------------------------------------
# Shared: form/fragment component used inside contexts
# ---------------------------------------------------------------------------
_CTX_JS = """
export default function(component) {
  const { parentElement, setStateValue, setTriggerValue, data } = component

  const contextName = data?.contextName ? String(data.contextName) : ''
  const textInput = parentElement.querySelector('#text-input')
  const setTextBtn = parentElement.querySelector('#set-text-btn')
  const triggerBtn = parentElement.querySelector('#trigger-btn')

  if (setTextBtn) setTextBtn.textContent = `Set text${contextName ? ` (${contextName})` : ''}`
  if (triggerBtn) triggerBtn.textContent = `Trigger click${contextName ? ` (${contextName})` : ''}`

  const onSetText = () => {
    const value = (textInput && 'value' in textInput) ? textInput.value : ''
    setStateValue('text', value)
  }

  const onTrigger = () => { setTriggerValue('clicked', true) }

  setTextBtn?.addEventListener('click', onSetText)
  triggerBtn?.addEventListener('click', onTrigger)

  return () => {
    setTextBtn?.removeEventListener('click', onSetText)
    triggerBtn?.removeEventListener('click', onTrigger)
  }
}
"""

_CTX_HTML = """
<label for="text-input">Inner Text</label>
<input id="text-input" type="text" value="hello" />
<div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
  <button id="set-text-btn">Set text</button>
  <button id="trigger-btn">Trigger click</button>
</div>
"""

_CTX_CMP = st.components.v2.component(
    name="bidi_ctx",
    js=_CTX_JS,
    html=_CTX_HTML,
)


def ctx_component(
    *,
    key: str | None = None,
    data: Any | None = None,
    on_text_change: WidgetCallback | None = None,
    on_clicked_change: WidgetCallback | None = None,
) -> ComponentResult:
    return _CTX_CMP(
        key=key,
        data=data,
        on_text_change=on_text_change,
        on_clicked_change=on_clicked_change,
    )


with st.container():
    st.subheader("Stateful")

    if "stateful_range_change_count" not in st.session_state:
        st.session_state.stateful_range_change_count = 0
    if "stateful_text_change_count" not in st.session_state:
        st.session_state.stateful_text_change_count = 0

    def _stateful_handle_range_change() -> None:
        st.session_state.stateful_range_change_count += 1

    def _stateful_handle_text_change() -> None:
        st.session_state.stateful_text_change_count += 1

    stateful_result = stateful_component(
        key="stateful_component_1",
        on_range_change=_stateful_handle_range_change,
        on_text_change=_stateful_handle_text_change,
    )

    st.write(f"Result: {stateful_result}")
    st.text(f"session_state: {st.session_state.get('stateful_component_1')}")
    st.write(f"Range change count: {st.session_state.stateful_range_change_count}")
    st.write(f"Text change count: {st.session_state.stateful_text_change_count}")
st.divider()


with st.container():
    st.subheader("Trigger")

    if "trigger_foo_count" not in st.session_state:
        st.session_state.trigger_foo_count = 0
    if "trigger_bar_count" not in st.session_state:
        st.session_state.trigger_bar_count = 0
    if "trigger_last_on_foo_change_processed" not in st.session_state:
        st.session_state.trigger_last_on_foo_change_processed = None
    if "trigger_last_on_bar_change_processed" not in st.session_state:
        st.session_state.trigger_last_on_bar_change_processed = None

    def _handle_foo_change() -> None:
        st.session_state.trigger_foo_count += 1
        st.session_state.trigger_last_on_foo_change_processed = time.strftime(
            "%H:%M:%S"
        )

    def _handle_bar_change() -> None:
        st.session_state.trigger_bar_count += 1
        st.session_state.trigger_last_on_bar_change_processed = time.strftime(
            "%H:%M:%S"
        )

    trigger_result = trigger_component(
        key="trigger_component_1",
        on_foo_change=_handle_foo_change,
        on_bar_change=_handle_bar_change,
    )

    st.write(f"Result: {trigger_result}")
    st.write(f"Foo count: {st.session_state.trigger_foo_count}")
    st.write(
        f"Last on_foo_change callback processed at: {st.session_state.trigger_last_on_foo_change_processed}"
    )
    st.write(f"Bar count: {st.session_state.trigger_bar_count}")
    st.write(
        f"Last on_bar_change callback processed at: {st.session_state.trigger_last_on_bar_change_processed}"
    )
    st.text(f"Session state: {st.session_state.get('trigger_component_1')}")

    st.button("st.button trigger")


st.divider()

with st.container():
    st.subheader("Form context (defer state; triggers ignored by CCv2 semantics)")

    if "form_text_changes" not in st.session_state:
        st.session_state.form_text_changes = 0
    if "form_clicked_changes" not in st.session_state:
        st.session_state.form_clicked_changes = 0

    def _handle_form_text_change() -> None:
        st.session_state.form_text_changes += 1

    def _handle_form_clicked_change() -> None:
        # This should not be invoked for CCv2 triggers inside forms.
        st.session_state.form_clicked_changes += 1

    with st.form(key="bidi_form", clear_on_submit=False):
        form_result = ctx_component(
            key="in_form",
            data={"contextName": "Form"},
            on_text_change=_handle_form_text_change,
            on_clicked_change=_handle_form_clicked_change,
        )
        st.form_submit_button("Submit Form")

    st.write(f"Form Result: {form_result}")
    st.text(f"Form session state: {st.session_state.get('in_form')}")
    st.write(f"Form Text changes: {st.session_state.form_text_changes}")
    st.write(f"Form Clicked count: {st.session_state.form_clicked_changes}")


st.divider()

with st.container():
    st.subheader("Fragment context (partial reruns and local counters)")

    if "frag_text_changes" not in st.session_state:
        st.session_state.frag_text_changes = 0
    if "frag_clicked_changes" not in st.session_state:
        st.session_state.frag_clicked_changes = 0
    if "runs" not in st.session_state:
        st.session_state.runs = 0
    st.session_state.runs += 1

    @st.fragment()
    def render_fragment() -> None:
        frag_result = ctx_component(
            key="in_fragment",
            data={"contextName": "Fragment"},
            on_text_change=lambda: _inc("frag_text_changes"),
            on_clicked_change=lambda: _inc("frag_clicked_changes"),
        )
        st.write(f"Fragment Result: {frag_result}")
        st.text(f"Fragment session state: {st.session_state.get('in_fragment')}")
        st.write(f"Fragment Text changes: {st.session_state.frag_text_changes}")
        st.write(f"Fragment Clicked count: {st.session_state.frag_clicked_changes}")

    def _inc(name: str) -> None:
        st.session_state[name] = int(st.session_state.get(name, 0)) + 1

    render_fragment()

    st.write(f"Runs: {st.session_state.runs}")


st.divider()

with st.container():
    st.subheader("Remount behavior (unmount/remount sequence with persistent state)")

    def _remount_stateful_component(
        *,
        key: str,
    ) -> ComponentResult:
        # Resolve initial values: prefer session_state if available, else fall back to default values
        state_value = st.session_state.get(key)
        initial_defaults: dict[str, Any] = {"range": 10, "text": "hello"}
        if isinstance(state_value, dict):
            initial_defaults.update(state_value)

        return stateful_component(
            key=key,
            on_range_change=lambda: _inc("remount_range_change_count"),
            on_text_change=lambda: _inc("remount_text_change_count"),
            default={"range": 10, "text": "hello"},
            data={
                "initialRange": initial_defaults.get("range", 10),
                "initialText": initial_defaults.get("text", "hello"),
            },
        )

    if "remount_range_change_count" not in st.session_state:
        st.session_state.remount_range_change_count = 0
    if "remount_text_change_count" not in st.session_state:
        st.session_state.remount_text_change_count = 0

    # Standard unmount/remount pattern
    if st.button("Create some elements to unmount component"):
        for _ in range(3):
            time.sleep(1)
            st.write("Another element")

    remount_key = "remount_component_1"
    st.write("Above the component")
    remount_result = _remount_stateful_component(key=remount_key)
    st.write(f"Result: {remount_result}")
    st.text(f"session_state: {st.session_state.get(remount_key)}")
    st.write(f"Range change count: {st.session_state.remount_range_change_count}")
    st.write(f"Text change count: {st.session_state.remount_text_change_count}")


st.divider()

with st.container():
    st.subheader("Basic (broad CSS + mixed state/trigger)")

    # Default values mirror the original default app
    _BASIC_DEFAULT = {
        "formValues": {
            "range": 20,
            "text": "Text input",
        },
    }

    _BASIC_JS = """
export default function(component) {
  const { data, parentElement, setStateValue, setTriggerValue } = component

  const form = parentElement.querySelector("form")
  const handleSubmit = (event) => {
    event.preventDefault()
    const formValues = {
      range: event.target.range.value,
      text: event.target.text.value,
    }
    setStateValue("formValues", formValues)
  }

  form.addEventListener("submit", handleSubmit)

  const handleClick = () => {
    setTriggerValue("clicked", true)
  }

  parentElement.addEventListener("click", handleClick)

  return () => {
    form.removeEventListener("submit", handleSubmit)
    parentElement.removeEventListener("click", handleClick)
  }
}
"""

    _BASIC_HTML = f"""
<h1>Hello World</h1>
<form>
  <label for="range">Range</label>
  <input type="range" id="range" name="range" min="0" max="100" value="{_BASIC_DEFAULT["formValues"]["range"]}" />
  <label for="text">Text</label>
  <input type="text" id="text" name="text" value="{_BASIC_DEFAULT["formValues"]["text"]}" />
  <button type="submit">Submit form</button>
  <!-- Accessible labels used for selection in tests (no data-testids) -->
</form>
"""

    # Intentionally broad CSS rules to verify style isolation
    _BASIC_CSS = """
div {
    color: var(--st-primary-color);
    background-color: var(--st-background-color);
}
"""

    _BASIC_CMP = st.components.v2.component(
        name="bidi_basic",
        js=_BASIC_JS,
        html=_BASIC_HTML,
        css=_BASIC_CSS,
    )

    def basic_component(
        *,
        key: str | None = None,
        data: Any | None = None,
        on_formValues_change: WidgetCallback | None = None,  # noqa: N803
        on_clicked_change: WidgetCallback | None = None,
        default: dict[str, Any] | None = None,
    ) -> ComponentResult:
        return _BASIC_CMP(
            key=key,
            data=data,
            on_formValues_change=on_formValues_change,
            on_clicked_change=on_clicked_change,
            default=default,
        )

    if "basic_click_count" not in st.session_state:
        st.session_state.basic_click_count = 0

    def _handle_basic_click() -> None:
        st.session_state.basic_click_count += 1

    # Changes of formValues are captured but do not update an extra counter
    def _handle_basic_change() -> None:
        pass

    basic_result = basic_component(
        key="basic_component_1",
        data={"label": "Some data from python"},
        on_formValues_change=_handle_basic_change,
        on_clicked_change=_handle_basic_click,
        default=_BASIC_DEFAULT,
    )

    st.write(f"Result: {basic_result}")
    st.text(f"session_state: {st.session_state.get('basic_component_1')}")
    st.write(f"Click count: {st.session_state.basic_click_count}")

st.divider()

with st.container():
    st.subheader("Global hotkey interface")

    if "hotkey_runs" not in st.session_state:
        st.session_state.hotkey_runs = 0
    st.session_state.hotkey_runs += 1

    _HOTKEY_JS = """
export default function(component) {
  const { parentElement, setStateValue } = component

  const form = parentElement.querySelector("form")
  const input = parentElement.querySelector("#hotkey-text")

  const handleSubmit = (event) => {
    event.preventDefault()
    setStateValue("text", input?.value ?? "")
  }

  form.addEventListener("submit", handleSubmit)

  return () => {
    form.removeEventListener("submit", handleSubmit)
  }
}
"""

    _HOTKEY_HTML = """
<form>
  <label for="hotkey-text">Hotkey Text</label>
  <input type="text" id="hotkey-text" name="hotkey-text" value="" />
  <button type="submit">Submit</button>
</form>
"""

    _HOTKEY_CMP = st.components.v2.component(
        name="bidi_hotkey_regression",
        js=_HOTKEY_JS,
        html=_HOTKEY_HTML,
    )

    def hotkey_regression_component(*, key: str) -> ComponentResult:
        return _HOTKEY_CMP(key=key)

    hotkey_result = hotkey_regression_component(key="hotkey_regression_component")
    st.write(f"Hotkey runs: {st.session_state.hotkey_runs}")
    st.write(f"Result: {hotkey_result}")


st.divider()

with st.container():
    st.subheader("Arrow serialization")

    # Component that receives two DataFrames and a label and renders
    # their schema and row data, verifying Arrow serialization.
    _ARROW_JS = """
export default function(component) {
  const { parentElement, data } = component

  const root = parentElement.querySelector("#my-arrow-component")

  const { df, df2, label } = data;
  const cols = df.schema.fields.map((f) => f.name);
  const rows = df.toArray();
  const cols2 = df2.schema.fields.map((f) => f.name);
  const rows2 = df2.toArray();

  root.innerText = `Label: ${label}\nCols: ${cols}\nRows: ${rows}\nCols2: ${cols2}\nRows2: ${rows2}`
}
"""

    _ARROW_HTML = """
<div id="my-arrow-component"></div>
"""

    _ARROW_CMP = st.components.v2.component(
        name="my_arrow_component",
        js=_ARROW_JS,
        html=_ARROW_HTML,
    )

    def arrow_component(*, key: str, data: Any) -> ComponentResult:
        return _ARROW_CMP(key=key, data=data)

    df = pd.DataFrame({"a": [1, 2, 3]})
    df2 = pd.DataFrame({"b": [4, 5, 6]})

    arrow_component(
        key="my_arrow_component",
        data={
            "df": df,
            "df2": df2,
            "label": "Hello World",
        },
    )
