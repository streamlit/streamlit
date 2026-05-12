---
applyTo: "**/*.proto"
---

<!-- Generated from proto/streamlit/proto/AGENTS.md. Edit that file instead, then run: uv run python scripts/generate_agent_rules.py -->

# Protobuf

Protobuf messages are used for communication between the Streamlit backend and frontend via WebSocket connections.

## Compile Protobuf

Changes requiring compilation:

- Adding, modifying, or removing fields

Changes not requiring compilation:

- Comments

Run this command to recompile the protobufs:

```bash
make protobuf
```

## Important Files

- `ForwardMsg.proto`: Root message used to send information from the server to the frontend/browser.
- `BackMsg.proto`: Root message sent from the browser to the server, e.g. script rerun requests.
- `NewSession.proto`: First message that is sent to the browser on every rerun.
- `Block.proto`: Contains all block types. A block is a layout container for elements (e.g. columns, tabs, popovers, etc.).
- `Element.proto`: Contains all element types. An element is a UI component.
