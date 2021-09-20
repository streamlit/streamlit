# Advanced Notes on Widget Behavior

Widgets are magical, and often just work how you want. But they can have surprising behavior in some situations, so here is a high level, abstract description of how you can expect widgets to behave, including some common edge cases:

1. When a widget function is called when the widget state doesn't already exist, the widget state defaults to a value that depends on the widget and arguments.
2. The widget function call returns the current widget state value. The return value is a simple Python type, and the exact type depends on the widget and arguments.
3. Widget states are tied to a particular session (browser connection). What one user does has no effect on the widgets of any other user.
4. A widget's identity is tied to the arguments passed to the widget function. If those change, the call will create a new widget (which will have a default value, per 1).
5. If a widget function is not called in a run of the script, that widget will not be rendered, and the widget's state will not be stored. If the widget function is called with the same arguments again later, it is treated as a new widget.

4 and 5 are the most likely to be surprising, and may be a problem for some application designs. Session State can be used to preserve values for recreating a widget to work around 5 when you want to persist widget state.
