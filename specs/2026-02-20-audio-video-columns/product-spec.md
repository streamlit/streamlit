---
author: lukasmasuch
created: 2026-02-20
---

# AudioColumn and VideoColumn for DataFrames

## Summary

Add `AudioColumn` and `VideoColumn` to `st.column_config` for displaying audio and video content in `st.dataframe` and `st.data_editor`. These are read-only column types, similar to `ImageColumn`, that display a media icon in the cell and show the full audio/video player in a cell overlay when selected.

## Problem

Users working with media datasets (podcasts, music libraries, video clips, ML training data) need a way to preview audio and video content directly within dataframes. Currently, displaying media requires workarounds like rendering custom HTML or creating separate players outside the table.

**Use cases:**

- Browsing a dataset of audio samples (e.g., ML training data, music libraries, podcasts)
- Reviewing video clips in a media management dashboard
- Previewing recordings in a transcription or annotation workflow
- Displaying user-uploaded media content in internal tools

**Requests:**

- [#7719](https://github.com/streamlit/streamlit/issues/7719) - Support for audio/video columns in dataframes (feature request)

**Current workarounds:**

- Embedding HTML via `st.markdown` with `unsafe_allow_html=True` (security concerns)
- Creating separate `st.audio`/`st.video` widgets outside the table (loses context)
- Using external links to media files (poor UX)

## Proposal

### API

```python
st.column_config.AudioColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    pinned: bool | None = None,
)

st.column_config.VideoColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    pinned: bool | None = None,
)
```

### Parameters

| Parameter | Type                                  | Default | Description                                                     |
| --------- | ------------------------------------- | ------- | --------------------------------------------------------------- |
| `label`   | `str \| None`                         | `None`  | The label shown at the top of the column. Defaults to col name. |
| `width`   | `"small" \| "medium" \| "large" \| int \| None` | `None`  | The display width of the column.                                |
| `help`    | `str \| None`                         | `None`  | Tooltip shown when hovering over the column header.             |
| `pinned`  | `bool \| None`                        | `None`  | Whether the column is pinned to the left side.                  |

### Supported Data Formats

Cell values should be one of:

- **URL**: A URL pointing to an audio/video file (e.g., `https://example.com/audio.mp3`)
  - Can be an absolute URL or a relative URL for files served via [static file serving](https://docs.streamlit.io/develop/concepts/configuration/serving-static-files)
- **Data URI**: A base64-encoded data URL (e.g., `data:audio/mp3;base64,//uQx...`)

These are the same formats supported by the native HTML `<audio>` and `<video>` elements.

### Cell Display

**In-cell rendering:**

- Display a material icon centered in the cell:
  - `AudioColumn`: `:material/music_video:` icon
  - `VideoColumn`: `:material/hangout_video:` icon
- The icon provides a visual cue that media content is available
- Empty/null cells show the standard "None" placeholder

**Cell overlay (on selection):**

- Opens a popover/overlay containing the native HTML player:
  - `AudioColumn`: `<audio controls>` element
  - `VideoColumn`: `<video controls>` element
- The overlay allows users to play, pause, seek, and adjust volume
- Video overlay should have a reasonable max size (e.g., 400px width) to fit within the viewport

### Behavior

- **Read-only**: Both column types are not editable (similar to `ImageColumn`)
- **Sorting**: Alphabetical sorting by the URL/data URI string value
- **Copy**: Copies the raw URL/data URI to clipboard
- **Missing values**: Display standard "None" placeholder with faded styling
- **Invalid URLs**: Display the icon normally; browser handles invalid sources gracefully

### Examples

**Basic audio column:**

```python
import pandas as pd
import streamlit as st

df = pd.DataFrame({
    "title": ["Song 1", "Song 2", "Song 3"],
    "audio": [
        "https://example.com/song1.mp3",
        "https://example.com/song2.mp3",
        "https://example.com/song3.mp3",
    ],
})

st.dataframe(
    df,
    column_config={
        "audio": st.column_config.AudioColumn("Preview"),
    },
)
```

**Video column with base64 data:**

```python
import pandas as pd
import streamlit as st

df = pd.DataFrame({
    "clip": ["Intro", "Main", "Outro"],
    "video": [
        "data:video/mp4;base64,AAAAIGZ0eXBpc29t...",
        "data:video/mp4;base64,AAAAIGZ0eXBpc29t...",
        "data:video/mp4;base64,AAAAIGZ0eXBpc29t...",
    ],
})

st.dataframe(
    df,
    column_config={
        "video": st.column_config.VideoColumn("Preview", width="medium"),
    },
)
```

**Using static file serving:**

```python
import pandas as pd
import streamlit as st

# Files served from ./static/ directory
df = pd.DataFrame({
    "episode": ["Ep 1", "Ep 2"],
    "audio": ["/app/static/ep1.mp3", "/app/static/ep2.mp3"],
})

st.dataframe(
    df,
    column_config={
        "audio": st.column_config.AudioColumn("Listen"),
    },
)
```

### Implementation Notes

**Backend (Python):**

- Add `AudioColumnConfig` and `VideoColumnConfig` TypedDicts to `lib/streamlit/elements/lib/column_types.py`
- Add `AudioColumn()` and `VideoColumn()` functions following the `ImageColumn()` pattern
- Register new column types in `column_config.py` exports

**Frontend (TypeScript):**

- Create `AudioColumn.ts` and `VideoColumn.ts` in `frontend/lib/src/components/widgets/DataFrame/columns/`
- Create custom cell renderers (`AudioCell.tsx`, `VideoCell.tsx`) in the `cells/` subdirectory
- Use `GridCellKind.Custom` since glide-data-grid doesn't have native audio/video cell types
- Cell rendering: Display icon using the material icon font (similar to `LinkColumn` with icon display)
- Cell overlay: Render `<audio controls>` or `<video controls>` element in the editor component
- Register new column types in `columns/index.ts`

**Custom cell structure:**

```typescript
interface AudioCellProps {
  readonly kind: "audio-cell"
  readonly src: string | null  // URL or data URI
}

interface VideoCellProps {
  readonly kind: "video-cell"
  readonly src: string | null  // URL or data URI
}
```

### Design

**Cell appearance:**

```
┌─────────────────┐
│                 │
│    🎵 (icon)    │  <- Centered material icon (audio_file / video_file)
│                 │
└─────────────────┘
```

**Overlay appearance (audio):**

```
┌──────────────────────────────────────┐
│  ▶ ━━━━━━━━━━━━━━━━━━━━━━━━━━ 🔊   │  <- Native HTML audio controls
│     0:00 / 3:45                      │
└──────────────────────────────────────┘
```

**Overlay appearance (video):**

```
┌──────────────────────────────────────┐
│                                      │
│         [Video Preview Area]         │
│                                      │
│  ▶ ━━━━━━━━━━━━━━━━━━━━━━━━━━ 🔊   │
│     0:00 / 1:30                      │
└──────────────────────────────────────┘
```

### Edge Cases

- **Large files**: Native HTML elements handle streaming; no special handling needed
- **Unsupported formats**: Browser displays error state; no custom error handling
- **CORS issues**: Same browser behavior as `<audio>`/`<video>` elements elsewhere
- **Autoplay**: Disabled by default (user must click to play)
- **Multiple simultaneous playback**: Browser handles this natively (typically allowed)

### Future Considerations

- **Thumbnail preview for video**: Could extract first frame as cell preview (complex, out of scope)
- **Waveform visualization for audio**: Could show waveform instead of icon (complex, out of scope)
- **Playback controls in cell**: Mini play/pause button without overlay (potential enhancement)
- **Custom audio/video player styling**: Using a Streamlit-styled player instead of native (consistency)

## Checklist

| Item                       | Status        |
| -------------------------- | ------------- |
| Works on SiS, Cloud, etc?  | Yes           |
| No breaking API changes    | Yes           |
| No new dependencies        | Yes           |
| Metrics collected          | Yes (column type usage) |
| Any security/legal impact? | No - uses same URL/data URI patterns as ImageColumn |
| Any docs changes needed?   | Yes - document new column types |
