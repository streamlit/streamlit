
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

Reach for Playwright only when you must verify the actual rendered DOM, CSS, or custom-component JavaScript. For "does my app compute and display the right thing," `AppTest` is the right tool.

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

### Multipage apps

`AppTest` renders one page at a time. Initialize from the app's **entrypoint** script — the same file you would pass to `streamlit run` — whether the app uses `st.navigation` or a `pages/` directory:

```python
at = AppTest.from_file("streamlit_app.py").run()  # entrypoint, not a child page
```

To reach a file-based child page, call `switch_page()` with a path relative to the entrypoint, then `.run()`. `switch_page()` does not rerun on its own:

```python
at = AppTest.from_file("streamlit_app.py").run()
at.switch_page("pages/settings.py").run()
assert not at.exception
```

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

Widgets are addressable by index (order on the page) or by `key`:

```python
at.selectbox(key="status").select("Active").run()
at.button(key="submit").click().run()
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

### Assert the app didn't crash

`at.exception` collects any uncaught exception surfaced by the script. Check it after every run:

```python
at.button[0].click().run()
assert not at.exception
```

### Reading and seeding session state

`at.session_state` behaves like `st.session_state`. Seed it before a run, or read it after:

```python
at.session_state["user"] = "alice"  # seed before running
at.run()
assert at.session_state["count"] == 1
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

## What AppTest can't simulate

`AppTest` covers widget interaction and the elements your script produces, but it does **not** reproduce every front-end interaction. In particular, **selections on `st.dataframe` and charts** (click-to-select rows, Altair/Plotly selection events) can't be triggered through `AppTest` — there's no setter for them, so you can't assert on what a user's on-chart selection would return. The same applies to anything that only exists in the rendered browser: custom-component JavaScript, CSS, and scroll/resize behavior. Cover those with Playwright e2e tests instead.

## References

- [AppTest API](https://docs.streamlit.io/develop/api-reference/app-testing/st.testing.v1.apptest)
- [App testing concepts](https://docs.streamlit.io/develop/concepts/app-testing)
- [Get started with app testing](https://docs.streamlit.io/develop/concepts/app-testing/get-started)
- [Beyond the basics of app testing](https://docs.streamlit.io/develop/concepts/app-testing/beyond-the-basics)
