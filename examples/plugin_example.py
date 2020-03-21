import json
from typing import Callable
from typing import Dict
from typing import Optional

from streamlit.DeltaGenerator import _get_widget_ui_value

"""
# Overview:

## Protobuf
- PluginRegistration (Hangs off Element)
- PluginInstance (Hangs off Element)

## Server:
- st.plugin - create a PluginRegistration. Returns a callback
- Ship plugin source to frontend via HTTP
- Pass user args via JSON

## Frontend:
- When client sees a PluginRegistration, check to see if we already
have the plugin. If not, download it from the Server.
    - Downloading plugin = fetch javascript via URLs in PluginRegistration
- When we see a PluginInstance element, ensure the plugin has been downloaded.
- For now: no iframe. The plugin just gets full access.
    - Plugin exposes a single function that takes props and returns a react
    element.
- Version 2: iframe?
    - Instantiate the plugin inside an iframe.
    - Probably need some sort of wrapper that makes iframe <-> app communication
    more seamless (via PostMessage or whatever).
    - https://gist.github.com/pbojinov/8965299 (PostMessage example)
    - Do we incur a lot of overhead for sending large amounts of data,
    e.g. for big dataframes?
    - If we're worried about cross-origin stuff, we need to make sure to serve
    the JS from a "sandboxed" origin

"""


def plugin(name: str, javascript: str) -> Callable[[Dict], Dict]:
    """Register a plugin.

    Returns a function that accepts a dict (the params passed to the
    plugin), and returns a dict (the data sent back from the plugin, if this
    is a widget).

    You may want to wrap this function to provide a nicer API.
    """

    # Build the plugin's registration, if needed. (Need global registration.)
    plugin_registration = PluginRegistration()
    plugin_registration.id = 123  # generate a unique ID
    plugin.urls.Add(js_url)  # Server the JS

    # Create a plugin callback (DeltaGenerator member function).
    def plugin_instance(args: Dict) -> Optional[Dict]:
        dg = get_dg()
        element = dg.create_element()
        element.plugin_instance.plugin_id = plugin_registration.id
        # Convert our args dict to JSON. TODO: error checking!
        element.json = json.dumps(args)
        # Get the widget value (a JSON string), and convert it to a dict
        widget_value = _get_widget_ui_value(
            "Plugin:{}.{}".format(name, plugin_registration.id)
        )
        if widget_value is not None:
            # TODO: error checking!
            widget_value = json.loads(widget_value)
        return widget_value

    return plugin_instance


my_widget = plugin("Widget", "my_widget.js")

# Optional! Create a wrapper that marshalls our args
def my_widget(foo, bar, baz) -> bool:
    # Marshall our arguments into the function's Dict
    result = widget_function({"foo": foo, "bar": bar, "baz": baz})

    # Un-marshall the return value out of the return Dict.
    button_clicked = False
    if result is not None:
        button_clicked = result.get("button_clicked", False)
    return button_clicked


# Export!
__all__ = ["my_widget"]


"""
On the FRONTEND:
- We have a plugin registry on the client. Each item is a mapping of ID -> Plugin entrypoint
- Javascript code should expose a single entry point. (A function?)
-- Maybe we detect whether it's a function or a React element?
- That plugin entrypoint should look like:

interface PluginProps {
    // User args in a JSON dict
    args: any

    // Streamlit column width
    width: number

    // Whether this widget should be disabled (if applicable)
    disabled: bool

    // Callback that sends JSON data back to the script.
    // TODO: how do we handle trigger values?
    sendData(json: any): void

    // Do we need a way to show a generic streamlit error?
    onError(err: any): void

    // Maybe we want this? - Callback that just reruns the script?
    rerunScript(): void

    // TODO: we want debouncing to be easy
    // Maybe we just expose WidgetStateManager entirely?
    // And add a WidgetStateManager.setJSONData?
}

function renderWidget(props: PluginProps): JSX.Element {
    // Parse the args
    return (
        <MyWidget onClicked={props.sendData
    )
}

"""
