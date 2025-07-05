### Summary

This proposal aims to enhance `st.toast` by introducing a `duration` parameter, allowing developers to control how long the toast message is displayed. Currently, `st.toast` messages automatically disappear after a fixed time. The proposed feature will enable setting a specific display time in seconds (float or int) or a timedelta object or a string.

### Problem Statement

The current `st.toast` command provides brief, ephemeral notifications that vanish after a fixed four seconds. This automatic dismissal, while suitable for quick alerts, creates limitations in several user experience scenarios:

- **Insufficient Reading Time**: Important or longer messages may disappear before users can fully read and understand their content.
- **Lack of Persistent Feedback**: For critical operations, ongoing status updates, or instructional messages, developers lack the ability to make a toast message persist until acknowledged by the user or a state change occurs.
- **Limited Customization**: The absence of a configurable duration parameter prevents developers from fine-tuning the notification behavior to align with the context and urgency of the message.

The need for this functionality is evidenced by existing community feedback, specifically GitHub Issue 7047, which is a feature request for an `st.toast` timer and has garnered 41 reactions.

### Proposed Solution

### API

A new optional parameter `duration` will be added to the `st.toast` function signature:

`st.toast(body, *, icon=None, duration=4.0)`

- **`duration`**: `float`, `int`, `timedelta`, or `str`
  - A number specifying the time in seconds.
  - A string specifying the time in a format supported by Pandas's Timedelta constructor, e.g. "1d", "1.5 days", or "1h23s".
  - A timedelta object from Python's built-in datetime library, e.g. timedelta(days=1).
  - **Default Value**: The default value for `duration` will be `4.0` seconds, ensuring backward compatibility with the existing `st.toast` behavior.
  - This should be handleded similar to how `ttl` is handled in `st.cache_data` (e.g. timedelta / string)

### Behavior

- **Timed Dismissal**: If `duration` is set to a numerical value, the toast will automatically disappear after the specified time.
- **Interaction with `icon`**: The `icon` parameter will continue to function as currently described in the documentation, accepting an emoji or icon string.
- **Caching Compatibility**: `st.toast` will remain incompatible with Streamlit's caching mechanisms and cannot be called within a cached function.
- **Stacking Order**: The toast message should always appear on top of other Streamlit elements, including `st.dialog`, ensuring its visibility and prominence (this addresses the problem described in Issue 10383).

### Design

- The overall visual appearance, positioning (top-right corner of the app), and existing styling of `st.toast` will be maintained to ensure consistency with the current Streamlit user interface.
