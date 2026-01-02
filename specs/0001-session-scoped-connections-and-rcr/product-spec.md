Author: @sfc-gh-jkinkead

Status: Draft

---

# Session-scoped Connections and Snowflake Restricted Caller's Rights

## Summary

This proposal adds support for session-scoped values in `st.cache_resource` and `st.connection`. It also proposes using
this new support to implement a new connection type, `snowflake` with caller's rights, which handles creating
[restricted caller's rights
sessions](https://docs.snowflake.com/en/developer-guide/snowpark-container-services/additional-considerations-services-jobs#label-spcs-additional-considerations-configuring-callers-rights)
when running in Snowpark Container Services.

## Problem

[st.connection](https://docs.streamlit.io/develop/api-reference/connections/st.connection) provides an API for
configuring and creating connection objects based on user-supplied configuration. Out-of-the-box, this provides only SQL
database connection support, although the API is generic enough to handle any type of persistent connection.

There is one limitation: `st.connection` caches the connection object in a global scope, meaning that any connection
must be thread-safe, and must contain only sharable configuration. This makes it impossible to use `st.connection` for
any type of per-user session. For example, this API isn’t suitable for building an app on Snowpark Container Services
that uses caller’s rights, since that connection must be scoped to the user’s session. It also wouldn’t be suitable for
connecting to any other API that required user-scoped tokens - like fetching data from a user’s GitHub account via
GitHub’s graphQL API.

This proposal outlines changes to `st.connection` and `st.cache_resource` that will allow for session-scoped
connections, and how we will use these changes to write a connection to handle Snowpark Container Services restricted
caller’s rights connections.

The proposed API changes are:
* Add session-scoped connections. This would be a natural extension to the current connection API, and would support any
    user-scoped connection, like an HTTP client that’s using per-user OAuth credentials to make requests.
* Add connection close hooks. Connections should be able to be closed when they are removed from a cache.
* Add a session-scoped `st.cache_resource` and `st.cache_data` with a dedicated store outside of `st.session_state`. This falls out of the
    first two items: If we want session-scoped connections, we need a way to cache them in the session. Keeping this
    out of `session_state` makes it much cleaner to implement close hooks, since we won’t be sharing a namespace
    with widget or arbitrary user data.

    Note that this cache could be scoped to st.connection instead - but since the current connection implementation
    leverages `cache_resource` for all caching, it would be nice if the session-scoped caching leveraged a common
    library as well.
* Add cache expiration hooks. If we’re building close hooks for connections, we should likely just build these as
    expiration hooks on `cache_resource`. These are useful for any resource cache with a TTL or max entry count - and
    they’re semi-mandatory for session-scoped cached resources.
* Add a new session-scoped connection type that creates Snowflake caller's rights sessions when invoked while running
    in an appropriately-configured Snowpark Container Services service.

### Restricted caller's rights (RCR) details
On Snowpark Container Services, when restricted caller’s rights (RCR) are enabled for a service, all requests handled by
the service come with an authentication token header that can be used to create a new session with Snowflake which will
have RCR permissions enabled. These tokens are valid for a relatively short period of time, typically two minutes. In
these apps, the tokens sent with the initial websocket connection are available to users in the `st.context.headers`
dict.

Since these connections are scoped to the Streamlit session (they are tied to a single user), they need to be created on
app load. Additionally, they can’t use the globally-scoped `st.cache_resource` or use `st.connection` (which uses
`st.cache_resource` under the hood).

So, an app author is stuck with several bad options:
* Create a new connection with each script execution. This will slow the app down and start failing after the token expires in two minutes.
* Create a connection without session keepalive enabled, and store the connection in the app’s session state. This will stop working if the client does not send a query for the idle session timeout. This has as a default time of four hours, but may be set to a different value for the account.
* Create a connection with session keepalive enabled, and store the connection in the app’s session state. This will leak memory, since keepalive starts a background thread to periodically ping Snowflake, and this thread is only shut down when the connection is closed.

See [this tutorial](https://docs.snowflake.com/en/developer-guide/snowpark-container-services/tutorials/advanced/tutorial-6-callers-rights)
for detailed examples and explanation from the Snowpark Container Services side.

### Related issues
* [#8545](https://github.com/streamlit/streamlit/issues/8545), which can be implemented by a simple session-scoped cached resource with a close hook.
* [#10089](https://github.com/streamlit/streamlit/issues/10089), which can be implemented by a simple session-scoped cached resource at the start of the script.
* [#8674](https://github.com/streamlit/streamlit/issues/8674), asking specifically for close hooks on cached resources. This would implement that request.

## Proposal

### API Changes

`st.cache_resource` will have two new parameters. `st.cache_data` will have one of these two parameters, `scope`:

```python
OnRelease: TypeAlias = Callable[[Any], None]

# This is showing the cache_resource example, but cache_data will be identical.

# Actually called _decorator in CacheResourceAPI.
def cache_resource(
    self,
    # Existing args omitted for clarity.
    scope: Literal["global", "session"] = "global",
    on_release: OnRelease | None = None
) -> CachedFunc[P, R] | Callable[[Callable[P, R]], CachedFunc[P, R]]:
    """
    scope : Literal["global", "session"]
        The scope for the resource. If "global", cache globally. If "session", cache in
        the session.

        Session-scoped cache entries will be expired when a user's session ends.
    on_release : OnRelease
        If set, a function to call when a cache entry is removed from the cache. The
        removed item will be provided to the function as an argument.

        This will be called whenever an item is removed from the cache, including via
        `clear` calls.

        This is mostly useful for caches which will expire entries normally: Those with
        ``max_entries`` or ``ttl`` settings, or those using ``scope="session"``.
        Note that expiration does not happen on all reads - so ``ttl`` should not be
        used to guarantee timely cleanup, only cleanup when expired resources are
        accessed.

        This will NOT be called when an app is shut down for global resources.
    """
```

Two new methods will be added to `st.connection.BaseConnection`:

```python
@property
def scope(self) -> Literal["global", "session"]:
    """The scope this connection should be scoped to.

    "global" connections will be created once per app. "session" connections will be
    created once per session.
    """
    return "global"

def close(self) -> None:
    """A function to invoke when this connection is removed from the session cache.

    Registered with the resource cache when created with st.connection.
    """
    # Note that this default implementation is a no-op.
```

These two new methods will be passed to the `cache_resource` call in `st.connection`, using the new parameters.

### Cache expiration implementation

We will add the expiration hook to the entry stored in [ResourceCache._mem_cache](https://github.com/streamlit/streamlit/blob/fb4a389a7338c9d22e4ea514ca2b20c10e086149/lib/streamlit/runtime/caching/cache_resource_api.py#L492-L494). Instead of storing `CachedResult[R]`, it will store `tuple[CachedResult[R], OnRelease]`. We will also replace the `TTLCache` with an extension of `TTLCache` that handles expiration, following [the examples in the cachetools library](https://cachetools.readthedocs.io/en/latest/#extending-cache-classes).

To handle session-scoped items, we will add a new cache to [ResourceCaches](https://github.com/streamlit/streamlit/blob/fb4a389a7338c9d22e4ea514ca2b20c10e086149/lib/streamlit/runtime/caching/cache_resource_api.py#L82) that will have an extra session ID key. When looking up a resource cache, we will provide the current session ID for session-scoped resources, and use that to look up an item in the cache. Similar changes will be made in `DataCaches`.

When sessions are torn down, we will call a new helper in `ResourceCaches` which will handle clearing the cache for a session ID.

### RCR connection implementation

We will add a new `BaseConnection` subclass very similar to the current `SnowflakeConnection` class. This will have `scope` set to `"session"`, and will have a close implementation that handles closing the connection. It will be called `SnowflakeCallersRightsConnection`.

Connections will be initiated by reading the current `st.context.headers` for a connection token, and connections will
error if the token is not found. The other piece of the token will be read from the expected location (from
`connections.toml`, or from the Snowpark Container Services default path). Other connection settings will also use
`connections.toml` based on the provided Snowflake connection name; defaulting to the default connection - consistent
with the Python driver.

Note that the token reading here is different from the `snowflake` connection, which relies on the driver to do all internals. We can’t do that here, as the driver doesn’t natively support these RCR tokens.

`st.connection` will have two new optional parameters read by the `"snowflake"` connection type.

The parameter `use_callers_rights: bool` will toggle between the global `SnowflakeConnection` class and the new `SnowflakeCallersRightsConnection`.

The parameter `callers_rights_token: str` will allow the user to pass in a full (user + base) token to make the RCR connection if users wish to implement something custom. This allows for future caller's rights connections outside of the current Snowpark Container Services model.

### Other notes
All `ttl` and `max_entries` cache expirations happen only on write and `len` checks, not on normal reads. This is how the underlying `TTLCache` works. This will be fine for session-scoped items, since they’ll be expired manually when the session expires, but needs to be called out in the docs as a limitation of the existing cache. This will really only matter for `ttl` when users treat it as a guaranteed close, and not as an invalidation.

This implementation also will have `max_entries` scoped to the session, not scoped globally. This can be documented, and shouldn’t be an issue for connections, since they will not grow beyond the number of active sessions.

## Checklist

- [x] Works on all deployment platforms (e.g. [Streamlit Community Cloud](https://streamlit.io/cloud), [Streamlit in Snowflake](https://www.snowflake.com/en/product/features/streamlit-in-snowflake/), [Hugging Face Spaces](https://huggingface.co/spaces))?
- [x] No breaking API changes?
    - No breaking changes.
- [x] No new dependencies?
    - Yes, no new dependencies.
- [x] Metrics collected?
    - Should be compatible with existing metrics.
- [x] Any security or legal implications?
    - No implications.
- [x] Anything to keep in mind for docs?
    - Nothing special.
- [x] Any other risks?
    - No additional risks.
