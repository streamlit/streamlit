# Streamlit ASGI server integration

Use `st.App` when the user needs Streamlit as an ASGI app: custom HTTP routes,
middleware, lifespan hooks, external ASGI servers, or mounting inside another framework.

For normal Streamlit scripts, use `streamlit run app.py` and do not add
`if __name__ == "__main__"` guards inside the Streamlit script.

## Launching an `st.App`

Create a launcher module that defines an `st.App` object:

```python
# app.py
import streamlit as st

app = st.App("dashboard.py")
```

Supported launch modes:

```bash
streamlit run app.py
uvicorn app:app
```

For a direct Python launcher, add `App.run()` under a main guard in the launcher module:

```python
# app.py
import streamlit as st

app = st.App("dashboard.py")

if __name__ == "__main__":
    app.run()
```

Then run:

```bash
python app.py
uv run app.py
```

Use `app.run(config={...})` for programmatic config overrides that would otherwise be
CLI flags:

```python
if __name__ == "__main__":
    app.run(config={"server.port": 8502, "server.address": "0.0.0.0"})
```

`config` keys use dotted Streamlit config names. Unknown keys and sensitive options
such as `server.cookieSecret` are rejected; set sensitive values in config files or
environment variables instead.

## Important guardrail

`App.run()` is for launcher modules such as `app = st.App("dashboard.py")`. Avoid
same-file launchers like `app = st.App(__file__)`: Streamlit executes app scripts in a
fake `__main__` module, so an `if __name__ == "__main__": app.run()` block in the
Streamlit script can run again during app execution.

## Custom routes and middleware

```python
import streamlit as st
from starlette.responses import JSONResponse
from starlette.routing import Route


async def health(request):
    return JSONResponse({"ok": True})


app = st.App("dashboard.py", routes=[Route("/api/health", health)])
```

## Mounting in another ASGI framework

When mounting in FastAPI or Starlette, use the `st.App` object as the mounted app. If
the parent framework should manage lifespan, pass `streamlit_app.lifespan()` to the
parent framework's lifespan setup.

## References

- `streamlit run app.py` remains the default for ordinary Streamlit scripts.
- `uvicorn app:app` is for external ASGI serving.
- `python app.py` / `uv run app.py` is supported only when the launcher calls
  `app.run()`.
