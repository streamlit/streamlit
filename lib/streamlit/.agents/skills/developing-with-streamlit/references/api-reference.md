# Streamlit API reference

Use this as a quick orientation for the public top-level `st` API. The tables below cover the public `st.<command>(...)` commands, `st.column_config` helpers, and related namespace objects exposed by the local Streamlit namespace when this reference was written.

Treat summaries as starting points, not complete usage docs. Before using unfamiliar parameters, deprecated options, callbacks, return values, or command-specific edge cases, inspect the local docstring and signature.

## Inspecting local docs from the CLI

Use `streamlit docs <COMMAND>` to print the signature and docstring for a public Streamlit command from the relevant Streamlit installation:

```bash
streamlit docs st.button
```

It also supports public nested namespace members:

```bash
streamlit docs st.column_config.NumberColumn
streamlit docs st.cache_data.clear
```

For container usage, look up the same top-level command because container methods share the same public element docs:

```bash
streamlit docs st.button
# Applies to st.button(...), st.sidebar.button(...), and buttons in other containers.
```

Run this command with the Streamlit installation relevant to the code being edited. For example, use the active virtual environment, the project's package runner, or the repo's development environment so the docs match that Streamlit version. If `COMMAND` is omitted, `streamlit docs` opens the documentation website in a browser instead of printing command docs.

## Public `st` commands

| Command | Summary |
|---------|---------|
| `st.App` | ASGI-compatible Streamlit application wrapper. Use when embedding Streamlit in an ASGI server and verify the current docstring for exact setup and parameters. |
| `st.Page` | Configure a page for `st.navigation` in a multipage app. It creates a page object from a Python file or callable with optional title, icon, URL path, default status, and visibility. |
| `st.altair_chart` | Display a chart using Vega-Altair. Use when native charts are not expressive enough and you need Altair's encodings, layers, tooltips, or interactions. |
| `st.area_chart` | Display an area chart from data. It is a convenience wrapper for common area-chart use cases with Streamlit-managed rendering. |
| `st.audio` | Display an audio player. Accepts common audio data sources such as files, URLs, bytes, and arrays. |
| `st.audio_input` | Display a microphone recording widget. It returns the user's recorded audio so the app can process or store it. |
| `st.badge` | Display a colored badge with an icon and label. Useful for compact status, category, or metadata indicators. |
| `st.balloons` | Draw a celebratory balloon animation. Use sparingly for success moments or lightweight feedback. |
| `st.bar_chart` | Display a bar chart from data. It is a native chart command for straightforward categorical or binned comparisons. |
| `st.bokeh_chart` | Display an interactive Bokeh chart. Use when the app already uses Bokeh or needs Bokeh-specific chart features. |
| `st.button` | Display a button widget. It returns `True` on the rerun triggered by a click and supports callbacks through `on_click`. |
| `st.cache` | Deprecated caching decorator, kept only as an alias for the newer caches. Do not use in new code; prefer `st.cache_data` for serializable data and `st.cache_resource` for shared resources. |
| `st.cache_data` | Decorator for caching functions that return data. Use it for serializable data-loading or computation results, and use `st.cache_data.clear()` when caches need to be cleared. |
| `st.cache_resource` | Decorator for caching shared resources. Use it for objects such as database connections, ML models, clients, or other expensive process-wide resources. |
| `st.camera_input` | Display a webcam input widget. It returns an `UploadedFile` with the captured image when the user takes a picture, and `None` before then. |
| `st.caption` | Display small caption text. Use for secondary text, notes, or metadata beneath primary content. |
| `st.chat_input` | Display a chat input widget. It is designed for conversational apps and returns the submitted message or uploaded files depending on configuration. |
| `st.chat_message` | Insert a chat message container. Use it with `with` blocks to render messages from users, assistants, or named speakers. |
| `st.checkbox` | Display a checkbox widget. It returns a boolean value and can run an `on_change` callback. |
| `st.code` | Display a code block with optional syntax highlighting. Use it for source code, commands, logs, and other preformatted text. |
| `st.color_picker` | Display a color picker widget. It returns the selected color as a hex string. |
| `st.columns` | Insert side-by-side containers. Use it for horizontal layouts and place elements into returned column containers. |
| `st.connection` | Create or retrieve a connection to a data store or API. Use connection classes and secrets to centralize external service access. |
| `st.container` | Insert a multi-element container. Use it to group elements, control layout, or append content to a specific location. |
| `st.data_editor` | Display an editable data table widget. Use it when users need to edit rows or cells and the app needs the edited data back in Python. |
| `st.dataframe` | Display a dataframe as an interactive table. Supports column configuration, selection, sizing, sorting, and efficient data exploration. |
| `st.date_input` | Display a date input widget. It can return a single date or a date range depending on the initial value. |
| `st.datetime_input` | Display a date and time input widget. Use it when users need to choose precise timestamps rather than dates alone. |
| `st.dialog` | Decorator that turns a function into a modal dialog. Use it to isolate short workflows while preserving Streamlit's rerun model. |
| `st.divider` | Display a horizontal rule. Use it to separate sections without adding a heavy layout container. |
| `st.download_button` | Display a button that downloads data. Use it for generated files, reports, transformed data, or other app outputs. |
| `st.echo` | Context manager that displays code and then executes it. Useful for tutorials, examples, and educational apps. |
| `st.empty` | Insert a single-element placeholder container. Use it when you need to replace, update, or clear one element later. |
| `st.error` | Display an error message. Use it for failures or blocking conditions that require user attention. |
| `st.exception` | Display an exception with traceback information. Use it to surface caught exceptions during debugging or diagnostics. |
| `st.expander` | Insert a collapsible multi-element container. Use it for optional details that should not dominate the main page. |
| `st.feedback` | Display a feedback widget. It supports compact user reactions such as thumbs, faces, or stars depending on configuration. |
| `st.file_uploader` | Display a file uploader widget. It returns uploaded file objects and can support multiple files and type filtering. |
| `st.form` | Create a form that batches widgets with a submit button. Use it when several inputs should update the app together instead of on every widget change. |
| `st.form_submit_button` | Display a form submit button. It must be used inside `st.form` and triggers the form's batched submission. |
| `st.fragment` | Decorator that allows a function to rerun independently from the full app. Use it to reduce rerun cost for isolated interactive sections. |
| `st.get_option` | Return the current value of a Streamlit configuration option. Use it for runtime-aware behavior that depends on configured settings. |
| `st.graphviz_chart` | Display a graph using Graphviz/dagre-d3 rendering. Use it for directed graphs, diagrams, and node-edge visualizations. |
| `st.header` | Display text in header formatting. Use it for major sections below the page title. |
| `st.help` | Display help for a Python object. It renders docstrings, signatures, and related information inside the app. |
| `st.html` | Insert HTML into the app for static markup and styling. JavaScript is ignored by default (opt in with `unsafe_allow_javascript=True`); for interactive components that exchange data with Python, use `st.components.v2.component()` instead. |
| `st.iframe` | Embed content in an iframe. Use it to show an external page or embedded resource in a bounded frame. |
| `st.image` | Display an image or list of images. Accepts paths, URLs, bytes, arrays, and image-like objects. |
| `st.info` | Display an informational message. Use it for neutral guidance, context, or non-blocking status. |
| `st.json` | Display an object or string as interactive pretty-printed JSON. Use it for structured debug output or data inspection. |
| `st.latex` | Display mathematical expressions formatted as LaTeX. Use it for equations and scientific notation. |
| `st.line_chart` | Display a line chart from data. It is a native chart command for trends, time series, and ordered numeric values. |
| `st.link_button` | Display a button-style link. Use it when the action is navigation to another URL rather than a Python callback. |
| `st.login` | Initiate a login flow for an authentication provider. Use it with configured auth settings and inspect the local docs for provider-specific behavior. |
| `st.logo` | Render a logo in the upper-left corner of the app and sidebar. Use it for app branding and optional navigation link behavior. |
| `st.logout` | Log out the current user. Use it with Streamlit's authentication support. |
| `st.map` | Display a map with a scatterplot overlay. Use it for latitude/longitude data when a simple geographic visualization is enough. |
| `st.markdown` | Display Markdown-formatted text. It supports Streamlit-specific extensions such as colored text, badges, icons, and limited HTML when enabled. |
| `st.menu_button` | Display a dropdown menu button widget. Use it when a compact button should expose a small set of actions or options. |
| `st.metric` | Display a metric with an optional delta indicator and optional inline sparkline (`chart_data`). Use it for KPIs, headline numbers, and dashboard summaries. |
| `st.multiselect` | Display a widget that lets users select multiple options. It returns a list of selected values. |
| `st.navigation` | Configure pages for a multipage app. It returns the currently selected page object, which the app should run. |
| `st.number_input` | Display a numeric input widget. It supports integer and floating-point values, bounds, steps, and formatting. |
| `st.page_link` | Display a link to another page in a multipage app or to an external URL. Use it for explicit navigation elements. |
| `st.pagination` | Display a pagination widget for navigating through pages of content. Use it when a dataset or workflow is split across numbered pages. |
| `st.pdf` | Display a PDF viewer. Use it to render PDF files or bytes directly in the app. |
| `st.pills` | Display a pills selection widget. Use it for compact single- or multi-select choices with pill-shaped options. |
| `st.plotly_chart` | Display an interactive Plotly chart. Use it when Plotly is already available or chart interactions/customization require Plotly. |
| `st.popover` | Insert a popover container. Use it for compact controls or details that should appear on demand without occupying page space. |
| `st.progress` | Display a progress bar. Use it to communicate completion state for running tasks or staged workflows. |
| `st.pydeck_chart` | Display a PyDeck chart. Use it for deck.gl-powered maps and geospatial visualizations. |
| `st.pyplot` | Display a Matplotlib figure. Use it for existing Matplotlib visualizations or libraries that produce Matplotlib figures. |
| `st.radio` | Display a radio button widget. Use it when users should choose exactly one option from a small visible set. |
| `st.rerun` | Rerun the script immediately. Use it to force a rerun after state changes or navigation-like actions. |
| `st.scatter_chart` | Display a scatterplot chart from data. Use it for relationships between numeric variables, optionally with size and color encodings. |
| `st.segmented_control` | Display a segmented control widget. Use it for compact mutually exclusive choices, especially mode or view switching. |
| `st.select_slider` | Display a slider widget backed by a discrete list of options. Use it when options are ordered but not necessarily numeric. |
| `st.selectbox` | Display a dropdown select widget. Use it for selecting one item from a medium or large set. |
| `st.set_option` | Set a Streamlit configuration option at runtime. Use sparingly because not all options are safe or meaningful to change after startup. |
| `st.set_page_config` | Configure default page settings such as title, icon, layout, sidebar state, and menu items. Can be called multiple times in a run; calls are additive and override only the parameters you specify. |
| `st.slider` | Display a slider widget. Use it for numeric ranges, dates, times, or other ordered values. |
| `st.snow` | Draw a celebratory snowfall animation. Use sparingly for lightweight success or celebration effects. |
| `st.space` | Add vertical or horizontal space. Use it for small layout adjustments instead of empty Markdown strings. |
| `st.spinner` | Display a loading spinner while executing a block of code. Use it as a context manager around work that may take noticeable time. |
| `st.status` | Insert a status container for long-running tasks. Use it to show progress, intermediate output, and final state for multi-step operations. |
| `st.stop` | Stop execution immediately. Use it to halt rendering after validation failures, missing inputs, or intentional early exits. |
| `st.subheader` | Display text in subheader formatting. Use it for subsections under headers. |
| `st.success` | Display a success message. Use it for completed actions or positive status. |
| `st.switch_page` | Programmatically switch the current page in a multipage app. Use it for navigation triggered by app logic. |
| `st.table` | Display a static table. Use it when users do not need sorting, selection, resizing, or other interactive dataframe behavior. |
| `st.tabs` | Insert containers separated into tabs. Use tabs to switch between related views while rendering all tab content in the same run. |
| `st.text` | Display plain preformatted text without Markdown or HTML parsing. Use it for literal output. |
| `st.text_area` | Display a multi-line text input widget. Use it for comments, prompts, notes, and longer free-form input. |
| `st.text_input` | Display a single-line text input widget. Use it for short free-form input such as names, filters, IDs, or search text. |
| `st.time_input` | Display a time input widget. Use it when users need to choose a time of day. |
| `st.title` | Display text in title formatting. Use it for the main page title. |
| `st.toast` | Display a short notification message. It appears briefly in the app's top-right corner. |
| `st.toggle` | Display a toggle widget. Use it for boolean settings that behave like on/off switches. |
| `st.vega_lite_chart` | Display a chart using the Vega-Lite library. Use it for direct Vega-Lite specifications or when you already have Vega-Lite JSON. |
| `st.video` | Display a video player. Accepts common video data sources such as files, URLs, bytes, and arrays. |
| `st.warning` | Display a warning message. Use it for cautionary or recoverable conditions that need attention. |
| `st.write` | Display one or more objects using Streamlit's automatic type-based rendering. Use it for quick output, mixed content, and exploratory apps. |
| `st.write_stream` | Stream a generator, iterable, or stream-like sequence to the app. Use it for token streams, incremental text, or progressively produced output. |

## Public `st.column_config` helpers

Use these in the `column_config` parameter of `st.dataframe` or `st.data_editor`.

| Helper | Summary |
|--------|---------|
| `st.column_config.AreaChartColumn` | Configure a column as an area-chart sparkline. Use it for compact per-row trends where filled areas are clearer than plain numbers. |
| `st.column_config.AudioColumn` | Configure a column to render audio players. Use it for audio URLs, paths, or media values that users should be able to play inline. |
| `st.column_config.BarChartColumn` | Configure a column as a bar-chart sparkline. Use it for compact per-row comparisons or small sequences of numeric values. |
| `st.column_config.ButtonColumn` | Configure a column with clickable buttons. Use it in `st.dataframe`/`st.data_editor` when each row needs an action trigger. |
| `st.column_config.CheckboxColumn` | Configure a column as checkboxes. Use it for boolean values, especially editable true/false fields in `st.data_editor`. |
| `st.column_config.Column` | Configure generic column metadata such as label, width, help text, visibility, disabled state, and pinned state. Use it when no specialized type is needed. |
| `st.column_config.DateColumn` | Configure a column for date values. Use it for date-only display or editing with optional formatting and bounds. |
| `st.column_config.DatetimeColumn` | Configure a column for datetime values. Use it for timestamp display or editing with optional formatting, timezone-aware values, and bounds. |
| `st.column_config.ImageColumn` | Configure a column to render images. Use it for image URLs, paths, or image-like values that should display visually instead of as text. |
| `st.column_config.JsonColumn` | Configure a column to display JSON values. Use it for dictionaries, lists, or JSON strings that need structured display. |
| `st.column_config.LineChartColumn` | Configure a column as a line-chart sparkline. Use it for compact per-row trends without the filled area of an area chart. |
| `st.column_config.LinkColumn` | Configure a column as clickable links. Use it for URLs, optionally with validation and display text behavior. |
| `st.column_config.ListColumn` | Configure a column to display list-like values. Use it for arrays or repeated values that should render as structured list content. |
| `st.column_config.MarkdownColumn` | Configure a column for Markdown content. Cells show plain text, and clicking a cell opens an overlay that renders the Markdown (with an editor in `st.data_editor`). |
| `st.column_config.MultiselectColumn` | Configure an editable column with multiselect controls. Use it when each row can contain multiple choices from a known set. |
| `st.column_config.NumberColumn` | Configure a numeric column. Use it for integers, floats, currencies, percentages, min/max bounds, step sizes, and numeric formatting. |
| `st.column_config.ProgressColumn` | Configure a numeric column as progress bars. Use it for percentages, completion values, scores, or bounded progress-like quantities. |
| `st.column_config.SelectboxColumn` | Configure an editable column with selectbox controls. Use it when each row should choose exactly one option from a known set. |
| `st.column_config.TextColumn` | Configure a text column. Use it for strings with optional validation, length bounds, and text-specific display or editing behavior. |
| `st.column_config.TimeColumn` | Configure a column for time values. Use it for time-of-day display or editing with optional formatting and bounds. |
| `st.column_config.VideoColumn` | Configure a column to render video players. Use it for video URLs, paths, or media values that users should be able to play inline. |

## Related public namespace objects

| Object | Summary |
|--------|---------|
| `st.bottom` | Bottom-pinned container for the main app area. Use it as a container object, not as a function. |
| `st.column_config` | Namespace of column configuration helpers for `st.dataframe` and `st.data_editor`. See the dedicated table above and inspect helpers such as `st.column_config.NumberColumn` for exact parameters. |
| `st.components` | Namespace for custom components. Prefer `st.components.v2.component()` for new HTML/JS components; `st.components.v1` is deprecated for new work. |
| `st.context` | Read-only proxy for user session context. Exposes `headers`, `cookies`, `theme` (`theme.type`), `timezone`, `timezone_offset`, `locale`, `url`, `ip_address`, and `is_embedded`. |
| `st.query_params` | Mutable proxy for the browser URL query parameters. Use it to read or update URL state. |
| `st.secrets` | Dict-like access to secrets loaded from `secrets.toml`. Use it for credentials and configuration that should not be hard-coded. |
| `st.session_state` | Per-session mutable state proxy. Use it to persist values across reruns and coordinate widgets, callbacks, and app logic. |
| `st.sidebar` | Sidebar container that exposes most element methods as `st.sidebar.<command>()` and supports `with st.sidebar:` blocks. |
| `st.user` | Read-only dict-like proxy for current user information. Values depend on the hosting and authentication configuration. |
