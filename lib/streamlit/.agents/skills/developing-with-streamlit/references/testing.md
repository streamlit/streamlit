
# Testing Streamlit apps

Streamlit ships a first-party, headless test framework: `st.testing.v1.AppTest`. It runs your script in-process, simulates widget interaction, and lets you assert on the resulting elements — all without a browser.

## Prefer AppTest over a real browser

For logic and behavior tests, use `AppTest`, not `streamlit run` + Selenium/Playwright.

`AppTest` is:
- **In-process and headless** — no browser, no server, no port.
- **Deterministic** — you call `.run()` explicitly; there are no async render races.
- **Fast** — tests run in milliseconds, so they fit a normal unit-test suite and CI.

```python
# BAD: spin up a server and drive a browser just to check filtering logic
# (slow, flaky, needs a browser + webdriver, hard to assert on values)
subprocess.Popen(["streamlit", "run", "app.py"])
driver.get("http://localhost:8501")
driver.find_element(...).click()  # brittle DOM selectors

# GOOD: in-process, deterministic, asserts on element values directly
from streamlit.testing.v1 import AppTest

at = AppTest.from_file("app.py").run()
at.selectbox[0].select("Active").run()
assert not at.exception
```

Reach for Playwright when you must verify the actual rendered DOM, CSS, or custom-component JavaScript, or when the interaction only exists in the browser (see *What AppTest can and cannot do*). For "does my app compute and display the right thing," `AppTest` is the right tool.

**Test pure logic with plain pytest — not AppTest.** If a function doesn't touch `st.*` (data transforms, parsing, calculations), factor it out and unit-test it directly with pytest. Reserve `AppTest` for the app's *UI* behavior: widget interaction, what renders, session state. Don't wrap pure logic in a Streamlit script just to exercise it.

## Creating an AppTest

Three constructors, all returning an `AppTest` you then `.run()`:

```python
from streamlit.testing.v1 import AppTest

# From a file (recommended for real apps; path is relative to the test file)
at = AppTest.from_file("streamlit_app.py").run()

# From a string (handy for short, self-contained scripts)
at = AppTest.from_string("import streamlit as st; st.write('hi')").run()


# From a function (write the script body with IDE assistance)
def script():
    import streamlit as st

    st.title("Hello")


at = AppTest.from_function(script).run()
```

The script must be runnable on its own, so it must include its own imports. `.run()` accepts an optional `timeout` (seconds); the default is 3. If a script with heavy imports times out on a cold CI runner, raise it with `.run(timeout=10)` or `AppTest.from_file("app.py", default_timeout=10)`.

`from_function` copies that function's source into a new module. That module does not define names from the test file, including closures. AppTest stores the resulting `NameError` on `at.exception`. Pass data through `args` or `kwargs`, or use `from_file` / `from_string`:

```python
def script(name):
    import streamlit as st

    st.write(name)


at = AppTest.from_function(script, args=("Ada",)).run()
assert at.markdown[0].value == "Ada"
```

### Multipage apps

`AppTest` renders one page at a time. Initialize from the app's **entrypoint** script — the same file you would pass to `streamlit run` — whether the app uses `st.navigation` or a `pages/` directory:

```python
at = AppTest.from_file("streamlit_app.py").run()  # entrypoint, not a child page
```

To reach a file-based child page, call `switch_page()` with a path relative to the entrypoint, then `.run()`. `switch_page()` does not rerun on its own. Pass the **file** path, not a custom `url_path`. Call `.run()` first so `st.navigation` can register pages; before that, a page whose `url_path` differs from the filename will not resolve:

```python
at = AppTest.from_file("streamlit_app.py").run()
at.switch_page("app_pages/settings.py").run()  # file path, even if url_path="settings"
assert not at.exception
```

If the file is missing, or `st.navigation` is active and that file is not a registered page, `switch_page()` raises `ValueError` instead of opening the default page.

Don't pass a child page straight to `from_file()` — that makes it the main script and changes how relative page paths resolve.

## Simulating interaction

Set a widget value, then call `.run()` to rerun the app — just like a real interaction triggers a rerun. Methods return the widget, so calls chain:

```python
at.text_input[0].set_value("foo").run()
at.number_input[0].set_value(5).run()
at.slider[0].set_value(10).run()
at.checkbox[0].set_value(True).run()
at.selectbox[0].select("Option").run()  # .select is an alias for .set_value
at.button[0].click().run()
```

Convenience aliases exist where they read naturally: `at.checkbox[0].check()` / `.uncheck()`, `at.multiselect[0].select(value)`, `at.slider[0].set_range(lo, hi)`.

Upload widgets take bytes instead of opening a file picker. These attributes are lists, so index the widget (or look it up by key) before calling a method:

- `at.file_uploader[0].upload(filename, content)` adds one file. Call it once per file.
- `at.camera_input[0].upload(...)` and `at.audio_input[0].upload(...)` replace the staged photo or recording. Names must end in `.jpg` (camera) or `.wav` (audio).
- `at.chat_input[0].set_value(text)` sets the message. `.upload()` attaches a file only when the widget accepts files, and that submit is one-shot. `.clear()` removes staged files and leaves the text.

For file, camera, and audio inputs inside a form, click the submit button and call `.run()` to commit staged uploads. `st.chat_input` cannot be used inside `st.form()`.

Widgets, keyed display elements, and keyed containers are addressable by index (order on the page) or by `key`. Use `get_by_key()` when the type does not matter. A missing key raises `KeyError`; a key reused across nodes raises `AppTestError`:

```python
at.selectbox(key="status").select("Active").run()
at.button(key="submit").click().run()
at.container(key="filters").text_input[0].set_value("q").run()
at.expander(key="details")  # keyed lookup, like container
at.get_by_key("filters")  # unique key, any type
```

`st.tabs(..., key=)` stores that key on the tab container, not on the panels in `at.tabs`. Use `at.get_by_key("sections")`. `at.tabs("sections")` raises `KeyError`.

`at.get()` accepts public command names (`datetime_input`, `help`, `pills`, `segmented_control`, `columns`) as well as stored node types (`date_time_input`, `help_info`).

Do not `set_value`, `click`, or otherwise update a disabled widget — that raises `AppTestError` (from `streamlit.testing.v1`), matching a browser user who cannot interact with it.

The same `AppTest` instance keeps fragment registrations across `.run()` calls, so a callback can target `@st.fragment(key=...)` registered on an earlier run.

### Forms

Widgets inside `st.form` commit only when that form's submit button is clicked. Stage values with `set_value`, then click the submit button before calling `.run()`; a `.run()` without the click discards the staged values. `at.form_submit_button` lists only buttons inside a form (they also appear in `at.button`). `at.form("my_form")` returns the block created by `st.form("my_form")`.

```python
at.text_input[0].set_value("Ada")
at.checkbox[0].check()
at.form_submit_button[0].click().run()
```

## Asserting on results

Each element type is exposed as a list; index into it and read `.value`:

```python
assert at.markdown[0].value == "Welcome"
assert at.metric[0].value == "42"  # metric values are strings
assert len(at.dataframe[0].value) == 3  # .value is a pandas DataFrame
```

Alerts are lists too, so truthiness tells you whether one was shown:

```python
assert at.error  # at least one st.error rendered
assert not at.success  # no st.success rendered
assert at.warning[0].value == "Low balance"
```

`st.progress`, `st.html`, `st.help`, `st.space`, `st.link_button`, and `st.page_link` are read-only lists. Assert on what the script produced; `.set_value()` and `.click()` raise `AppTestError`. `.click()` does not open a link-button URL or follow a page link. Switch pages with `AppTest.switch_page`.

```python
assert at.progress[0].value == 25  # st.progress(0.25) is stored as an int from 0 to 100
assert at.progress[0].text == "halfway"
assert at.html[0].value == "<b>hi</b>"
assert at.help[0].value == "'Hello'"
assert at.space[0].value == "small"  # st.space() with no size; .size is the same value
assert at.link_button[0].value == "Docs"  # the label; .url is the target
assert at.page_link[0].value == "Example"  # the label, or the inferred page title
```

`at.help[i].value` keeps a readable repr (`"'Hello'"`, `Point(1, 2)`). When `st.help` stored a parameter-list signature, `.value` is the expression passed to `st.help` (`st.help(len)` is `"len"`, not `"builtins.len(obj, /)"`). The raw stored text is `.proto.value`, and the docstring is `.doc_string`.

### Assert the app didn't crash

`at.exception` collects any uncaught exception surfaced by the script. Check it after every run:

```python
at.button[0].click().run()
assert not at.exception
```

### Reading and seeding session state

`at.session_state` supports item and attribute access, `.get`, `keys`, `items`, `values`, `to_dict`, and iteration. It does not implement `setdefault`, `update`, `pop`, or `clear`. Seed it before a run, or read it after:

```python
at.session_state["user"] = "alice"  # seed before running
at.run()
assert at.session_state["count"] == 1
assert at.session_state.get("missing") is None
```

Seed `at.query_params` the same way. After `.run()`, a single value is a `str` (a one-element list collapses to `str`), a blank value stays `""`, and repeated keys stay `list[str]`. Repeated `st.query_params` values are kept. Item access and `to_dict()` return only the last value; `get_all(key)` returns the full list. `AppTest.query_params` keeps lists.

```python
at.query_params["status"] = "open"
at.query_params["tag"] = ["a", "b"]
at.run()
assert at.query_params["status"] == "open"
assert at.query_params["tag"] == ["a", "b"]
```

## Using pytest

`AppTest` tests are plain functions — no fixtures or plugins required. `from_function` is convenient for testing a snippet inline without a separate file:

```python
from streamlit.testing.v1 import AppTest


def test_counter_increments():
    def script():
        import streamlit as st

        st.session_state.setdefault("count", 0)
        if st.button("Add"):
            st.session_state.count += 1
        st.metric("Count", st.session_state.count)

    at = AppTest.from_function(script).run()
    at.button[0].click().run()

    assert at.metric[0].value == "1"
    assert not at.exception
```

### Mocking app code

`AppTest` runs the script from its source on every run; it does not import it. `unittest.mock.patch("app.fetch_data")` imports `app.py` as a regular module. That import runs the script's top-level code outside `AppTest`, and `.run()` never uses the patched module. If that code opens an `st.dialog`, the import raises `StreamlitAPIException`. Move what you want to mock into a helper module that the script imports, patch it there, and call `.run()` inside the `with` block:

```python
# helpers.py
def fetch_data():
    return "real"


# app.py
import streamlit as st

import helpers

st.write(helpers.fetch_data())


# test_app.py
from unittest.mock import patch

from streamlit.testing.v1 import AppTest


def test_with_mocked_data():
    with patch("helpers.fetch_data", return_value="mocked"):
        at = AppTest.from_file("app.py").run()
    assert at.markdown[0].value == "mocked"
```

Functions decorated with `@st.fragment` or `@st.dialog` need a running script. Called directly from test code, they do not run their body (a fragment returns `None`). Test them through `AppTest`.

## Worked example: a filtered dataframe

App (`app.py`):

```python
import pandas as pd
import streamlit as st

df = pd.DataFrame({"name": ["a", "b", "c"], "status": ["Active", "Inactive", "Active"]})

status = st.selectbox("Status", ["All", "Active", "Inactive"], key="status")
filtered = df if status == "All" else df[df["status"] == status]
st.dataframe(filtered)
```

Test (`test_app.py`):

```python
from streamlit.testing.v1 import AppTest


def test_status_filter():
    at = AppTest.from_file("app.py").run()
    assert not at.exception
    assert len(at.dataframe[0].value) == 3  # unfiltered: all rows

    at.selectbox(key="status").select("Active").run()

    result = at.dataframe[0].value
    assert not at.exception
    assert len(result) == 2
    assert (result["status"] == "Active").all()
```

## What AppTest can and cannot do

Elements fall into three groups:

- **Interactive.** Widget collections such as `at.button`, `at.text_input`, and `at.selectbox`, plus the other widgets that expose `set_value`, `select`, or `click`. Set the value, then `.run()`.
- **Inspectable.** The read-only lists under *Asserting on results*, plus `at.data_editor` (edit it through `at.session_state`). `.set_value()` and `.click()` raise `AppTestError`.
- **Browser-only.** Use Playwright. This covers rendered DOM and CSS, custom-component JavaScript, scroll and resize, media playback, selections on `st.dataframe` and charts (there is no setter for click-to-select rows or Altair/Plotly selection events), and dialog-body code such as `if st.button(...):` when the script does not call the dialog again on that rerun.

Inspect `st.data_editor` with `at.data_editor`. Those elements also stay on `at.dataframe`. `.value` is the input table. A keyed editor's `at.session_state` value is the edit state (`edited_rows`, `added_rows`, `deleted_rows`). Assigning that state before `.run()` changes the table the script receives; `.value` stays the input table.

Elements without an `at.<command>` list do not break `.run()`. Examples include `st.balloons`, `st.snow`, `st.empty`, `st.skeleton`, `st.audio`, `st.video`, and charts. Inspect them with `at.get("<node type>")`. That name is usually the command (`"audio"`). Charts use the proto field: `"plotly_chart"`, `"vega_lite_chart"` (Altair and the built-in Vega-Lite charts), `"deck_gl_json_chart"` (`st.pydeck_chart` and `st.map`), `"graphviz_chart"`, and `"echarts_chart"`. `.value` reads widget state first, so a keyed chart with `on_select="rerun"` returns its selection. Otherwise `.value` uses `value`, `body`, `text`, or `label`, and is `None` when the proto has none of those (chart specs live on fields such as `.spec`). `st.audio` and `st.video` expose the media URL on `.url`. `.set_value()` and `.click()` raise `AppTestError`. AppTest does not play media. For a keyed widget AppTest does not model, assign through `at.session_state` or use Playwright.

A button inside `st.dialog` is on the tree after the opener is clicked and `.run()`. `.click().run()` reruns the whole script, not the dialog fragment. AppTest does not click the opener on that rerun. If the script does not call the dialog function again, body code such as `if st.button(...):` does not execute. An `on_click` callback still runs before the rerun, and its session-state updates remain. Use Playwright for that workflow. To test the body with AppTest, open the dialog from session state.

With the default `on_change="ignore"`, popover contents are already on the tree. Interact with inner widgets as if they were in the main script. Content guarded by `.open` is absent while closed, and that guard exists only when the popover tracks state (`on_change="rerun"` or a callback). If that popover also has a key, set `at.session_state[key] = True` before `.run()`. Otherwise use Playwright.

## References

- [AppTest API](https://docs.streamlit.io/develop/api-reference/app-testing/st.testing.v1.apptest)
- [App testing concepts](https://docs.streamlit.io/develop/concepts/app-testing)
- [Get started with app testing](https://docs.streamlit.io/develop/concepts/app-testing/get-started)
- [Beyond the basics of app testing](https://docs.streamlit.io/develop/concepts/app-testing/beyond-the-basics)
