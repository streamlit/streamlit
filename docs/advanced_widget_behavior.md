# Advanced notes on widget behavior

Widgets are magical and often work how you want. But they can have surprising behavior in some situations. Here is a high-level, abstract description of widget behavior, including some common edge-cases:

1. If you call a widget function before the widget state exists, the widget state defaults to a value. This value depends on the widget and its arguments.
2. A widget function call returns the current widget state value. The return value is a simple Python type, and the exact type depends on the widget and its arguments.
3. Widget states depend on a particular session (browser connection). The actions of one user do not affect the widgets of any other user.
4. A widget's identity depends on the arguments passed to the widget function. If those change, the call will create a new widget (with a default value, per 1).
5. If you don't call a widget function in a script run, we neither store the widget state nor render the widget. If you call a widget function with the same arguments later, Streamlit treats it as a new widget.

4 and 5 are the most likely to be surprising and may pose a problem for some application designs. When you want to persist widget state for recreating a widget, use [Session State](session_state_api.md) to work around 5.
