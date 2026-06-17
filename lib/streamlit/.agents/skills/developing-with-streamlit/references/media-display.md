# Displaying media

Use the typed media command for images, video, audio, and PDFs — each renders a proper viewer/player with the right controls. Don't embed media with raw HTML (`unsafe_allow_html`) or an `st.components` iframe hack; the native commands handle formats, sizing, and theming.

## Images: st.image

```python
st.image("chart.png", caption="Q3 revenue", width="stretch")
```

Accepts a file path, URL, `PIL.Image`, NumPy array, or bytes. Use `width="stretch"` to fill the container or `width=<pixels>` for a fixed size. Do NOT use `use_column_width` / `use_container_width` — those are deprecated; use `width=`.

## Video: st.video

```python
st.video("clip.mp4")
st.video("https://youtu.be/<id>")            # YouTube URLs work
st.video("clip.mp4", subtitles="captions.vtt")
```

Accepts a path, URL, or bytes. Supports `start_time` / `end_time`, `autoplay`, `muted`, `loop`, and subtitles.

## Audio: st.audio

```python
st.audio("track.mp3")
st.audio(samples, sample_rate=44100)         # a NumPy sample array
```

Accepts a path, URL, bytes, or a NumPy sample array (with `sample_rate`). Supports `start_time`, `autoplay`, and `loop`.

## PDFs: st.pdf

```python
st.pdf("report.pdf", height=600)
```

Renders a PDF inline from a path, URL, bytes, or file-like object (`height` defaults to 500). Prefer it over an `st.components` HTML `<iframe>`/`<embed>` hack for showing a PDF.

## Logo: st.logo

`st.logo` pins a brand image to the top of the sidebar/header — distinct from `st.image`, which places an image in the page's content flow. See [design.md](design.md).

## References

- [st.image](https://docs.streamlit.io/develop/api-reference/media/st.image)
- [st.video](https://docs.streamlit.io/develop/api-reference/media/st.video)
- [st.audio](https://docs.streamlit.io/develop/api-reference/media/st.audio)
- [st.pdf](https://docs.streamlit.io/develop/api-reference/media/st.pdf)
- [st.logo](https://docs.streamlit.io/develop/api-reference/media/st.logo)
