# Asyncio Support Plan for Streamlit

## 1. Introduction

This document outlines a plan to properly support `asyncio` and asynchronous Python in Streamlit. Currently, Streamlit runs user scripts synchronously in a dedicated thread. While this model is simple and effective for many data science tasks, it limits the ability to use modern async-first libraries (e.g., LangChain, Playwright, httpx) and efficient I/O-bound concurrency.

## 2. Motivation & Use Cases

### 2.1 High-Performance I/O
Data apps often fetch data from multiple sources (APIs, databases).
*   **Current:** Sequential fetching with `requests` blocks the script execution for the sum of all latencies. Parallelism requires `threading` or `multiprocessing` pools, which are verbose.
*   **Async:** `await asyncio.gather(*tasks)` allows concurrent fetching with minimal overhead and cleaner syntax using `httpx` or `aiohttp`.

### 2.2 Integration with Async Libraries
Many modern Python libraries are designing their primary APIs around `async/await`.
*   **AI/LLM:** LangChain, LlamaIndex, and OpenAI SDKs often have async methods for streaming and concurrent generation.
*   **Web/Scraping:** Playwright and simple web scrapers via `httpx`.
*   **Real-time:** WebSocket clients or long-polling mechanisms.

### 2.3 Top-Level Await
Jupyter notebooks support top-level `await`. Streamlit users often prototype in notebooks and copy code to Streamlit. The lack of top-level `await` support breaks this workflow and forces users to wrap code in `asyncio.run(main())`.

## 3. Current State Analysis

*   **Runtime:** The Streamlit `Runtime` runs on the main thread using `Tornado` (async).
*   **Script Execution:** `ScriptRunner` runs the user script in a separate thread (`ScriptRunner.scriptThread`) using Python's synchronous `exec()`.
*   **Event Loop:** The script thread does **not** have an active asyncio event loop by default.
*   **Callbacks:** Widget callbacks (`on_click`, `on_change`) are executed synchronously.
*   **Caching:** `st.cache_data` and `st.cache_resource` explicitly block caching of async functions.
*   **Fragments:** `st.fragment` wraps functions and executes them synchronously.

## 4. Proposed Changes

To fully support async, we need to handle async code at the entry point, in callbacks, and in decorators.

### 4.1 Script Runner & Top-Level Await

**Goal:** Allow users to use `await` at the top level of their script and define `async def` functions that can be called directly.

**Implementation Plan:**
1.  **AST Parsing:** Before execution, parse the user script using `ast.parse` to detect if it contains top-level `await` or is an async source.
2.  **Event Loop Management:**
    *   In `ScriptRunner._run_script`, ensure a new `asyncio` event loop is created and set for the script thread.
    *   Use `asyncio.run()` or `loop.run_until_complete()` to drive the execution.
3.  **Async Execution:**
    *   Replace `exec(code)` with a mechanism that supports top-level await.
    *   For Python 3.8+, `compile(code, ..., flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)` allows compiling code with top-level await.
    *   The resulting code object, when executed with `eval`, returns a coroutine.
    *   The `ScriptRunner` must `await` this coroutine.

### 4.2 Async Widget Callbacks

**Goal:** Allow passing `async def` functions to `on_click` and `on_change`.

**Implementation Plan:**
1.  **Detection:** Update `SessionState._execute_widget_callback` to check `inspect.iscoroutinefunction(callback_fn)`.
2.  **Execution:**
    *   If async, `await callback_fn(*args, **kwargs)`.
    *   Since `SessionState.on_script_will_rerun` (which calls callbacks) is called from `ScriptRunner`, it needs to be updated to be async-aware (or run the callback in the loop).

### 4.3 Async Caching (`st.cache_data` / `st.cache_resource`)

**Goal:** Allow decorating `async def` functions.

**Implementation Plan:**
1.  **Decorator Update:** Update `CacheDataAPI` and `CacheResourceAPI` to check if the decorated function is async.
2.  **Wrapper:**
    *   If async, return an `async def wrapper(...)`.
    *   Inside the wrapper, await the original function.
    *   The hashing logic remains mostly the same (hashing arguments).
    *   The result storage (pickling) remains the same.
3.  **Replay:** Cached message replay must be compatible (likely safe as it just enqueues messages).

### 4.4 Async Fragments (`st.fragment`)

**Goal:** Allow `st.fragment` to wrap async functions.

**Implementation Plan:**
1.  **Wrapper:** Update `_fragment` to return an `async def` wrapper if the input is async.
2.  **Execution:** When `st.fragment` is run, if the wrapped function is async, the caller (ScriptRunner) must await it.

## 5. Implementation Steps & Roadmap

### Phase 1: Foundation (Script Runner)
*   [ ] Add `asyncio` loop creation to `ScriptRunner` thread.
*   [ ] Update `ScriptRunner` to use `ast.PyCF_ALLOW_TOP_LEVEL_AWAIT` and `eval` instead of `exec` when appropriate.
*   [ ] Handle `await` in the main script body.
*   [ ] Ensure `st.write`, `st.dataframe` etc. work within async contexts (they generally should as they are sync side-effects).

### Phase 2: Async Features (Callbacks & Caching)
*   [ ] Update `SessionState` to await async callbacks.
*   [ ] Update `st.cache_data` and `st.cache_resource` to support async functions.
*   [ ] Update `st.fragment` to support async functions.

### Phase 3: Advanced & Testing
*   [ ] Add async support to `st.connection`.
*   [ ] Comprehensive testing with `pytest-asyncio`.
*   [ ] Documentation and examples.

## 6. Potential Challenges

*   **Thread Safety:** While `asyncio` is single-threaded concurrency, mixing it with Streamlit's existing threading model (Runtime vs ScriptRunner) requires care. We must ensure `ScriptRunContext` is correctly propagated in async tasks (`contextvars` should handle this naturally in Python 3.7+).
*   **Blocking Calls:** Users might inadvertently call blocking code in an async script, freezing the script loop. This is a general async pitfall but worth documenting.
*   **Error Handling:** Stack traces for async code can be messier. We need to ensure Streamlit's pretty error pages still work correctly for `Uncaught App Exception` in async contexts.

## 7. Conclusion

Support for `asyncio` is a high-value feature that aligns Streamlit with the modern Python ecosystem. The implementation is feasible by evolving the `ScriptRunner` to be event-loop aware and updating key decorators to handle coroutines.
