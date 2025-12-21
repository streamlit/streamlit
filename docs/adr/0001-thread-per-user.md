# 1. Thread-per-User Concurrency Model

Date: 2025-12-21

## Status

Accepted

## Context

Streamlit aims to allow Data Scientists to write simple, synchronous Python scripts that turn into interactive web apps. The standard web concurrency model (async/await or callbacks) offers higher concurrency but requires a steeper learning curve and rewriting existing synchronous data code (Pandas, Numpy).

## Decision

We utilize a **Thread-per-User** (or Thread-per-Session) concurrency model.

1.  **ScriptRunner**: When a user connects, the server spawns a dedicated thread.
2.  **Execution**: The user's script (`user_app.py`) runs entirely within this thread from top to bottom.
3.  **State**: Local variables are preserved during the execution but reset on "Rerun", unless stored in `st.session_state`.

## Consequences

### Positive
*   **Simplicity**: Users write standard synchronous Python. No `async def`, no `await`.
*   **Compatibility**: Works perfectly with blocking libraries like Pandas, Matplotlib, and Scikit-learn.

### Negative
*   **Memory Overhead**: Each thread consumes a stack; heavy data loaded in one session is not automatically shared (though `st.cache` mitigates this).
*   **Scalability**: The number of concurrent users is limited by the server's CPU threads and RAM. Vertical scaling hit a ceiling faster than async architectures.

## Mitigation
We implement caching (`st.cache_data`, `st.cache_resource`) and resource limits. Future explorations may include sub-interpreter support or partial async capability.
