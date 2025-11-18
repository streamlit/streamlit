## Starlette Server Performance Ideas

- **Move runtime work off the ASGI loop**
  In `_websocket_endpoint` we synchronously call `runtime.handle_backmsg(...)` for every incoming frame, so any heavy script work blocks the event loop and stalls all websockets. Offload those calls via `asyncio.to_thread` or a dedicated worker queue so the Starlette loop can keep accepting frames while the runtime executes.

- **Introduce backpressure for websocket sends**
  `_StarletteSessionClient` pushes serialized `ForwardMsg`s into an unbounded `asyncio.Queue` with `put_nowait`, which lets the runtime enqueue infinite payloads when a browser is slow. Give the queue a `maxsize` and `await` the `put`, or surface a congestion callback so the runtime can pause script execution before memory spikes.

- **Stream uploads rather than buffering them twice**
  `_upload_put` calls `await request.form()` and then `await upload.read()`, materializing the full multipart body in memory before handing it to `UploadedFileRec`. Switch to `request.stream()` or incremental `UploadFile.read(chunk)` and forward chunks directly into the upload manager (or a temp file) to reduce latency and RAM usage.

- **Stream component/bidi assets**
  Both `_component_endpoint` and `_bidi_component_endpoint` read entire files into `data` and then wrap them in a “streaming” response, which doubles memory for large bundles. Use `FileResponse` or chunked async iterators so files are sent directly from disk without full buffering.

- **Apply similar fixes to the Tornado side**
  The legacy handlers mirror all of the above behaviors (blocking runtime calls, unbounded buffering, full-file reads). Keeping the two stacks aligned avoids regressions when users toggle `server.useStarlette`.
