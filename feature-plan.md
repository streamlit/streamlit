# Summary

Today, dismissing a dialog (by clicking on X, clicking on the background, or pressing Escape) closes the dialog without triggering a rerun. But there are cases where you want to react to this event. Let’s add a parameter `on_dismiss="ignore"|"rerun"|callback` to `st.dialog` to do this.

---

# Problem statement

- **Current behavior:** There are two ways to close a dialog today:
    1. Dismissing it by clicking on X, clicking on the background, or pressing Escape. This does not trigger a rerun, so there’s no way to react to it.
    2. Calling `st.rerun` inside the dialog, e.g. after clicking a button. This triggers a rerun.
- **Problem:** In some cases, you want to react to (1) and need a rerun.
  - Example: In the Core Metrics app, we now have a [Floating action button](https://www.notion.so/Floating-action-button-493264f022f84d0aa15d29d8adbb1405?pvs=21) that opens a dialog with a chat UI. Since the chat history is stored in session state, this dialog will show the previous chat when closing and opening it again, which can be annoying. It would be great to know when the dialog is closed, so we can wipe the chat history.
- **Request:** (69 👍) <https://github.com/streamlit/streamlit/issues/8507> → most upvoted issue for dialog!
- **Related:** I also want to ship [Make st.dialog non-dismissible](https://www.notion.so/Make-st-dialog-non-dismissible-1b67170bb4168079b02df327ec2b7fe3?pvs=21).

## Metrics impact

- `st.dialog` is used in 3.5% of apps. So this will probably be a niche feature, maybe 0.5-1% adoption.
- But I think it unblocks an important advanced use case, so worth doing!

---

# Proposed solution

## API

- Add a parameter `on_dismiss="ignore"|"rerun"|callback` to `st.dialog`, with `"ignore"` as default value.
  - The name rhymes with the `dismissible` parameter I want to add in [Make st.dialog non-dismissible](https://www.notion.so/Make-st-dialog-non-dismissible-1b67170bb4168079b02df327ec2b7fe3?pvs=21).
  - This is similar to the `on_select` parameter we use for chart/dataframe selections, and the `on_click` parameter we have on `st.download_button` to prevent a rerun.
  - We were also thinking about extending this syntax with rerun/ignore to all other `on_` parameters, see [Port new event API to existing input widgets](https://www.notion.so/Port-new-event-API-to-existing-input-widgets-0cb2ed2006b84bc694e81ff1487c66a1?pvs=21).
- Is there any complication because `st.dialog` is a decorator and not a normal function?
- I don’t think we should add a `key` parameter that stores the state of the dialog (open/closed) in session state. When the dialog is dismissed, it will always be closed afterwards, so I don’t really see what retrieving the state would be useful for.
- I don’t think we should add `args`/`kwargs` for the callback function. We also left these out for the `on_select` parameter on dataframes/charts and nobody asked for it so far.

## Behavior

- If `"ignore"` is set, it should have the same behavior as today.
- If `"rerun"` is set, it should trigger a rerun if the dialog is dismissed (by clicking on X, clicking on the background, or pressing Escape).
- If a callback is set, it should also trigger a rerun if the dialog is dismissed, and run the callback function before the rest of the script.

## Checklist

| Item | ✅ or comment |
| --- | --- |
| Works on Cloud, SiS, Notebooks? | ✅ |
| Metrics collected? | ✅ |
| Anything to discuss with security or legal? | ✅ |
| Anything to keep in mind for docs? | ✅ |
| Any other risks? | ✅ |

## Eng estimate

| Eng name | Estimate (weeks) | Comment |
| --- | --- | --- |
| @Benjamin Raethlein  | 2 - 3 | The dialog is not a widget at the moment, meaning that the dialog itself does not have any interaction attached to it. The dialog would need to become a widget, e.g. adding the required calls to `register_widget`, registering any callback, etc.
It would require some prototyping to determine more precisely how involved that would be.

The estimation includes some buffer in case we hit issues with this transformation of dialog into a widget. In case the issues would turn out to be more severe, we would need to revisit this though.

An alternative exploration could be to look into making just the X button itself a widget, basically a special form of element - similar to the `submit_form_button` - which we don’t expose to users but use internally. This could be easier than remodelling the dialog function and could open up further extensions in the future by adding more elements like this.

In general, the `rerun` mode *might* be addable more easily by workarounds, but adding the `callback` functionality would definitely require some form of the aforementioned widget behavior. |
|  |  |  |
