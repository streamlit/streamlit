### Implementation Plan

1.  **Protobuf Definition**:
    *   Modify `proto/streamlit/proto/Toast.proto` to add a `duration` field to the `Toast` message. This will be a `double` to hold the duration in seconds. A value of `0` will signify an indefinite duration.

2.  **Compile Protobuf**:
    *   Run `make protobuf` to generate the necessary Python and TypeScript files from the updated `.proto` file.

3.  **Backend Implementation**:
    *   Update `lib/streamlit/elements/toast.py`.
    *   Add the `duration` parameter to the `st.toast` function signature with a default of `4.0`.
    *   The `duration` parameter will accept `float`, `int`, `timedelta`, or a `str` that can be parsed as a timedelta. I'll use the existing `ttl_to_seconds` utility from `streamlit.runtime.caching.cache_utils` to convert these to seconds.
    *   Update the docstring for `st.toast` to include the new `duration` parameter.

4.  **Backend Tests**:
    *   Update `lib/tests/streamlit/toast_test.py` to include tests for the new `duration` parameter.
    *   Test various valid inputs for `duration` (int, float, timedelta, string).
    *   Test that the default duration is applied correctly.

5.  **Frontend Implementation**:
    *   Modify `frontend/lib/src/components/elements/Toast/Toast.tsx`.
    *   The `Toast` component will receive the `duration` prop from the backend.
    *   Use the `duration` value to set the `autoHideDuration` property when creating a toast with `baseui/toast`'s `toaster`. The value needs to be converted from seconds to milliseconds.

6.  **Frontend Tests**:
    *   Update `frontend/lib/src/components/elements/Toast/Toast.test.tsx`.
    *   Add tests to verify that `autoHideDuration` is correctly passed to the `toaster`. This will likely involve spying on the `toaster.info` method.

7.  **E2E Tests**:
    *   Update `e2e_playwright/st_toast.py` to add examples of toasts with different durations.
    *   Update `e2e_playwright/st_toast_test.py` to test the behavior of toasts with custom durations. This will involve checking that a toast disappears after its specified duration.
