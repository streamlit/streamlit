
# Displaying output with st.write and magic

`st.write` is the most general way to put things on screen, magic is the implicit shorthand for it, and `st.write_stream` streams iterables (like LLM token streams) with a typewriter effect. These are great for quick or mixed output. When presentation matters, reach for a specific element instead.

## st.write — the swiss-army display command

`st.write` dispatches on the type of each argument, and you can pass several at once:

```python
st.write("Hello **world**")                 # str → st.markdown (renders as Markdown)
st.write(df)                                 # DataFrame → st.dataframe (interactive table)
st.write({"name": "Alice", "roles": [1, 2]}) # dict/list → st.json (interactive, collapsible)
st.write(fig)                                # Matplotlib/Altair/Plotly figure → the matching chart
st.write("Result:", df, "Done.")             # multiple args, each rendered in order
```

Other recognized types include `Exception` (→ `st.exception`), functions/modules/classes (→ `st.help`), `PIL.Image` (→ `st.image`), SymPy expressions (→ `st.latex`), and generators/streams (→ `st.write_stream`). Anything unrecognized is shown as `str(arg)` in inline code.

Note that dicts and lists render as interactive JSON, *not* as a table.

## Magic — bare values render automatically

In the main script, a variable or literal on a line by itself is automatically passed to `st.write` — no `st.write(...)` call needed.

```python
df = load_data()

"## Sales report"   # rendered as Markdown
df                  # rendered as an interactive table
df.describe()       # rendered as a table
```

Magic only applies to the **main script file** (including inside its functions, loops, and `with` blocks). Bare values inside imported modules are *not* rendered. It is enabled by default and can be turned off with the `runner.magicEnabled = false` config option, so don't rely on it in code others may run with magic disabled — be explicit with `st.write` there.

## st.write_stream — typewriter streaming

`st.write_stream` consumes a generator, iterable, or stream-like object, writing string chunks with a typewriter effect and non-string chunks via `st.write`. It returns the concatenated result (a `str` if only text was streamed, otherwise a list), which you can store or replay.

```python
def token_stream():
    for word in "Streaming one word at a time".split():
        yield word + " "
        time.sleep(0.02)

full_text = st.write_stream(token_stream)
```

It accepts OpenAI and LangChain streams directly. Passing a plain string or DataFrame raises an error — use `st.write` for those. For streaming an assistant reply inside a chat turn, see chat-ui.md.

## Prefer a specific element when presentation matters

`st.write` and magic are ideal for quick output and notebook-style flow. When you want layout or configuration control, name the specific element:

- `st.dataframe` (with `column_config`) instead of `st.write(df)` when you need column formatting, hidden columns, or selection — see data-display.md.
- `st.metric` for KPI numbers instead of writing a number or dict.
- `st.json` for raw JSON you want collapsible (this is also what `st.write` uses for dicts/lists).

```python
# BAD: dumps a KPI dict as interactive JSON — no formatting, no emphasis
st.write({"revenue": 1200000, "users": 4820, "growth": 0.12})

# GOOD: purpose-built KPI display with layout
c1, c2, c3 = st.columns(3)
c1.metric("Revenue", "$1.2M")
c2.metric("Users", "4,820")
c3.metric("Growth", "12%", delta="+3%")
```

## References

- [st.write](https://docs.streamlit.io/develop/api-reference/write-magic/st.write)
- [st.write_stream](https://docs.streamlit.io/develop/api-reference/write-magic/st.write_stream)
- [Magic](https://docs.streamlit.io/develop/api-reference/write-magic/magic)
- [st.metric](https://docs.streamlit.io/develop/api-reference/data/st.metric)
- [st.json](https://docs.streamlit.io/develop/api-reference/data/st.json)
