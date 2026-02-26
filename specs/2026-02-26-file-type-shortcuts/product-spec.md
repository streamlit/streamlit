---
author: lukasmasuch
created: 2026-02-26
---

# File Type Shortcuts and MIME Type Support

## Summary

Extend the `type` parameter in `st.file_uploader` and `file_type` in `st.chat_input` to
accept category shortcuts (`"image"`, `"audio"`, `"video"`, `"text"`), full MIME types
(`"image/jpeg"`, `"application/pdf"`), and MIME type wildcards (`"image/*"`, `"audio/*"`).
This aligns with the HTML `<input accept>` attribute while providing convenient shortcuts
for common use cases.

## Problem

### User Pain Points

Users frequently want to accept "any image" or "any audio file" without listing every
possible extension:

```python
# Current: tedious and incomplete
st.file_uploader("Upload image", type=["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "ico", "tiff"])

# Desired: simple and complete
st.file_uploader("Upload image", type="image")
```

**Prior work:**

- [#10068](https://github.com/streamlit/streamlit/pull/10068) — WIP prototype for file type
  shortcuts (never merged)

**Competitor reference:**

[Gradio's File component](https://www.gradio.app/docs/gradio/file) supports
`file_types=["image"]` which expands to accept all image formats. This is an ergonomic
pattern users expect.

### Current Implementation Limitations

1. **Extension-only**: `type` only accepts file extensions (`.jpg`, `pdf`)
2. **No MIME types**: Can't use standard MIME types (`image/jpeg`, `application/pdf`)
3. **No wildcards**: Can't use `image/*` to accept all images
4. **Incomplete coverage**: Hard to list every extension for a category (e.g., all image
   formats including `.heic`, `.avif`, `.jxl`, etc.)

## Proposal

### Supported File Type Specifiers

Support all three formats that the HTML `<input accept>` attribute accepts:

| Format | Example | Description |
|--------|---------|-------------|
| Extension | `".jpg"`, `"pdf"` | File extension (leading dot optional) |
| MIME type | `"image/jpeg"`, `"application/pdf"` | Exact MIME type |
| MIME wildcard | `"image/*"`, `"audio/*"` | Category wildcard |

Plus **category shortcuts** that map to wildcards:

| Shortcut | Expands to | Description |
|----------|------------|-------------|
| `"image"` | `"image/*"` | All image formats |
| `"audio"` | `"audio/*"` | All audio formats |
| `"video"` | `"video/*"` | All video formats |
| `"text"` | `"text/*"` | All text formats (`.txt`, `.csv`, `.md`, etc.) |

### Detection Logic

A string is classified as:

1. **Category shortcut**: If it exactly matches `"image"`, `"audio"`, `"video"`, or `"text"`
2. **MIME type/wildcard**: If it contains a `/` character (e.g., `"image/jpeg"`, `"image/*"`)
3. **File extension**: Everything else (with or without leading dot)

```python
def classify_file_type(value: str) -> Literal["shortcut", "mime", "extension"]:
    if value in ("image", "audio", "video", "text"):
        return "shortcut"
    if "/" in value:
        return "mime"
    return "extension"
```

### API

No new parameters. The existing `type` parameter accepts the new formats:

```python
# st.file_uploader
st.file_uploader(
    label: str,
    type: str | Sequence[str] | None = None,  # Now accepts shortcuts, MIME types, wildcards
    ...
)

# st.chat_input
st.chat_input(
    ...,
    file_type: str | Sequence[str] | None = None,  # Now accepts shortcuts, MIME types, wildcards
)
```

### Type Signature

```python
FileType = str  # Extension, MIME type, wildcard, or shortcut
FileTypes = FileType | Sequence[FileType] | None
```

The type annotation remains `str | Sequence[str] | None` for backwards compatibility.
Documentation will explain the accepted formats.

### Examples

**Basic shortcuts:**

```python
# Accept any image
st.file_uploader("Upload image", type="image")

# Accept any audio
st.file_uploader("Upload audio", type="audio")

# Accept any video
st.file_uploader("Upload video", type="video")

# Accept any text file
st.file_uploader("Upload text", type="text")
```

**MIME types:**

```python
# Specific MIME type
st.file_uploader("Upload JPEG", type="image/jpeg")

# Multiple MIME types
st.file_uploader("Upload document", type=["application/pdf", "application/msword"])
```

**MIME wildcards:**

```python
# All images (equivalent to type="image")
st.file_uploader("Upload image", type="image/*")

# All audio (equivalent to type="audio")
st.file_uploader("Upload audio", type="audio/*")
```

**Mixed combinations:**

```python
# Images plus JSON files
st.file_uploader("Upload", type=["image", ".json"])

# Video plus specific document types
st.file_uploader("Upload media", type=["video", "application/pdf", ".docx"])

# Multiple categories
st.file_uploader("Upload media", type=["image", "audio", "video"])
```

**Chat input:**

```python
# Accept images in chat
st.chat_input("Message", accept_file=True, file_type="image")

# Accept audio/video in chat
st.chat_input("Message", accept_file=True, file_type=["audio", "video"])
```

### Behavior

**Frontend (file picker filtering):**

- Shortcuts and wildcards are passed directly to the HTML `accept` attribute
- `"image"` → `accept="image/*"`
- `"image/jpeg"` → `accept="image/jpeg"`
- Extensions continue to work: `".jpg"` → `accept=".jpg"`
- Mixed lists are comma-joined: `["image", ".json"]` → `accept="image/*,.json"`

**UI display:**

- When shortcuts/wildcards are used, display the category name instead of extensions:
  - `type="image"` → "Drag and drop image files here"
  - `type=["image", "video"]` → "Drag and drop image or video files here"
  - `type="image/jpeg"` → "Drag and drop image/jpeg files here" (or `.jpg, .jpeg`)
- Mixed lists show both: `type=["image", ".json"]` → "Drag and drop image or .json files here"

**Backend validation:**

- When file extensions are specified (`.jpg`, `.pdf`), validate on backend as today
- When MIME types or shortcuts are used (`"image"`, `"image/*"`, `"image/jpeg"`), skip
  backend validation and trust the browser's `accept` attribute filtering

This approach is simpler, automatically supports new formats, and avoids maintaining
incomplete extension mappings. The browser's file picker already filters by MIME type,
providing sufficient user-facing validation for most use cases.

Note: Users who need strict server-side validation for security-sensitive uploads should
use explicit file extensions rather than MIME types/shortcuts.

### Validation Rules

```python
# Valid inputs:
st.file_uploader("...", type="image")                    # Shortcut
st.file_uploader("...", type="image/*")                  # MIME wildcard
st.file_uploader("...", type="image/jpeg")               # MIME type
st.file_uploader("...", type=".jpg")                     # Extension with dot
st.file_uploader("...", type="jpg")                      # Extension without dot
st.file_uploader("...", type=["image", ".json"])         # Mixed
st.file_uploader("...", type=None)                       # Accept all (existing)
st.file_uploader("...", type="application/x-custom")     # Unknown MIME type (passed through)

# Invalid inputs (raise StreamlitAPIException):
st.file_uploader("...", type="unknown")                  # Not a shortcut, MIME type, or extension
```

**Unknown MIME types:**

Unknown MIME types (e.g., `"application/x-custom"`) are passed through to the browser's
`accept` attribute. Backend validation is skipped, allowing users to accept custom formats.

### Protobuf Changes

The existing `repeated string type` field in `FileUploader.proto` and `repeated string file_type`
in `ChatInput.proto` can carry shortcuts, MIME types, and extensions. No schema changes needed.

The frontend will need to handle the new formats when constructing the `accept` attribute.

### Implementation Notes

**Backend changes (`file_uploader_utils.py`):**

1. Update `normalize_upload_file_type()` to:
   - Detect shortcuts/MIME types/extensions
   - Lowercase all values
   - Expand shortcuts to `*/*` format (e.g., `"image"` → `"image/*"`)
   - Pass MIME types through unchanged
   - Continue normalizing extensions (add dot, apply aliases)

2. Update `enforce_filename_restriction()` to:
   - Only validate files when explicit extensions are in the allowed list
   - Skip validation when only MIME types/shortcuts are specified

**Frontend changes:**

1. Update `getAccept()` in `FileUploader/utils.ts` to:
   - Pass MIME types and wildcards directly to `accept`
   - Remove the `"application/streamlit"` placeholder hack

2. Update `isFileTypeAllowed()` in `ChatInput/fileUploadUtils.ts` to:
   - Handle MIME type matching in frontend validation

3. Update UI text generation to show category names instead of extensions when appropriate

### Edge Cases

- **Empty string:** Treated as "accept all" (same as `None`)
- **Whitespace:** Trimmed before processing
- **Case normalization:** All types are lowercased (`"IMAGE"` → `"image"`, `"Image/JPEG"` →
  `"image/jpeg"`, `".JPG"` → `".jpg"`). MIME types are case-insensitive per RFC 2045, and
  file extensions should match case-insensitively.
- **Duplicate types:** De-duplicated (e.g., `["image", "image/*"]` → `"image/*"`)
- **Overlapping types:** Both applied (e.g., `["image", ".png"]` — `.png` is redundant but harmless)

## Out of Scope (Future Work)

### Mobile Capture (`capture` attribute)

The HTML `capture` attribute enables direct camera/microphone access on mobile:

```html
<input type="file" accept="image/*" capture="user">    <!-- Front camera -->
<input type="file" accept="image/*" capture="environment"> <!-- Rear camera -->
```

**Why out of scope:**

1. **Limited browser support:** Not available on desktop browsers
2. **Different UX paradigm:** Capture replaces file picker entirely on mobile
3. **Streamlit already has `st.camera_input`:** For camera use cases
4. **Complex interaction model:** How does capture interact with drag-and-drop?

**Potential future API:**

```python
# Possible future parameter
st.file_uploader("Take photo", type="image", capture="environment")
```

This deserves its own spec if there's user demand. Currently, users wanting camera input
should use `st.camera_input`.

### MIME Type Sniffing

Validating actual file content (magic bytes) rather than just extension. This would provide
stronger security but adds complexity:

- Performance overhead for large files
- Requires file content access before returning to user
- Many file types have ambiguous signatures

**Recommendation:** Extension-based validation is sufficient for most use cases. Users
requiring content validation can implement it in their app code.

### Custom MIME Type Registration

Allowing users to define custom extension mappings:

```python
# Hypothetical future API
st.register_file_type("application/x-custom", [".custom", ".cst"])
```

This could be added later if there's demand for custom formats.

## Checklist

| Item                       | ✅ or comment                                                |
| -------------------------- | ------------------------------------------------------------ |
| Works on SiS, Cloud, etc?  | ✅ Uses standard HTML `accept` attribute                     |
| No breaking API changes    | ✅ Additive; existing extension strings continue to work     |
| No new dependencies        | ✅                                                           |
| Metrics collected          | ✅ Existing file_uploader metrics apply                      |
| Any security/legal impact? | ✅ Maintains server-side validation for known types          |
| Any docs changes needed?   | ✅ Document new type formats with examples                   |
