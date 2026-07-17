---
author: sfc-gh-lwilby-1
created: 2026-05-19
---

# Camera input capture resolution parameter

## Summary

Add a `resolution` parameter to `st.camera_input` that allows developers to request a specific
capture resolution from the user's webcam. This gives apps predictable image dimensions regardless
of browser window size or camera hardware, enabling use cases like QR code scanning, ID
verification, and bandwidth-constrained deployments.

## Problem

**GitHub Issue:** [#4320](https://github.com/streamlit/streamlit/issues/4320)

`st.camera_input` returns images whose dimensions depend on the widget's display size in the
browser. When users resize their browser or view the app on different devices, the captured image
dimensions change unpredictably. This creates problems for apps that require consistent image
dimensions:

### Use Cases

1. **QR code / barcode scanning**: QR decoding libraries often work best with specific resolutions.
   Low resolution images may fail to decode, while unnecessarily high resolution wastes bandwidth
   and processing time.

2. **ID verification / document capture**: Apps capturing ID cards or documents need sufficient
   resolution to read text, but also need consistent dimensions for downstream processing pipelines.

3. **Machine learning inference**: ML models expect fixed input dimensions. Variable capture
   resolution requires additional preprocessing and can degrade model accuracy.

4. **Bandwidth-constrained environments**: Kiosk apps or mobile deployments on limited networks
   need to control image size to manage upload times and data costs.

### Current Behavior

```python
import streamlit as st
from PIL import Image
import numpy as np

picture = st.camera_input("Take a picture")
if picture:
    img = Image.open(picture)
    st.write(f"Captured dimensions: {img.size}")  # Varies with browser size!
```

Captured dimensions depend on:
- Browser window width
- Widget `width` parameter (defaults to `"stretch"`)
- Camera hardware capabilities
- Device pixel ratio

There is no way to request a specific capture resolution.

## Proposal

### Recommended API

Add a `resolution` parameter that accepts a `Literal` preset:

```python
def camera_input(
    label: str,
    # ... existing parameters ...
    *,
    resolution: Literal["480p", "720p", "1080p"] | None = None,
) -> UploadedFile | None:
```

### Parameter Specification

| Value | Description | Behavior |
|-------|-------------|----------|
| `None` (default) | No resolution preference | Camera captures at display-determined resolution |
| `"480p"` | 480 pixel height | Camera targets 480p; width determined by native aspect ratio |
| `"720p"` | 720 pixel height | Camera targets 720p; width determined by native aspect ratio |
| `"1080p"` | 1080 pixel height | Camera targets 1080p; width determined by native aspect ratio |

### Parameter Name Alternatives Considered

| Name | Verdict | Rationale |
|------|---------|-----------|
| `resolution` | **Recommended** | Matches universal video terminology ("720p resolution"); works naturally with presets |
| `size` | Not recommended | Implies both dimensions (PIL's `size` is a tuple); confusing for single-dimension API |
| `height` | Not recommended | Too technical; reads awkwardly with presets (`height="720p"`) |

### Why Single-Dimension (Height) Only

Camera hardware has fixed aspect ratios (typically 4:3 or 16:9). When a user specifies both width
and height with a different aspect ratio, the browser must either:

- **Crop**: Lose parts of the image silently
- **Letterbox**: Add black bars, wasting bandwidth
- **Distort**: Stretch the image, causing visual artifacts
- **Reject**: Fail with an `OverconstrainedError`

None of these options provide a good user experience. By accepting only a target height, we:

1. Let the camera's native aspect ratio determine the width
2. Avoid confusing aspect ratio mismatches
3. Provide a simpler API that's easier to understand
4. Match how resolution presets work universally (720p, 1080p, etc. only specify height)

### Why Height Is the Standard

Video resolution names (480p, 720p, 1080p, 4K) are **universally defined by height**, not width:

- **720p** = 720 pixels tall (the "p" stands for "progressive scan")
- **1080p** = 1080 pixels tall
- **4K/2160p** = 2160 pixels tall

This convention dates back to analog TV standards, which were defined by horizontal scan lines
(rows = height). Using height-based presets aligns with this universal industry standard.

### Examples

**Basic usage — request 720p resolution:**

```python
import streamlit as st

picture = st.camera_input("Scan QR code", resolution="720p")
if picture:
    from PIL import Image
    img = Image.open(picture)
    st.write(f"Captured: {img.size}")
    # Width varies by camera aspect ratio:
    # - 16:9 camera → (1280, 720)
    # - 4:3 camera  → (960, 720)
```

**High resolution for document capture:**

```python
import streamlit as st

picture = st.camera_input("Scan ID card", resolution="1080p")
```

**Lower resolution for bandwidth-constrained environments:**

```python
import streamlit as st

picture = st.camera_input("Take photo", resolution="480p")
```

### Behavior Specification

#### Browser Constraint Type: `ideal` (Not `exact`)

The frontend maps preset strings to integer pixel values before calling `getUserMedia`:

| Preset | Height (pixels) |
|--------|-----------------|
| `"480p"` | 480 |
| `"720p"` | 720 |
| `"1080p"` | 1080 |

The implementation uses `getUserMedia({ video: { height: { ideal: <pixels> } } })` with `ideal`
rather than `exact` constraints. This is critical because:

- Cameras support discrete resolution sets (e.g., 480, 720, 1080), not arbitrary values
- Using `exact` would throw `OverconstrainedError` for unsupported resolutions
- Using `ideal` allows the browser to select the closest supported resolution

#### Actual vs Requested Resolution

The browser may return a resolution different from what was requested. This happens when:

- The camera doesn't support the exact requested resolution
- Browser/OS privacy settings limit resolution
- Hardware constraints prevent the requested resolution

**Design decision:** The returned image uses whatever resolution the camera actually provided. We do
**not** perform server-side resizing to match the requested resolution because:

1. Users asked for the resolution primarily to get higher quality capture, not exact dimensions
2. Server-side resizing adds latency and server load
3. If users need exact dimensions, PIL resizing is trivial:
   ```python
   img = Image.open(picture).resize((target_width, target_height))
   ```

#### Error Handling

| Scenario | Behavior |
|----------|----------|
| Camera returns different resolution | Image returned at actual captured resolution (no error) |
| Camera cannot start at any resolution | Standard camera permission/access error (unchanged) |
| Invalid `resolution` value (not a valid preset) | `StreamlitAPIException` at call time |

### Presets Rationale

Using only presets (`"480p"`, `"720p"`, `"1080p"`) rather than arbitrary integers provides:

- **Discoverability**: Users see all valid options in IDE autocomplete
- **Best practice guidance**: Users learn what resolutions are typically supported by cameras
- **Readability**: `resolution="720p"` is clearer and more familiar than `resolution=720`
- **Simplicity**: No guessing about which arbitrary values will work with camera hardware
- **Extensibility**: We can add more presets later (e.g., `"360p"`, `"4k"`) based on user demand

We intentionally omit `"4k"` / `"2160p"` from the initial release because:
- Most webcams don't support 4K
- 4K images are large (~8MB+) and slow to upload
- Bandwidth impact is significant for Streamlit's typical use cases

If users need arbitrary resolution control, they can resize the captured image with PIL after
capture—this is a simple one-liner and provides exact dimension guarantees.

## Alternatives Considered

### Option A: Tuple of (width, height) — NOT RECOMMENDED

This is the approach taken by [PR #15109](https://github.com/streamlit/streamlit/pull/15109):

```python
st.camera_input("Label", size=(1920, 1080))
```

**Pros:**
- Explicit control over both dimensions
- Familiar pattern from image libraries

**Cons:**
- Aspect ratio mismatch is confusing: if the camera is 4:3 but user requests 16:9, what happens?
- Users must know their camera's aspect ratio to use correctly
- Browser's `getUserMedia` doesn't guarantee exact dimensions anyway
- More complex API for no real benefit

### Option B: Separate `width` and `height` parameters — NOT RECOMMENDED

```python
st.camera_input("Label", capture_width=1920, capture_height=1080)
```

**Pros:**
- Maximum flexibility

**Cons:**
- Same aspect ratio problems as Option A
- Two parameters when one suffices
- Unclear what happens if only one is specified

### Option C: Server-side resizing (PIL) — NOT RECOMMENDED

This is the approach taken by [PR #15186](https://github.com/streamlit/streamlit/pull/15186):

```python
# Under the hood: capture at any resolution, resize on server
st.camera_input("Label", size=(640, 480))
```

**Pros:**
- Guarantees exact output dimensions
- Works regardless of camera capabilities

**Cons:**
- Adds PIL as a dependency or requires it to be installed
- Increases server-side processing
- Adds latency to every capture
- Doesn't actually capture at higher resolution — just crops/scales what was captured
- If the camera captured at 320x240, resizing to 1080p doesn't add detail

### Option D: `resolution` with presets only (RECOMMENDED)

```python
st.camera_input("Label", resolution="720p")
```

This is the recommended approach, as detailed in the Proposal section.

### Option E: `resolution` accepting both int and presets — NOT RECOMMENDED

```python
st.camera_input("Label", resolution=720)  # int
st.camera_input("Label", resolution="720p")  # preset
```

**Pros:**
- Maximum flexibility for edge cases (e.g., 540p, 360p)

**Cons:**
- Users may guess arbitrary values that don't match camera capabilities
- Browsers pick the closest supported resolution anyway—arbitrary ints often won't match exactly
- More complex API and documentation
- Violates "Start Minimal" principle—can add int support later if demand exists

## Prior Art

### Community PRs

Two community PRs have attempted to implement this feature:

1. **[PR #15109](https://github.com/streamlit/streamlit/pull/15109)** by @quick123-666: Adds
   `size: tuple[int, int]` parameter that passes width/height to `getUserMedia` constraints. Uses
   `ideal` constraints to avoid `OverconstrainedError`.

2. **[PR #15186](https://github.com/streamlit/streamlit/pull/15186)** by @amanhammadK: Adds
   `size: tuple[int, int]` parameter with server-side PIL resizing to guarantee exact dimensions.

Both PRs use the tuple approach, which raises the aspect ratio concerns addressed in this spec.

### HTML getUserMedia API

The [MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
API supports `width` and `height` constraints with `min`, `max`, `ideal`, and `exact` modifiers.
Our implementation uses height-only constraints to let the camera's native aspect ratio determine
width:

```javascript
// Our approach: height-only constraint
navigator.mediaDevices.getUserMedia({
  video: {
    height: { ideal: 720 }
  }
})
```

Key behaviors:
- `exact` throws `OverconstrainedError` if the value isn't supported
- `ideal` selects the closest supported value
- Setting only `height` lets the browser choose width based on camera aspect ratio
- Cameras report supported resolutions via `getCapabilities()`

### React Webcam Libraries

- **react-webcam**: Accepts `videoConstraints` object passed directly to `getUserMedia`
- **@aspect-ratio/webcam**: Focuses on aspect ratio preservation, not resolution control

### Mobile SDKs

- **iOS AVFoundation**: Uses session presets like `AVCaptureSessionPreset720p`
- **Android CameraX**: Uses `ResolutionSelector` with preferred resolution hints

The preset approach in mobile SDKs influenced our recommendation to use presets.

## Out of Scope (Future Work)

- **Arbitrary integer resolution values**: Could extend type to `int | Literal[...]` later if users
  need resolutions not covered by presets (e.g., 540p, 360p)
- **Additional presets** (`"360p"`, `"4k"`): Can add based on user demand
- **Exposing actual captured resolution**: Could add a way to check what resolution was actually
  used, but can be added later based on user demand
- **Front/back camera selection**: Separate feature request; `facingMode` constraint exists but
  isn't exposed yet
- **Video capture / streaming**: This spec focuses on single-frame capture only
- **Aspect ratio parameter**: If users request aspect ratio control, we could add
  `aspect_ratio: Literal["4:3", "16:9", "auto"]` later

## Checklist

| Item                         | ✅ or comment                                               |
|------------------------------|-------------------------------------------------------------|
| Works on SiS, Cloud, etc?    | ✅ Uses standard browser `getUserMedia` API                 |
| No breaking API changes      | ✅ New optional parameter only                              |
| No new dependencies          | ✅ Browser-native resolution constraints                    |
| Metrics collected            | ✅ Track: (1) preset values used, (2) resolution mismatch frequency |
| Any security/legal impact?   | ✅ No — uses existing camera permissions                    |
| Any docs changes needed?     | ✅ Update st.camera_input docstring and API reference       |
