# Protobuf

Protobuf messages are used for communication between the Streamlit backend and frontend via WebSocket connections.

## Protobuf Compatibility

Always keep Streamlit's protobuf messages backwards compatible. New versions of the protobuf messages must work with
old versions of Streamlit. Thereby, we can assume that the backend and frontend version are the same. All changes
that would not work with an older Streamlit version are incompatible and should be avoided as much as possible.

Typical incompatible changes are:

- Removing a field → instead add a `// DEPRECATED` comment and mark it as `[deprecated=true]`
- Renaming a field → instead deprecate it and introduce a new field with a *new* number
- Changing the number of a field -> all field numbers must be kept as is.
- Adding or removing the `optional` keyword -> deprecate field and add a new one.
- Changing the type of a field in an incompatible way → see the @Protobuf docs for message types for more details.

## Compile Protobuf

If you ever modify the protobufs, you'll need to run the command below (from the repo root) to compile the
protos into libraries that can be used in Python and JS:

```bash
make protobuf
```

## Important Files

- `ForwardMsg.proto`: Root message used to send information from the server to the frontend/browser.
- `BackMsg.proto`: Root message sent from the browser to the server, e.g. script rerun requests.
- `NewSession.proto`: First message that is sent to the browser on every rerun.
- `Block.proto`: Contains all block types. A block is a layout container for elements (e.g. columns, tabs, popovers, etc.).
- `Element.proto`: Contains all element types. An element is a UI component.
