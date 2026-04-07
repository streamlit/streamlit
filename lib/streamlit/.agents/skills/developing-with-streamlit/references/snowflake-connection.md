
# Streamlit Snowflake connection

Connect your Streamlit app to Snowflake the right way.

## Use st.connection

Always use `st.connection("snowflake")` instead of raw connectors.

```python
import streamlit as st

conn = st.connection("snowflake")

# Query data
df = conn.query("SELECT * FROM my_table LIMIT 100")
st.dataframe(df)
```

**Why st.connection:**
- Automatic connection pooling
- Built-in caching
- Handles reconnection
- Works with st.secrets

## Caller's rights connection (Streamlit 1.53+)

For apps running in Snowflake, use caller's rights to run queries with the viewer's permissions instead of the app owner's:

```python
conn = st.connection("snowflake", type="snowflake-callers-rights")
```

This is useful when:
- Different users should see different data based on their Snowflake roles
- You want row-level security to apply based on the viewer
- You don't want the app to have elevated permissions

## Cached queries

Use the built-in `ttl` parameter to cache query results:

```python
from datetime import timedelta

conn = st.connection("snowflake")

# Cache for 10 minutes
df = conn.query("SELECT * FROM metrics", ttl=timedelta(minutes=10))

# Cache for 1 hour
df = conn.query("SELECT * FROM reference_data", ttl=3600)
```

## Configure with st.secrets

Store credentials in `.streamlit/secrets.toml` (never commit this file).

**CRITICAL**: Derive the `account` and `host` values from the user's Snowflake CLI connection config. Run `snow connection list` and use the exact values. A wrong `account` will redirect to the wrong login page.

```toml
# .streamlit/secrets.toml
[connections.snowflake]
account = "ORGNAME-ACCTNAME"            # from `snow connection list`
host = "myaccount.snowflakecomputing.com"  # from `snow connection list` (include if present)
user = "your_user"
authenticator = "externalbrowser"
warehouse = "your_warehouse"
database = "your_database"
schema = "your_schema"
```

Add to `.gitignore`:
```
.streamlit/secrets.toml
```

## Parameterized queries

Use parameters to prevent SQL injection:

```python
conn = st.connection("snowflake")

# Safe: parameterized
df = conn.query(
    "SELECT * FROM users WHERE region = :region",
    params={"region": selected_region}
)

# UNSAFE: string formatting - don't do this
# df = conn.query(f"SELECT * FROM users WHERE region = '{selected_region}'")
```

## Write data

Use the session for write operations:

```python
conn = st.connection("snowflake")
session = conn.session()

# Write a dataframe
session.write_pandas(df, "MY_TABLE", auto_create_table=True)

# Execute statements
session.sql("INSERT INTO logs VALUES (:ts, :msg)", params={...}).collect()
```

## Multiple connections

Define multiple connections in secrets:

```toml
# .streamlit/secrets.toml
[connections.snowflake]
account = "prod_account"
# ... prod credentials

[connections.snowflake_staging]
account = "staging_account"
# ... staging credentials
```

```python
prod_conn = st.connection("snowflake")
staging_conn = st.connection("snowflake_staging")
```

## Chat with Cortex

Build a chat interface using Snowflake Cortex LLMs:

```python
import streamlit as st
from snowflake.cortex import complete

st.set_page_config(page_title="AI Assistant", page_icon=":sparkles:")

if "messages" not in st.session_state:
    st.session_state.messages = []

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.write(msg["content"])

if prompt := st.chat_input("Ask anything"):
    st.session_state.messages.append({"role": "user", "content": prompt})

    with st.chat_message("user"):
        st.write(prompt)

    with st.chat_message("assistant"):
        response = st.write_stream(
            complete(
                "claude-3-5-sonnet",
                prompt,
                session=st.connection("snowflake").session(),
                stream=True,
            )
        )

    st.session_state.messages.append({"role": "assistant", "content": response})
```

See `building-streamlit-chat-ui` for more chat patterns (avatars, suggestions, history management).

## Python 3.12+ dependency caveat

`streamlit[snowflake]` gates `snowflake-connector-python` on `python_version < "3.12"`. On Python 3.12+, the connector is silently skipped and you get `No module named 'snowflake'` at runtime. Always add `snowflake-connector-python>=3.3.0` as an explicit dependency in `pyproject.toml`:

```toml
dependencies = [
    "snowflake-connector-python>=3.3.0",
    "streamlit[snowflake]>=1.54.0",
]
```

## References

- [st.connection](https://docs.streamlit.io/develop/api-reference/connections/st.connection)
- [SnowflakeConnection](https://docs.streamlit.io/develop/api-reference/connections/st.connections.snowflakeconnection)
- [st.secrets](https://docs.streamlit.io/develop/api-reference/connections/st.secrets)
