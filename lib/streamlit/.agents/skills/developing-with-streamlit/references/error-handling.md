
# Streamlit error handling

By default, an uncaught exception renders a full traceback right in the app. That's bad UX, and the traceback can leak file paths, queries, secrets, and other internals to whoever is looking at the app. Handle expected failure modes deliberately instead of letting them crash the script.

## Wrap risky operations in try/except

Anything that can fail at runtime should be guarded: external API calls, database and `st.connection` queries, file parsing, and conversions of user input. Catch the specific exceptions you expect — never a bare `except:`, which also swallows things like `KeyboardInterrupt` and hides real bugs.

```python
# BAD: any failure dumps a traceback into the app and keeps running
data = requests.get(url).json()
df = pd.DataFrame(data)
st.line_chart(df)

# GOOD: handle the expected failure, then halt cleanly
try:
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    data = response.json()
except requests.RequestException as e:
    st.error(f"Couldn't reach the data service. Try again shortly. ({e})")
    st.stop()

df = pd.DataFrame(data)
st.line_chart(df)
```

## Show a friendly message, then st.stop()

On a handled failure, surface an actionable message with `st.error(...)` (or `st.warning(...)` for recoverable conditions), then call `st.stop()`. `st.stop()` halts the script immediately, so downstream code never runs against bad or missing state.

```python
# GOOD: query is isolated; on failure the rest of the script doesn't run
conn = st.connection("sql")
try:
    df = conn.query("SELECT * FROM sales WHERE region = :region", params={"region": region})
except Exception as e:
    st.error("Failed to load sales data. Check the connection and try again.")
    st.stop()

st.dataframe(df)          # only reached when the query succeeded
st.metric("Total", df["amount"].sum())
```

Without the `st.stop()`, execution falls through to `st.dataframe(df)` with `df` undefined, producing a *second* error that obscures the first.

## Validate user input before using it

Guard inputs for empty/`None` and out-of-range values up front, and explain what's needed — don't let a downstream call throw on bad input. Match the message to the situation: a field the user simply hasn't filled in yet warrants a neutral `st.info` prompt, not an alarming `st.warning`. Reserve `st.warning`/`st.error` for input that's genuinely invalid.

```python
# BAD: empty name crashes the lookup with a traceback
name = st.text_input("Customer name")
record = lookup_customer(name)  # raises on ""

# GOOD: absent input isn't an error — prompt neutrally with st.info, then stop.
# (Save st.warning / st.error for input that's actually wrong, like the
# conversion failure below.)
name = st.text_input("Customer name")
if not name:
    st.info("Enter a customer name to continue.")
    st.stop()

record = lookup_customer(name)
```

Conversions deserve the same treatment, since user text rarely matches the type you need:

```python
raw = st.text_input("Quantity")
try:
    qty = int(raw)
except ValueError:
    st.error("Quantity must be a whole number.")
    st.stop()

if qty <= 0:
    st.warning("Quantity must be greater than zero.")
    st.stop()
```

## st.exception is for debug surfaces, not the default path

`st.exception(e)` renders the exception object and its traceback in the app. That's useful on a deliberate debug or admin surface, but it exposes internals — so it should not be your default user-facing error. Prefer a plain-language `st.error` for users, and reserve `st.exception` for when you genuinely want the object shown.

```python
# Debug-only surface, e.g. behind an admin toggle
try:
    result = run_pipeline()
except Exception as e:
    if st.session_state.get("debug_mode"):
        st.exception(e)       # full traceback for the developer
    else:
        st.error("Something went wrong running the pipeline.")
    st.stop()
```

## Keep try blocks narrow

Wrap only the one risky call, not the whole script. A narrow block makes the failure mode obvious, lets you tailor the message to that specific failure, and avoids accidentally catching unrelated errors from your own rendering code.

```python
# BAD: one giant try hides which line failed and what to tell the user
try:
    df = load_data()
    df = transform(df)
    st.dataframe(df)
    st.line_chart(df)
except Exception:
    st.error("Something went wrong.")
    st.stop()

# GOOD: only the fragile call is guarded
try:
    df = load_data()
except FileNotFoundError:
    st.error("Data file is missing. Upload it and rerun.")
    st.stop()

df = transform(df)
st.dataframe(df)
st.line_chart(df)
```

## Errors inside cached functions

An exception raised inside an `@st.cache_data` or `@st.cache_resource` function is **not** cached — it propagates to the caller, and re-raises on every rerun until the inputs change or the call finally succeeds. So guard the *call site*, not the cached body, and don't assume a failure gets memoized away.

```python
@st.cache_data
def load_prices(ticker: str) -> pd.DataFrame:
    resp = requests.get(f"https://api.example.com/prices/{ticker}", timeout=10)
    resp.raise_for_status()        # let it raise on a real failure
    return pd.DataFrame(resp.json())

# GOOD: handle the failure where you CALL the cached function.
try:
    prices = load_prices(ticker)
except requests.RequestException:
    st.error("Couldn't load prices. Try again shortly.")
    st.stop()
```

Don't wrap the body in a `try/except` that returns a sentinel (e.g. an empty DataFrame) just to avoid raising — Streamlit caches that sentinel and keeps serving it. Let the function raise; catch at the call site.

## App-wide handler (st.App)

The patterns above handle *expected* failures locally. For a catch-all over anything that slips through — to log it or show a branded fallback instead of the default traceback — register an app-wide handler via `st.App(on_script_error=...)`. See [server-asgi.md](server-asgi.md#error-handling).

## References

- [st.error](https://docs.streamlit.io/develop/api-reference/status/st.error)
- [st.warning](https://docs.streamlit.io/develop/api-reference/status/st.warning)
- [st.exception](https://docs.streamlit.io/develop/api-reference/status/st.exception)
- [st.stop](https://docs.streamlit.io/develop/api-reference/execution-flow/st.stop)
- [st.connection](https://docs.streamlit.io/develop/api-reference/connections/st.connection)
- [st.cache_data](https://docs.streamlit.io/develop/api-reference/caching-and-state/st.cache_data)
