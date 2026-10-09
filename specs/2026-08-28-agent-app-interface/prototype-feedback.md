---
author: lukasmasuch
created: 2026-09-10
---

# Prototype feedback: agent-accessible Streamlit apps

Client-side trial of the v1 `POST /_stcore/agent/v1/interact` prototype, using
only the served OpenAPI document and HTTP. No browser. App source was not given
to the callers.

This is complementary to [prototype-learnings.md](./prototype-learnings.md),
which records what building the prototype taught about the codebase. This
file records what *using* it as an agent is like, including two downstream
tasks the spec names as consumers of the same snapshot: a personalized email
report and a static HTML export.

Ten trials, same protocol, growing app set. The first found holes where the
snapshot was dishonest. Later trials re-ran after patches. The fifth added an
element gallery to sweep many `st.*` commands at once. The sixth is the first
that can drive `@st.fragment` regions and `st.dialog` bodies the way a browser
would. The seventh left the kitchen-sink apps and drove a real Community Cloud
host: [issues.streamlit.app](https://issues.streamlit.app/), Streamlit’s
internal `streamlit/streamlit` dashboard, using only the iframe-prefixed agent
API. The eighth stayed on that host with harder cross-page questions. The
ninth asked a different set (enhancement rollup, P2 identity, AI-workflow
isolation, pytest / lighthouse / wheel / GitHub stats, query-param retention,
MCP structured content). The tenth left that host and drove two new
multipage Vega apps on localhost. Callers were not allowed to read GitHub
or the app source.

Challenge apps and raw notes live under `work-tmp/agent-challenges/` (gitignored).
The apps are not the product; they exist to exercise the API.

## Trial setup

Four multipage apps, all with authored `key=` values, captions/help/expanders
that define the numbers, and `bind="query-params"` on the filters that should
be one-shot parameterizable:

| App | Dataset | Port | Interaction shapes |
| --- | --- | --- | --- |
| Fleet efficiency lab | Vega `cars` | 8511 | Cascading origin → years → manufacturer; overview / drill-down / compare; range slider; comparison-log button |
| Studio slate | Vega `movies` | 8512 | Bound genre/decade filters; genre → distributor drill-down; form with two submits; `st.chat_input`; `st.menu_button`; `st.dialog`; `st.file_uploader`; disabled slider gated by a checkbox |
| Climate desk | Vega `seattle-weather` | 8513 | Year vs custom `date_input` range; `st.pills` weather types; popover slider; `st.status`; `st.fragment` day inspector; `st.download_button`; month drill-down; two-submit field log |
| Airport atlas | Vega `airports` | 8514 | Lat bounds + region; `st.map`; state drill-down + latitude slider; `st.download_button`; pin form; `st.data_editor` |
| Longevity desk | Vega `gapminder` | 8515 | Year `select_slider`; region pills; Altair bubble vs native scatter behind **lazy** `st.tabs`; country drill-down; two-submit notes form |
| Equity tape | Vega `stocks` | 8516 | Ticker pills; `1Y`/`5Y`/`YTD`/`All` time range; `st.toggle` index-to-100; Altair lines; calendar-year page; overlay rebuild button |
| Element gallery | Vega cars / airports / weather | 8520 | Coverage sweep of public `st` widgets, display, charts, layouts, forms, chat, tabs, status, two named fragments, a driveable dialog, media |
| Issue explorer (live) | `streamlit/streamlit` dashboards | [issues.streamlit.app](https://issues.streamlit.app/~/+/) | 21 pages; open issues + labels; interrupt rotation fragments; AI workflow pills; flaky tests; coverage; community PRs; wiki `file` bind |
| Delay network | Vega `flights-10k` | 8531 | February origin → destination; lazy chart tabs; route fragment; desk form, chat, dialog |
| Strike ledger | Vega `birdstrikes` | 8532 | Year / phase / night filters; airport drill-down; species fragment; case-file form and errors |

The extra apps follow the bundled developing-with-streamlit guidance
(`st.navigation` + `app_pages/` with titles in `streamlit_app.py`, top nav for
three pages, `@st.cache_data` with `ttl`, `st.pills` / `st.segmented_control`,
`bind="query-params"`, Material icons, sentence case, horizontal metric rows,
`st.altair_chart` for layered / bubble charts, no `use_container_width`).
Equity tape is adapted from the stock-peers dashboard template, using the Vega
`stocks` catalog instead of live `yfinance`.

Five challenges, each a separate agent pointed at
`GET /_stcore/agent/v1/openapi.json` and told to follow it:

1. **Fleet drill-down** — Japanese cars 1980–1982, manufacturer with ≥5 models
   by mean city MPG, vs USA; persist a compare-page note; one-shot
   `page` + `query_params` create.
2. **Studio multipage** — 1990s Drama median-gross MPAA rating and top title;
   add that title to a two-button form; chat lookup; query-param create;
   probe dialog / uploader / disabled slider.
3. **Protocol stress** — error catalog, forms, triggers, `data.url` lifecycle,
   page identity, charts vs dataframes.
4. **Personalized email** — weekly Drama briefing for a named persona, citing
   app / page / filters / `observed_at`.
5. **Static HTML export** — `file://` briefing for Japan 1980–1982, inlining
   numbers so media URLs need not survive.
6. **Climate desk** — 2012 vs 2015 weather mix; December 2015 precip; date range;
   pills; fragment; field-log form.
7. **Airport atlas** — busiest state, northernmost airport, AK ≥ 64°N vs CA
   split by 38°N; map; pin form.
8. **Longevity desk** — 2005 highest life expectancy; Europe vs Sub-Saharan
   Africa means; Japan 1955→2005; lazy tabs; notes form.
9. **Equity tape** — 2009 highest mean close; AAPL vs MSFT overlay note; time
   range vs calendar year; `st.toggle`.
10. **Element gallery** — sweep many `st.*` types; re-check pills, dates,
    tabs, map Arrow, status, expander, echarts, `clear_on_submit`; drive two
    named fragments and an open dialog without a full-script rerun.
11. **Issue explorer (live)** — `https://issues.streamlit.app/~/+/` only:
    open-issue catalog + `type:bug` one-shot, interrupt-rotation health,
    AI workflow pills, flaky tests, community PRs, coverage (blocked
    row-select), company requests from a table URL, wiki one-shot, email +
    HTML briefing. Eighth trial added feature-label reaction rollups,
    P2/P3 intersections, interrupt vs dedicated-page KPI check, coverage
    slider windows, load-test scenario isolation, Playwright tab/test
    switch, 2025 reaction closers, spec renderer, MCP `tools/call`,
    company hop from a P2 URL. Ninth trial: enhancement rollup, which P2
    bugs those are, AI Issue Triage isolated vs the mosaic tiles, pytest /
    lighthouse / wheel / GitHub stats, whether `label` survives navigation,
    MCP `structuredContent`. No GitHub API.
12. **Delay network** — February 2001 PHX, highest late-rate destination at
    the default minimum size; route hour fragment; desk note, watch, dialog,
    chat, CSV download; lazy tabs; read-only selection and editor.
13. **Strike ledger** — 2000 costliest species and year totals; Night
    substantial count; busiest airport vs highest-cost airport; species
    fragment; case-file form, chat, handled and uncaught errors.
14. **Interaction sweep** — both apps: value widgets, forms, fragments,
    dialogs, lazy and eager tabs, charts, protocol errors, MCP.
15. **February PHX briefing** — email plus static HTML for one persona,
    citing app, page, filters, and `observed_at`.

Answers matched independent aggregates of the Vega catalogs in every trial.

## Second trial (after the implementor patches)

Same five challenges. Library process restarted so the new code was actually
loaded. Artifacts:

- `work-tmp/agent-challenges/reports-r2/fleet.md`
- `work-tmp/agent-challenges/reports-r2/studio.md`
- `work-tmp/agent-challenges/reports-r2/protocol.md`
- `work-tmp/agent-challenges/reports-r2/email.md` + `email-drama-1990s.html`
- `work-tmp/agent-challenges/reports-r2/html-export.md` + `fleet-japan-1980-1982.html`

First-trial notes (same paths under `reports/`, not `reports-r2/`) are the
baseline the scorecard refers to.

## Third trial (fresh process, same patches)

Library files had not changed since the second trial. The apps were killed and
restarted so this pass is not reading leftover sessions. Same five challenges.
Artifacts: `work-tmp/agent-challenges/reports-r3/`.

No regressions on the patched items. Honda **35.97** / USA **28.21** / Japan
**34.40**, and Drama 1990s PG **$54,112,039.50** / Forrest Gump **$329,694,499**,
again from **this** snapshot’s Arrow. Unique-slice media 404s after the
dataframe is replaced (Europe 1971–1973 → other origin). Shared content-hashes
still 200 while another session holds them.

**New, not a regression:** bound query params are inbound-only until you
*navigate*. `widget_state` to Drama/1990s leaves `query_params` `{}`. After
`page=watchlist` then `page=""`, the snapshot suddenly has
`{genre:["Drama"], decade:["1990s"]}`. A later `widget_state.genre=Comedy`
updates `value` but **leaves the query string on Drama**. Widget `value` and
`query_params` then disagree. Citation that prefers `query_params` over widget
`value` will be wrong. Chart nodes in this trial still have `props` + `data`
and no Vega `spec` (no `width`/`height` 0 on the wire).

## Fourth trial (acting-edge patches + extra apps)

Library restarted so bounds validation, `menu_button` option checks,
`missing_form_submit`, creating-call `trigger` rejection, and `session_id` on
create errors were actually loaded. Same fleet/studio challenges, plus Climate
desk (8513), Airport atlas (8514), Longevity desk (8515), and Equity tape
(8516). Artifacts: `work-tmp/agent-challenges/reports-r4/`.

### Previously open, now fixed

| Issue | Round 4 |
| --- | --- |
| Numeric/range out of bounds | **Fixed** for min/max and reversed slider ranges (`year_from: 1960` / `1985`, `drill_years: [1982,1980]` → **400 `invalid_value`**). **Still open:** wrong *shape* (`null`, `[]`, a bare int, a 3-list) is **200** and silently resets. |
| `st.menu_button` | **Fixed.** Missing payload, unknown option, and object payload are all **400 `invalid_value`**. No 500. |
| Form fields without submit | **Fixed.** **400 `missing_form_submit`**. Fields + one FormSubmitter still 200 and commits. |
| Creating-call `trigger` | **Fixed.** **400 `invalid_request`** before a session exists (same idea as `widget_state`). |
| Unknown page on create leaked the session | **Fixed.** 404 body includes `session_id`; continuing it lands on the default page. |

No regressions on the data-hole / error-code / `app_title` / dialog / `Link` set.

### New apps (answers)

Climate desk, year 2012: **rain 191 days**, **1226.0 mm**, mean high **15.28 °C**.
2015: **sun 180**, rain **5**, snow **0**. December 2015: **284.5 mm**, **8.38 °C**.
One-shot `{page:"month", query_params:{month_year:["2015"]}}` works. Pin-month
note survives a later non-trigger interact.

Airport atlas: busiest state **AK 263**, northernmost **BRW** (Barrow, 71.29°).
AK at/north of 64°N: **70 / 263**, still BRW. CA south of 38°N **127** vs north
**78**. One-shot `{page:"state", query_params:{ap_state:["AK"]}}` works.

Longevity desk, year 2005 (default): **63** countries, mean life **72.88 yr**,
highest **Japan 82.603**. Europe-only: **19** countries, mean **78.61 yr**,
highest Iceland **81.757**. Sub-Saharan Africa (four countries in this extract):
mean **49.14 yr**. One-shot `{page:"country", query_params:{gm_country:["Japan"]}}`
gives **82.603 yr**, **+17.103 yr vs 1955**. Pin-country note survives a later
non-trigger interact. `st.altair_chart` has `data.url` (63-row complete Arrow).

Equity tape, calendar 2009: **GOOG** highest mean close **449.92**; AAPL **150.39**.
Rebuild overlay AAPL vs MSFT 2009: **150.39 / 22.87**. Trailing **1Y** from
2010-03 is a different window (GOOG mean **487.65**). `st.toggle` (`eq_index`)
sets and round-trips. Altair tape has `data.url` (560 rows, truncated preview).

### New issues this round (from the extra apps)

**E. `st.map` has no fetchable data path.** `support: read_only_in_v1`. `data` is
only a Deck.gl `spec` (no `url`, no preview, no `complete`). Unfiltered: **zoom 0**,
**3376 points inlined** in `layers[0].data`. After an AK ≥ 64°N filter the spec
inlines 70 points and zoom becomes 3. The catalog dataframe still has Arrow;
the map does not. This is the chart-data hole in a different proto.

**F. `st.status` stays `running`.** After the run is `status: ready` and the
status children already say the breakdown is ready, the node’s `props.state`
is still `"running"`. Same coalescing family as the dialog re-emit: the
update at the same delta path is not what the snapshot reports.

**G. `st.pills` with `format_func` is write≠read.** Snapshot `value` is the raw
option (`sun`, `12`); `props.options` are the *labels* (`Sun`, `December`).
Sending the snapshot value is **400 `invalid_value`**; sending the label works.
An agent that round-trips `value` is wrong. Empty `[]` is allowed (and blanks
the page, by design of this app).

**H. Date ranges do not get the reversed-range check.** ISO dates set a custom
window. A reversed pair of in-range dates is **200**; the app shows `st.error`
and hides download/fragment. Number/slider reversed ranges are now rejected;
`st.date_input` is not.

**I. `st.data_editor` classification.** After a successful pin, the editor is
in the tree with `support: read_only_in_v1` and a `data.url`. Patching it
returned **409 `disabled_widget`** (the app passed `disabled=True`), not
`unsupported_element`. Disabled is checked first. `st.download_button` is
honest: **400 `unsupported_element`**, not in `actions`.

**J. Metric numbers live in `props.value`.** Top-level `value` is null. Day
counts for “most common weather” are in `props.delta`. Callers that already
learned this from fleet/studio were fine; a naive `node.value` reader gets
nothing.

**K. Lazy `st.tabs` are a trap.** With `key="gm_tabs"` and `on_change="rerun"`,
the snapshot shows three `tab` children and captions that say the other tabs
are closed. The keyed `tabs` node is **not** in `actions`, has no `value` and
no `support`, and `widget_state` / `trigger` on that key is **409 `not_on_page`**
— even though the node is in the current tree. Native scatter and the catalog
never appear. Eager tabs (climate/airport) still dump every child with no
selected flag. Either way, an agent cannot change tabs. `st.altair_chart` on
the *open* tab does have `data.url`, unlike `st.map`.

**L. `st.toggle` is fine.** `eq_index` is in `actions`, round-trips `true`/`false`
on top-level `value` (unlike metrics).

**M. `clear_on_submit` is advertised but not applied.** After a successful
watchlist Add (`clear_on_submit: true` on the form node), `wl_title` and
`wl_priority` still held Forrest Gump / High. The list committed; the fields
did not reset. A caller that waits for empty fields as “submit finished” will
think the form is still dirty.

Still open, unchanged: `props.index` vs `value`; query_params string coercion and
nav/widget divergence; no structured `applied_filters`.

## Fifth trial (honesty patch + element gallery)

Library restarted. New app: Element gallery on **8520**, plus climate / airport /
longevity / studio so previously open holes could be re-checked. Artifacts:
`work-tmp/agent-challenges/reports-r5/gallery.md`.

### Previously open, now fixed

| Issue | Round 5 |
| --- | --- |
| Pills / `format_func` write≠read | **Fixed.** Climate `wx_types` is `['Sun', 'Fog', …]` and echoing it is 200. Raw option `12` is 400. |
| Reversed / wrong-shape dates | **Fixed.** 400 `invalid_value` (reversed, one date, `[]`). |
| Wrong-shape numbers | **Fixed** for bounded widgets (`null`, 1-item range, OOB). |
| `st.map` Arrow | **Fixed.** Airport GET `data.url` → 3376-row Arrow. `row_count` is still missing on the map node; Deck.gl `spec` remains. |
| `st.status` stuck `running` | **Fixed.** `state: complete` after update. |
| Lazy `st.tabs` | **Fixed.** In `actions`, `value` is the open label, children have `open`. Setting `Catalog` reveals that tab’s dataframe. |

### New / remaining from the variety sweep

**N. Lazy `st.expander` is the old tabs bug.** `key="gal_expander"` plus
`on_change="rerun"` is in the tree, not in `actions`. A write is **409
`not_on_page`**. Tabs got `action="value"`; expanders did not.

**O. `st.echarts_chart` has no Arrow.** `read_only_in_v1`, option inlined in
`data.spec`. Vega/Altair charts have `data.url`.

**P. Displayed `st.exception` marks the snapshot `status: error`.** A caught
`ValueError` rendered with `st.exception` on the display page flipped the whole
interact to `error`. The script finished.

**Q. `st.mermaid_chart` is `markdown`.** The command wraps a mermaid fence and
enqueues markdown, so the snapshot never says `mermaid_chart`.

**R. `clear_on_submit` still does not clear.** Gallery Add and studio Add both
left the submitted field values in place. Unchanged from issue M.

**S. `st.html` / `st.iframe` are `browser_required`.** Honest. `st.graphviz_chart`
is described with neither `data` nor `support`.

### Variety coverage (types that described themselves)

checkbox, toggle, radio, selectbox, multiselect, pills, segmented_control,
select_slider, number_input, slider, text_input, text_area, date_input,
datetime_input, time_input, color_picker, feedback, pagination, metric,
bar/line/area/scatter_chart, altair_chart, vega_lite_chart, echarts_chart,
dataframe, table, data_editor, map, graphviz_chart, header/subheader/markdown/
caption/text/code/badge/latex/json/help/divider/alerts, image, audio, html,
iframe, page_link, empty, space, skeleton, progress, columns, container,
popover, tabs, expander, status, form, button, download_button, link_button,
menu_button, file_uploader, camera_input, audio_input, chat_input.

Feedback stars, color, toggle, and pagination all round-tripped. Datetime
below min is 400.

### Scorecard
| --- | --- | --- |
| 1. Mid-size tables truncated, no `data.url` | **Fixed** | Japan 1980–1982 catalog (34 rows) and Drama 1990s catalog (206) both have `data.url`. Arrow `row_count` matches. Truncated dataframe preview is 100 rows (was 10), still not a substitute for Arrow on a 206-row catalog. |
| 6. Charts have no full-data path | **Fixed** | `bar_chart` / `line_chart` / `area_chart` / `scatter_chart` expose `data.url`. Complete series ship a full preview (fleet bar 36, compare lines 12). Chart nodes are `props` (x/y/color) + `data`; this trial did not see a Vega `spec` with `width`/`height` 0 on the wire. |
| 2. `not_on_page` swallowed disabled / unsupported | **Fixed** | Disabled `min_imdb` → **409 `disabled_widget`**. `memo_upload` → **400 `unsupported_element`**. Never-rendered conditionals (`cylinders`, `drill_make`) → **404 `unknown_key`**. |
| 3. `snapshot.page.title` is the app title | **Fixed** | `app_title` is `st.set_page_config` (“Fleet efficiency lab”, “Studio slate”). `page.title` is the nav page (“Fleet overview”, “Box office”, …). OpenAPI documents the split. |
| 4. Unknown `page` on create is 200 | **Fixed** (with a leak) | `{"page":"does-not-exist"}` is **404 `unknown_page`** and lists available `url_path`s. Valid `{"page":"drill-down","query_params":{"drill_origin":["Japan"]}}` is still 200. See new issue A. |
| 8. Empty `trigger: {}` is a silent rerun | **Fixed** | **400 `invalid_request`**: send a `key`, or omit `trigger`. |
| 7. Error responses omit `Link` | **Fixed** | 4xx/5xx include `Link: rel="service-desc"`. |
| 10. Dialogs undescribed and still clickable | **Fixed** (as specified) | `dialog` has `support: not_interactive_in_v1`, `props.title`, children. Confirm is **not** in `actions`. Firing `confirm_export` → `unsupported_element` while the dialog is open, `not_on_page` after it closes. Round 1 could click through an undescribed block; that was the bug, not a feature to keep. |
| 7. `data.url` still 200 after the next interact | **Mostly working** | Isolated unique slice (Europe 1971–1973, then replace filters): old URL **404**. Concurrent sessions that still render the same content-hash keep the file at 200. Fetch-now is per-hash, not per-snapshot. Clients must still take the URL from *this* snapshot. |
| 5. Numeric / range 200 + silent reset | **Still open** | `year_from: 1960` / `1985` / `null` → 200, value **1970** (above-max resets to default, not clamp to 1982). `drill_years` as int / `[]` / `null` / 3-list → 200, reset to `[1970, 1982]`. Reversed `[1982, 1980]` → 200, **kept**. |
| 8. `st.menu_button` unvalidated | **Still open**, plus a 500 | Missing payload or unknown option → **200 no-op**. Object / extra payload → **500 `internal_error` (TypeError)**. See new issue B. |
| 9. Form fields apply without submit | **Still open** | `wl_title` without a FormSubmitter → 200; pending value updates; watchlist table does not commit. |
| 11. `props.index` stale vs `value` | **Still open** | After `genre=Drama` / `fleet_origin=Japan`, `props.index` stays `0`. Trust `value`. |
| 12. Query params / no `applied_filters` | **Still open** | String `query_params.genre: "Drama"` is 200, coerced to `["Drama"]`. `widget_state` on bound widgets does not write `query_params`. Genre deep-dive still ignores box-office decade. No structured filters field. |
| Creating-call `trigger` | **Still open** | `{"trigger":{"key":"rebuild_compare"}}` with no session → 404 `unknown_key`, no `session_id`. Same leak shape as issue A. |
| Watchlist `wl_title.options` dump | Unchanged | ~3176 strings on that page. |
| Metric display strings | Unchanged | PG median metric `$54,112,040` vs table/Arrow `54112039.5`. |
| Empty interact is a rerun | Unchanged | OpenAPI is honest; callers still treat it as GET. |
| Catalog preview order | Unchanged | Not “top by the page’s sort.” Forrest Gump was absent from the first preview rows; present in Arrow. |
| App `st.error` vs `status` | Protocol-correct | Reversed compare years: HTTP 200, `status: "ready"`, tree has an `error` element. |

### What the second trial could do that the first could not

The naming bet still holds. Conditional widgets, one-shot `page` + `query_params`,
form submit keys, chat-as-payload, collapsed expanders, and error *messages* as
teaching all still work.

The **data** contract now matches the captions. Email and HTML callers fetched the
**current** filtered Arrow (206 Drama titles; 34 Japan cars) instead of filtering an
earlier unfiltered file. Charts in this exercise had a complete preview, a URL, or
both. Citation can use `app_title` vs `page.title` without a workaround.

Ground truth (unchanged, now with current-slice Arrow):

- Honda **35.97** city MPG (6 models) among Japan 1980–1982 with ≥5 models; USA **28.21**; Japan overall **34.40**. Compare-page note survived a later non-trigger interact.
- Drama 1990s: **PG** median US gross **$54,112,039.50** (14 titles); top title **Forrest Gump $329,694,499**; slice 206 / median **$22,198,884**. Paramount named from the 1990s Arrow, not from the all-decade genre page.

### New issues this round

**A. Creating-call failures can run (or allocate) a session the client cannot continue.**

`unknown_page` on create: message says “the app ran its default page instead,” body is
only `{error: {code, message}}` — no `session_id`. OpenAPI still describes request-level
failures as “nothing ran.” If the message is literal, the session is leaked until TTL.
Creating-call `trigger` is the same shape (`unknown_key`, “current app state,” no handle).
Either return the handle, or do not run / do not claim a run.

**B. `st.menu_button` extra payload is a 500.**

Unknown option: silent 200. Object payload (`{"option": "Clear watchlist", "extra": 1}`)
→ **500 `internal_error`**, message `TypeError`. That is worse than round 1’s 200 no-op:
a client probing the trigger contract can crash the interaction instead of getting
`invalid_value`. Same `Link` header as other errors, so discovery works; the code does
not.

**C. Dialog confirm still has a tree `key`.**

Classification is correct (`unsupported_element`, not in `actions`). The key
(`confirm_export`) is still sitting on the node, which is bait for a client that walks
the tree instead of `actions`. Fine if the rule is “only `actions` are addressable”;
worth a sentence in OpenAPI.

**D. Preview cap moved 10 → 100, and `complete` is the flag that matters.**

Truncated catalogs preview 100 rows and still omit the top-grossing title from that
stub. Round-1 captions talked about a 10-row cap. Clients should branch on
`data.complete` / `preview.truncated`, then fetch `data.url` from **this** snapshot.
Do not sum the preview.

## Sixth trial (fragment reruns and driveable dialogs)

Library restarted so the fragment-scoped path was actually loaded. OpenAPI now
documents `Snapshot.fragments`, `Node.fragment`, `cross_fragment_batch`, and
that an `st.dialog` body is a fragment: acting inside keeps it open, acting
anywhere else is a full rerun and closes it. Gallery layouts gained two named
fragments plus a full-script-run counter; climate `wx_day` and studio
`open_export` were the real-app checks. Artifacts:
`work-tmp/agent-challenges/reports-r6/`.

### Fragments

A page-body counter (`Full-script runs`) and two keyed fragments (`gal_left_n`,
`gal_right_n`) plus an unnamed third (`gal_frag`) make isolation observable
without reading the app.

| Probe | Result |
| --- | --- |
| Land on layouts | Three fragments, all `rendered: true`. Each number_input carries a distinct `fragment` id. `gal_ping` has none. |
| `gal_left_n: 5` | Left value and metric become 5. Right stays 2, unnamed stays 1. Full-script counter **does not increment**. Only the left fragment has `rendered: true`. |
| `gal_left_n` + `gal_right_n` | **400 `cross_fragment_batch`**, both ids in the message. Nothing ran. |
| `gal_left_n` + `gal_frag` | 400, same code, both ids. |
| `gal_left_n` + `gal_ping` / `gal_side_origin` | 400. Message lists only the left fragment id (the outside control has none). |
| `gal_ping` | Full-script counter increments. All three fragments `rendered: true`. Left is still 5. |
| Climate `wx_day` | Day inspector is fragment-scoped. `2012-01-01` → `2012-01-02` updates the markdown (`Rain, 10.9 mm`) and leaves `wx_year` at 2012. Mixing `wx_day` with `wx_year` is 400. A later `wx_year: 2015` is a full rerun; the fragment re-renders with `2015-01-01`. |

`observed_at` is still a single timestamp for the whole document, as OpenAPI
warns: after the left-only change it did not move (same second as the
layouts landing). Cite `fragments[].rendered` before treating a number as
fresh.

### Dialogs

Round 2 / 5 classified dialogs as `not_interactive_in_v1` and hid confirm
from `actions`. That flag is gone.

| Probe | Result |
| --- | --- |
| Closed | No `dialog` node. `gal_open_export` in `actions`; `gal_confirm` / `gal_export_note` not. |
| Trigger `gal_open_export` | `dialog` with `props.title`, `dismissible`, `is_open: true`. **No `support`.** Confirm is a trigger in `actions`; the note is a value. Both carry the same `fragment` id, which appears in `fragments` with `rendered: true`. Opening is a full-script run (the button is outside). |
| Set the note | Dialog stays open. Full-script counter unchanged. Only the dialog fragment `rendered: true`. |
| Trigger confirm | Dialog stays open. Success + caption show `Queued briefing-42.`. Still fragment-scoped. |
| Note + confirm in one request | **200.** Same fragment, so a batch is legal. Dialog stays open; both the note and the queue update. |
| Note + `gal_ping` | 400 `cross_fragment_batch`. Dialog **stays open**; the refused request does not close it. |
| `gal_ping` while open | Dialog gone. Confirm / note drop out of `actions`. A caption rendered *outside* the dialog still shows the queued note, so session state survived. |
| Confirm after close | **409 `not_on_page`.** |
| Studio `open_export` | Same shape: described, `is_open: true`, `confirm_export` in `actions`. Confirming calls `st.rerun()` with default app scope, so the dialog **closes** and the export flag appears on the page. Stay-open is “do not full-rerun,” including from inside the body. |

### Client gotchas this round

**T. The `dialog` node itself has no `fragment` field.** The body lives in a
child container. OpenAPI says `fragment` appears on nodes *inside* a
fragment; the overlay is the wrapper around one. Walk children (or
`actions`) rather than tagging the overlay.

**U. The overlay still has a generated tree `key`**
(`$$ID-…-None`). It is not in `actions`. Firing it is **404 `unknown_key`**,
not `not_on_page` — it is an identity used to keep the frontend from showing
stale content, not a registered widget. Same “key ≠ permission” rule as
round 2’s issue C, now on the container instead of the confirm button.

**V. There is no dismiss action.** `props.dismissible: true` is advertised.
Closing is any full rerun (empty interact, outside widget, or `st.rerun()`
from the body). That is heavier than clicking X in a browser, which does not
rerun the script when `on_dismiss="ignore"`.

### Bonus from the same session

Lazy `st.expander` (`gal_expander`, `on_change="rerun"`) is now in `actions`
as `kind: value`. Setting it `true` reveals the definition markdown. Issue N
from the fifth trial is fixed.

### Scorecard deltas

| Item | Sixth trial |
| --- | --- |
| 10. Dialogs undescribed / not in `actions` | **Superseded.** Dialogs are described and driveable. Confirm is in `actions` while open. Round 2’s `not_interactive_in_v1` was correct for full-rerun-only and is no longer the contract. |
| Fragment isolation | **Works.** Counter, sibling widgets, and `fragments[].rendered` all agree. |
| `cross_fragment_batch` | **Works.** Two fragments, fragment + outside, dialog + outside. Refused requests leave the previous snapshot current (dialog stays open). |
| Same-fragment batch | **Works.** Note + confirm in one POST. |
| Issue N, lazy expander | **Fixed.** |

## Seventh trial (live Issue explorer)

Host: [issues.streamlit.app](https://issues.streamlit.app/), a Community Cloud
app of 21 pages about `streamlit/streamlit` (open issues, coverage, flaky
tests, AI workflows, load testing, …). Served OpenAPI is the same v1
document. Because of the iframe embed, every agent URL has to be
`https://issues.streamlit.app/~/+/…`. Callers used only that prefix: no
GitHub API, no app source. Caption on the default page: Python 3.13.0,
Streamlit 1.63.0.

Artifacts: `work-tmp/agent-challenges/reports-r7/` (`email.md`,
`briefing.html`, Arrow dumps, `probes.json`).

### Iframe is load-bearing

| Probe | Result |
| --- | --- |
| `https://issues.streamlit.app/_stcore/agent/v1/interact` | **303** to Community Cloud auth HTML |
| Same path under `/~/+/` | **200** snapshot |
| `data.url` `/media/<hash>` on the naked host | **303** HTML |
| `https://issues.streamlit.app/~/+/media/<hash>` | **200** `application/vnd.apache.arrow.stream`, 976 rows matching `row_count` |

OpenAPI has no `servers` entry and `data.url` is a root-relative path. An
agent that concatenates the public origin + `/_stcore/...` never sees the
app. The iframe prefix has to be part of the client’s base URL, including
for Arrow.

`Link: rel="service-desc"` was **absent** on both 200 and 4xx from this
host. That may be the proxy; the prototype still sets it locally.

### What a real dashboard looks like on the wire

- **21 pages**, `url_path`s like `Open_Issues` and `Test_Coverage_(Python)`.
  One-shot `{"page":"Open_Issues"}` lands correctly.
- **Almost no authored `key=`**. Open issues, bug explorer, most coverage /
  flaky / bundle widgets are `$$ID-…-None`. They are in `actions` and they
  work if you copy them from the latest snapshot. You cannot write a
  stable script. Exceptions with real keys: AI usage (`ai_usage_workflows`,
  …), wiki `file`, interrupt `show_reference_views`, playwright/pytest tabs.
- **Option dumps**: default selectbox 497 issue ids; Open issues labels
  157; community-PR author exclude 591; wiki file 256. Same cost as the
  watchlist `options` dump, now on a production page.
- **`app_title` tracks `page.title`** after navigation (“Open issues”,
  “Interrupt rotation”, …). Each page likely calls `st.set_page_config`.
  Cite `page.url_path`.
- **Default `query_params.issue: [""]`** on the landing page.

### Challenges (answers from this snapshot / Arrow only)

**Open issues.** Caption: 976 issues, 13,386 reactions, 218,745 views.
Table `complete: false`, 100-row preview; iframe Arrow is 976 rows. Top
`importance` is not in the preview: alt-text on images/charts (#8563, 314
reactions). One-shot
`{"page":"Open_Issues","query_params":{"label":["type:bug"]}}` seeds the
bound multiselect: **109** bugs, **957** reactions, **24,536** views
(caption and Arrow agree). Highest-importance open bug: `st.login()` /
`st.logout()` regression since 1.53 (#14290). Generated filter key
round-tripped.

**Company requests.** Pasting that catalog’s most-reacted bug URL
(#7076) into the (generated) text input: 10 unique users, 8 reactions, 10
comments, 10 companies. ~9 s. Still no GitHub client.

**Interrupt rotation.** Python coverage **98.71%** (+0.22), frontend
**95.19%**, wheel **9.5 MiB**, total bundle gzip **8.5 MiB**, Playwright
tests **6,290**, failed CI **1%** (2/203), nightly **0/8**. Six fragments
on the page; the selectbox / expander / refresh button are **not**
fragment-scoped (`fragment` absent, mix expander+timeframe is 200). No
`run_every` advertised. Lazy expander `show_reference_views` is in
`actions`; opening it works and reveals more fragments, but the run took
**139 s** (live fetches behind the expander).

**AI workflow usage.** Authored pills. All workflows: 2,733 runs, 95%
success, 144 failed, avg 8m 56s. Pills → `["AI Issue Triage"]`: 295 /
98% / 7 / 3m 45s. Invalid pill and reversed dates still 400
`invalid_value`. Creating-call
`query_params.ai_usage_workflows=["AI QA Testing"]` **stores** the param
but **does not seed** the pills (not bound). Wiki `file` *is* bound:
one-shot `query_params.file` opens that markdown.

**Flaky tests.** Caption: 38 flaky reruns in 200 successful runs
(2026-09-07), 20 tests / 18 scripts; top 5 would cut reruns 60.53%.
Arrow: `test_custom_theme[firefox]` 9 failures, nested
`run_every` webkit 7.

**Python coverage.** 98.71% / 28,305 statements / 366 missed. Info says
“select a row” for the per-commit breakdown. The dataframe has **no
key** and is not in `actions`. File uploader is `unsupported_element`.
Chart click-to-filter captions (“Click on a bar”) are the same gap.

**Community PRs.** 403 / 16 open / 191 merged / 196 closed without
merge; 21.5 days to merge. Contributor Arrow: wyattscarpenter 18 PRs
(16 merged). Merger Arrow: lukasmasuch 71. Author column is GitHub
profile URLs.

**Plotly.** `read_only_in_v1`, `data.complete: true`, no `url`. The
inlined `spec` carries the Plotly default template (tokenized colors)
and traces as base64 `bdata`. Usable as a figure dump, not as a table.
Altair on the same host still has Arrow (flaky trend, bundle, lighthouse,
open-issue statistics once the checkbox is on).

### New issues this round

**W. Community Cloud iframe prefix is not in the protocol.** OpenAPI
paths are `/_stcore/agent/v1/…` with no server. Relative `/media/…` is
the same. On this host both 303 unless the client already knows `/~/+/`.
Worth a sentence for hosted / embedded apps, or a `servers` / `base` field
on the snapshot.

**X. `query_params` leaks across pages.** After filtering Open issues,
Interrupt rotation and AI usage still showed `label: ["type:bug"]`.
Nothing on those pages reads `label`. A briefing that cites
`query_params` as applied filters is wrong. Bound widgets still write
their names; unbound `query_params` on create do not move widgets (AI
pills).

**Y. Plotly “complete” is a theme dump.** Same complete-or-URL-or-unavailable
rule as echarts, but the payload is large enough to matter on a real
dashboard (load testing 549 KB, mostly metrics `chart_data` + Plotly
specs).

**Z. Selection and chart clicks are browser-only.** Coverage, GitHub
stats, community PR bars, and similar tell the user to click. v1 has no
dataframe selection and no Plotly click. The snapshot is honest
(`actions` omits them); the captions still read as if a headless client
could continue.

**AA. `unknown_page` lists paths in the message, not in `pages`.** Error
body has `session_id` (the round-3 leak is now a handle, good) and
`pages: null`. OpenAPI says the response’s `pages` lists them.

**AB. Duplicate metric labels.** AI usage uses “AI PR Review” for both
run count and average duration. Keying metrics by `props.label` drops
one.

### Scorecard deltas

| Item | Seventh trial |
| --- | --- |
| One-shot `page` + bound `query_params` | **Works** on this host (`label`, wiki `file`). |
| Arrow for truncated catalogs | **Works**, if fetched from the iframe prefix. 976 = 976, 109 = 109. |
| Generated keys | **Work**, session-scoped. Almost the whole app is this. |
| `disabled_widget` / `unsupported_element` | Uploader 400 `unsupported_element`. |
| `app_title` vs `page.title` | Split is **not usable here**; both follow the current page. Use `url_path`. |
| `Link` on errors | **Missing** on this host. |
| Fragments | Present on Interrupt; not how the page’s widgets are scoped. Lazy expander 139 s. |
| Email / HTML | **True** for KPI + inlined Arrow, with the iframe-prefix caveat. |

## Eighth trial (advanced questions on the live host)

Same host and prefix as the seventh, now on Streamlit **1.64.0** (caption still
Python 3.13.0). Same black-box rule: OpenAPI + HTTP only, iframe base
`https://issues.streamlit.app/~/+/`, no GitHub, no app source.

Artifacts: `work-tmp/agent-challenges/reports-r8/` (`probes.json`,
`probes2.json`, `probes3.json`, `bug.arrow`). A first session died after
several sequential page navigations (`Connection refused`); remaining pages
were re-run as one-shot creates.

### Protocol that landed since round 7

| Probe | Result |
| --- | --- |
| OpenAPI `servers` | `[{url: "/", description: … hosted app may sit behind a prefix …}]` |
| Join `servers.url` to the **naked** origin | **303** auth HTML (same as round 7) |
| Fetch OpenAPI under `/~/+/` then join `/` | Correct: the relative server is the iframe prefix |
| `info.x-streamlit-agent-api` / version | `available` / `1.64.0` |
| `InteractRequest.context` | Present (`timezone`, `locale`). Create with `Europe/Berlin` + `de-DE` is 200. This app does not echo `st.context`, so the values are not observable. |
| `Fragment` schema | **Dropped**. `Node.fragment` remains. Top-level `fragments` still `null` on Interrupt. |
| MCP in OpenAPI `paths` | **Absent**. Description text mentions MCP. |
| `POST …/mcp` initialize | **200** on the prefix (`protocolVersion` 2025-03-26, `serverInfo.version` 1.64.0). **303** naked. |
| `GET …/mcp` | **405** |
| MCP `tools/list` | One tool: `interact` |
| MCP `tools/call` `{}` | **200**; snapshot is a JSON string inside `result.content[0].text` (landing page, 21 pages) |
| `unknown_page` | **404** with `pages` as **data** (21 entries). Round-7 **AA is fixed** on this host. |
| `Link: rel="service-desc"` | Still **absent** on 200 and 4xx |

The iframe prefix is still load-bearing. `servers: [{url: "/"}]` only helps a
client that already fetched the document from the prefixed URL. An agent that
opens the human URL and concatenates `/_stcore/...` never sees the document.

### Challenges (answers from this snapshot / Arrow only)

**Open bugs, by feature.** One-shot
`{"page":"Open_Issues","query_params":{"label":["type:bug"]}}`: caption and
iframe Arrow both **115** issues, **962** reactions, **24,467** views. Summing
`total_reactions` per `feature:*` label: `st.dataframe` 75, `st.plotly_chart`
59, `authentication` 55, `st.login` 52, `st.selectbox` 52. Priority counts on
the same table: **P2 = 1**, P3 = 74, P4 = 35. Highest `importance` is still
the `st.login()` / `st.logout()` regression (#14290), same as round 7.

**P2 ∩ bug.** Adding `priority:P2` to the bound label widget: **1** issue, 5
reactions, 33 views — Safari pills/segmented-control “selected” style on
fresh load (#17074). Pasting that catalog URL into Company requests: title
matches, metrics **0 / 0 / 0 / 0**, info “No users with company information
found.” Honest empty, ~2 s, still no GitHub client.

**P3 ∩ bug, then “worth working on”.** P3 ∩ bug: **74** / 704 / 17,894. The
checkbox then leaves **59** / 507 / 11,614. The caption’s GitHub search URL
still only has `label:type:bug+label:priority:P3` — the checkbox is not in
the cited query. After the filter, the previous 115-row Arrow **404**s; the
new hash is a different `/media/…`.

**Interrupt vs dedicated pages.** One-shot Interrupt (0.82 s; the in-session
`page` navigation had timed out at 180 s): Python **98.88%** (+0.17),
frontend **95.85%** (−0.01), wheel **9.8 MiB**, total bundle gzip **8.7 MiB**,
Playwright tests **6,454** (**+57**), failed CI **1%** (2/227), failed
nightly **6** (75% · 6/8), E2E memory **9.1 GB**, median duration **0.72 s**.
Six `node.fragment` ids; top-level `fragments` still `null`. Dedicated
Python / frontend / bundle pages match those headline values. Playwright
**stats** page is 6,454 tests but delta **+101**, not +57 — same KPI, two
deltas, no way to tell which window the mosaic used. Wheel dedicated page
reports average **9.6 MiB** / max **9.8 MiB** against Interrupt’s single
“Wheel Size” **9.8 MiB**.

**Coverage window.** Slider bounds are **min 50 / max 250 / value 50**, not
10. Sending `10` is 400 `invalid_value` (“below the minimum”). Setting 100
returns a 99-row complete Arrow: coverage 0.987–0.989, newest ~0.9888.
Metrics stay 98.88% / 28,808 / 323; only the deltas move. After Open-issues
filtering, these pages still carry `query_params.label: ["type:bug",
"priority:P3"]` (leak from round 7, still true).

**Load testing.** Default snapshot **492 KB**, 12 Plotly figures with
`spec_omitted: ["layout.template"]` (~38 k characters each, ~461 k of spec
in the JSON), **36** metrics whose labels repeat (`Initial load (p50)` six
times — one per scenario). Setting Scenarios to `["fragment_app"]` is 200
in 1.5 s and shrinks the snapshot to **81.5 KB**, but the tree still has 12
Plotly nodes and the same 36 duplicate-labeled metrics (overview markdown
still names `many_messages_app`, `caching_app`, …). The widget value
changed; the numbers an agent would cite did not become
fragment-app-only.

**Playwright performance.** Authored keys `playwright_tab` /
`selected_test`. Default tab `Runs` is also written to `query_params.tab`.
Switching test to `test_dialog_open_and_close_performance` (5.3 s) retargets
the Plotly `key`s. Switching tab to “Interpret metrics” (0.48 s) replaces
charts with markdown. Snapshot **317.5 KB** (seven Plotly specs ~40–46 k
chars). Stats page: 6,454 tests, 13.7 min session, mean 1.43 s, median
0.72 s, 9.1 GB memory.

**Issue reactions, 2025.** Default: 5,150 issues / 24,785 reactions / 4.81
average. Date range `["2025-01-01","2025-12-31"]`: **778** / **7,169** /
9.21. Arrow top closers: lukasmasuch 2,703 reactions (275 closed), jrieke
1,242 (104), kajarenc 669 (22). Captions still say “Click on a bar.” First
create timed out at 120 s; retry was 1.7 s.

**Community PRs, Feature, last year.** Default still 403 / 15 open / 191
merged / 197 closed without merge; 21.5 days to merge. Combined
`widget_state` Feature + `["2025-10-01","2026-10-01"]`: **88** / 5 / 14 /
69; 33.1 days to merge. Contributor Arrow authors are GitHub profile URLs;
top Feature-year: tysoncung 6, harshang03 4.

**Spec renderer / wiki.** 48 merged specs; none titled with “agent”.
Selecting “2026-09-14 - Element Alt Text” inlines the product-spec markdown
(`# Alt text for images…`). Wiki `file` options: **325** files;
`prototype-feedback` is not among them. One-shot
`query_params.file=["pull-requests/16843/2026-08-28-agent-app-api-gptsol-product-spec.md"]`
opens that markdown. Bound `file` still seeds on create.

**Flaky tests.** Caption: **76** flaky reruns in 200 successful runs
(2026-09-24), 26 tests / 19 scripts; top 5 would cut reruns **52.63%**;
rolling average **33.0%**. Arrow: `st_form_test.py::test_secondary_submit_buttons_enabled[chromium]`
13, `test_form_disabled_submit_on_click[chromium]` 8, plotly-select
webkit 7.

**AI workflow usage.** 2,943 runs / 95% / 147 failed / avg 9m 5s. Duplicate
labels remain: “AI PR Review” is both 2,538 runs and 9m 30s. Captions still
say click a bar. Snapshot 134.7 KB (one Plotly spec 81 k chars).

**GitHub stats.** Two one-shot creates, 120 s then **180 s**, both client
timeouts. The only 21-page path this trial could not observe.

**Session lifetime.** After Open issues → P2/P3 → coverage (~6 min on one
`session_id`), later `page` navigations returned `Connection refused`.
Health was fine minutes later. One-shot `{page: …}` creates recovered
bundle (68 s), Playwright stats (62 s), load testing (63 s), coverage
(78–90 s). Heavy first paints are slow; a reused session can disappear
without an application-level error.

### Previously open, now fixed or improved

- **AA.** `unknown_page` now puts the 21 pages in `error`/`pages`, not only
  in the message.
- **W, partially.** OpenAPI has `servers: [{url: "/"}]`. That is the right
  shape if the document was fetched from the iframe prefix. It does not
  help a caller that never gets that far. `Link` is still stripped.
- **Y, partially.** Plotly reports `spec_omitted: ["layout.template"]`.
  Coverage figures are 4–19 k characters. Load testing and Playwright
  performance are still hundreds of kilobytes because they ship **many**
  figures, not because of the theme.

### New issues this round

**AC. MCP is a sibling of interact, not a documented path.** `tools/list` /
`tools/call` work on the iframe prefix. OpenAPI `paths` still only lists
interact + the schema route. GET is 405. The snapshot arrives as escaped
JSON in a text content block, so an MCP client that expects structured
tool output has to parse a string.

**AD. Some pages exceed a patient agent’s read timeout; some sessions die.**
`github_stats` never returned in 180 s. Interrupt `page` navigation on a
busy session timed out; a fresh one-shot was 0.82 s. Sequential reuse ended
in `Connection refused` with no `too_many_sessions` / `status: error`
snapshot. One-shot creates are the reliable strategy on this host.

**AE. Mosaic vs dedicated deltas.** Interrupt Playwright Tests **+57** vs
Playwright stats **+101**, same absolute 6,454. Wheel Size 9.8 vs dedicated
average 9.6. An agent that cites “the” coverage or bundle number should
name the page, not assume the mosaic is a projection of the dedicated
pages.

**AF. Duplicate metric labels hide filter effects.** Load-testing
`Initial load (p50)` is six values. After isolating `fragment_app`, all
six are still in the tree. Keying by `props.label` (round-7 **AB**) now
also mis-cites a filter that the widget `value` claims is on.

**AG. Caption GitHub URLs omit some applied widgets.** “Issues worth
working on” changes the table and the counts; the caption’s GitHub link
does not. Same class as citing `query_params` as the filters: the
human-facing citation and the snapshot’s widgets can disagree.

### Scorecard deltas

| Item | Eighth trial |
| --- | --- |
| One-shot `page` + bound `query_params` | **Works** (`label`, wiki `file`). Combined `widget_state` patches too. |
| Arrow | **Works**; 115 = 115. Unreferenced hash **404**s after the next filter. |
| Generated keys | **Work**. Coverage slider, worth-working-on, labels are `$$ID-…`. |
| `unknown_page.pages` | **Fixed** (21 pages as data). |
| `servers` | Present as `/`. Naked origin still **303**. |
| MCP | **Works** on the prefix (`interact` tool). Not in OpenAPI `paths`. |
| `context` | Accepted. Not visible on this app. |
| `Link` | **Missing**. |
| Plotly `spec_omitted` | **Yes** (`layout.template`). Load testing still **492 KB**. |
| Long first paint / session death | **github_stats** unobserved; reused session died. One-shot recovers. |
| Interrupt vs dedicated | Headlines match; **deltas do not**. |
| Email / HTML | **True** for KPI + inlined Arrow, same iframe caveat. Prefer one-shot creates and fetch Arrow immediately. |

## Ninth trial (different questions, same host)

Same iframe base, still Streamlit **1.64.0**. OpenAPI + HTTP only. No GitHub,
no app source.

Artifacts: `work-tmp/agent-challenges/reports-r9/` (`probes.json`). The host
refused connections for about a minute after the first heavy create (867-row
enhancement catalog); naked `/_stcore/health` stayed refused while the iframe
health check recovered. Later calls retried. `flaky_tests` (60 s),
`issue_reactions` (100 s), and `community_prs` (90 s) returned no status.
`github_stats`, unobserved in round 8, returned in **51 s**.

### What changed on the wire since round 8

| Probe | Result |
| --- | --- |
| Version / `servers` / `Link` | Still **1.64.0**, `servers: [{url: "/"}]`, **no** `Link` |
| MCP in OpenAPI `paths` | Still **absent** (interact + openapi only) |
| `run_timed_out` | **Named in the OpenAPI text.** No call returned **202**. Slow creates either finished 200 or the client gave up. |
| `query_params` description | Now says a page that binds none of them drops them, and that URL state is not the filters. |
| Selectbox `props.index` | **Absent.** Spec selectbox props are `accept_new_options`, `disabled`, `filter_mode`, `label`, `label_visibility`, `on_change`, `options`. |
| `chart_data` | On AI metrics it is under **`data`**, not `props`. |
| Top-level `fragments` | **Absent** on every 200 (`schema_version` 1). |
| MCP `initialize` `2025-06-18` | **200**, negotiated that version. |
| MCP `tools/call` `{page: spec_renderer}` | **200** with `structuredContent` (`app_title` Spec renderer) **and** a JSON text block (5.3 KB). |
| `page` + `widget_state` on an existing session | **400** `invalid_request`: navigation is a separate transition. |
| Same fields on a **creating** call | **400** `invalid_request`: keys do not exist yet. Empty `trigger: {}` on create is the same code, not a rerun. |

`label` does **not** follow the new drop sentence. After `type:bug` +
`priority:P2` on Open issues, `page: spec_renderer` still reported
`query_params.label`. Spec’s own widgets are refresh / View / spec selectbox;
there is no label widget on that page. A wiki `file` param **was** dropped on
the same navigation (`query: {}`). Page-local binds clear. `label` stays.

### Challenges (answers from this snapshot / Arrow only)

**Open enhancements.** One-shot `label: ["type:enhancement"]`: caption and
`row_count` **867** issues, **11,969** reactions, **193,178** views. Arrow
867 rows. Only **one** issue carries a priority label (`priority:P4`).
Summing `total_reactions` on `feature:*`: `st.dataframe` 1,002,
`st.data_editor` 977, `st.file_uploader` 608, `st.column_config` 488.
Highest `importance`: standalone HTML export (#611, 351 reactions, 3,456
views), `file_uploader` returning a path (#904, 290 / 1,797), required form
fields (#7165, 153 / 1,054). `reproducible_example` is true on **46** rows.

**Open bugs, and which P2s.** `type:bug`: **115** issues, **967** reactions,
**24,523** views (115 and ~962 / ~24,467 yesterday; the count held, the
engagement moved). P2 ∩ bug is now **2** issues, **7** reactions, **39**
views — not yesterday’s single Safari pills bug. Arrow, fetched before the
hash expired: Custom Components v2 trigger lost when another widget updates
(#17215, 4 reactions); selectbox clears on rerun when `format_func` returns
a new value (#17175, 3). The previous bug-catalog hash **404**’d once the
P2 filter replaced it.

**Bug explorer, low-engagement preset.** Defaults: priority P3, max **4**
reactions, max **3** comments, min **90** days since update, max **100**
views, segmented control “Move Priority Down”. Setting priority to P2+P3
and min days to **14**, leaving the caps, finds **13**. First titles:
multiselect Enter no longer inserts the filtered option; nested `run_every`
fragment stays visible with stale content; custom component cannot own `r`
or `c`; `st.user` empty when an external auth token shares the XSRF
subprotocol slot; deleting a `session_state` key leaves the frontend stale.
Min days **−5** is 400 `invalid_value` (minimum 0). The “low-engagement”
caption stayed, and it was still true: the reaction/comment/view caps were
unchanged.

**AI Issue Triage vs the mosaic.** All workflows: **3,061** runs, **95%**
success, **147** failed, average **9m 20s**, median **7m 31s**. The
“AI Issue Triage” tile is **326** runs / **98%** / **3m 46s**. Setting the
pills to only that workflow (0.9 s) reproduces those numbers exactly, plus
**7** failed and median **2m 48s**. The same label is still both the run
count and the duration. A creating-call
`query_params.ai_usage_workflows=["AI QA Testing"]` is stored and does
**not** change the pills (still all three). After the pill patch,
`query_params` is `{}`.

**Pytest performance.** 14 s. `query_params.tab: ["Runs"]` matches the
segmented control (this one is bound). Seven Plotly figures, `spec_omitted:
["layout.template"]`, ~11 k characters each; snapshot **89 KB**. Dataframes
of **50** and **7** rows, both `complete: true`. Caption: click a datapoint
for the commit SHA. `actions` are the tab plus two buttons, not the charts.

**Lighthouse.** 4.6 s. Same bound `tab: ["Runs"]`. No metrics. Altair chart
and dataframe share **one** `/media/…` URL, **112** rows, `complete: false`.
Snapshot **29.8 KB**. Same click-a-datapoint caption.

**Wheel size.** Average **9.6 MiB**, minimum **9.6**, maximum **9.8**.
Arrow `size_human` is display text: newest **9.7 MiB**, oldest **9.6 MiB**,
100 rows. Not a number a client can average again.

**Frontend coverage.** Lines **95.84%** (−0.01), functions **95.84%**
(+0.04), branches **89.05%** (+0.06). The Arrow is **50 commits**
(`lines_pct`, `functions_pct`, `branches_pct`), not files. Caption says
select a row; that dataframe is not in `actions`. A file uploader sits on
the page (“Manual upload of Vitest coverage JSON”). Snapshot **101 KB**,
one Plotly spec **69 k** characters.

**GitHub stats.** **51 s**, snapshot **194 KB**. Merged PRs **4,716**,
median time to merge **29.1 h**, median time to first review **1.7 h**,
LOC changed **2,011,258**, issues created **3,820**, closed **3,399**,
median time to close **17.9 days**. Caption: merged into `develop` since
2022-04-01, excluding PRs open more than 60 days.

**Spec view.** Segmented control `Approved` / `In review`, no `index`.
Switching to “In review” is 200 in 2 s.

### Previously open, now different

- **Selectbox `props.index`.** Not on this host. Trust `value`; there is no contradicting index to ignore.
- **AC, partly.** `structuredContent` arrives when the client speaks MCP `2025-06-18`. OpenAPI `paths` still do not list MCP, so a client that only reads `paths` will not find it.
- **AD, partly.** `github_stats` is reachable (51 s this run, >180 s in round 8). The host still drops connections and still does not answer some creates inside 60–100 s, and it does not use the documented 202 while that happens.
- **X, partly.** Wiki `file` is cleared on navigation. Open-issues `label` is not.

### New issues this round

**AH. The drop rule in the OpenAPI text is not what `label` does.** The
document says navigating to a page that binds none of the current parameters
drops them. Spec renderer binds none of `label` and still returned
`label: ["type:bug", "priority:P2"]`. Wiki `file` on that same transition
became `{}`. Citing `query_params` is still wrong; citing “the server drops
whatever the new page does not bind” is wrong for `label`.

**AI. `run_timed_out` is documented and not what a slow call looks like here.**
Three creates sat until the client timeout (60 s, 90 s, 100 s) with no 202
and no snapshot. Separately, the process refused TCP for a stretch, including
after a single large Open-issues create. A retry against iframe `/_stcore/health`
recovered; the naked origin’s health check did not, in that window.

### Scorecard deltas

| Item | Ninth trial |
| --- | --- |
| One-shot bound `query_params` | **Works** (`label`, wiki `file`, pytest/lighthouse `tab`). Unbound AI pills still do not seed. |
| Arrow | **Works** when fetched immediately. P2 titles came from that fetch. The previous hash **404**’d. |
| `props.index` | **Gone** on the widgets this round inspected. |
| `query_params` after `page` | Wiki `file` **dropped**. Open-issues `label` **kept**. |
| MCP `structuredContent` | **Present** at protocol 2025-06-18. Path still not in OpenAPI. |
| `page` + `widget_state` | **400** on an existing session. |
| `github_stats` | **200** in 51 s. |
| `run_timed_out` 202 | **Not observed.** |
| Click / row-select captions | Still not in `actions` (pytest, lighthouse, frontend coverage). |
| Email / HTML | **True** for these KPIs and for the 2-row P2 Arrow, if `/media/` is fetched before the next filter. |

## Tenth trial (two new Vega apps)

Library as of this branch, `x-streamlit-version` **1.64.0**, `schema_version` 1.
Four callers, OpenAPI only, no app source. Apps on localhost with
`server.enableAgentApi`: Delay network (`flights-10k`, port 8531) and Strike
ledger (`birdstrikes`, port 8532). Notes:
`work-tmp/agent-challenges/r10/reports/`.

### Answers (matched an independent aggregate)

**February 2001, PHX, late means delay greater than 15, minimum group size 20.**
SAN is the highest late-rate destination: **28** flights, **10** late, rate
**0.357143**, mean delay **24.8571** min, median distance **304** miles. PHX
that month: **202** flights, rate **0.301980**, mean **14.5743**. All origins:
**3110** flights, rate **0.233762**, mean **10.0653**. Route page for PHX→SAN
repeats the 304-mile median. Busiest hour is **12** (4 flights, mean delay
23.5). Changing only the hour slider left the full-app run counter still and
incremented the hour-inspector counter.

**Year 2000, costly means cost greater than zero.** Canada goose: **20**
strikes, **$4,187,957**, **10** costly. Year: **1065** strikes, **40** costly,
**$7,259,985**, top phase Approach **495**. Night: **371** strikes, **4**
Substantial (those 4 are a base64 int16 array inside the Plotly spec, not a
table). Dallas/Fort Worth has the most strikes (**103**, **$0**). Philadelphia
has the highest cost (**22** strikes, **$3,367,644**). The species inspector
changed species without moving the full-app counter.

**Briefing.** Email and static HTML for February PHX cite app title, page
title, empty `url_path`, `observed_at` `2026-10-02T11:08:35Z`, and the active-filter
caption. `query_params` on that snapshot was `{}`. The destination table was
inlined from Arrow. The histogram needed no URL: delays sit in `spec` as
`bdata`. A scatter `data.url` returned all 202 rows and was inlined. Those
media URLs still answered 200 a few minutes after the element left the page.

### What this round could drive

Value widgets on both apps, including cascading destination options, a range
slider that stays disabled until a checkbox, multi pills, `select_slider`,
date, time, color, and feedback. Forms reject fields without that form’s
submit (`400 missing_form_submit`) and accept one `FormSubmitter:…` trigger.
Menu options reject unknowns with `400 invalid_value` and the legal list.
Chat replies show up as `chat_message` markdown. Lazy tabs omit the unselected
chart. Eager desk tabs include both children. A popover’s selectbox is in
`actions` while `open` is false. Download buttons expose `props.url` before
the trigger; GET returns the CSV. Fragments rerun alone. Handled
`st.exception` stays `status: ready`. An uncaught raise is HTTP 200
`status: error` and the next interact is `ready`.

MCP `POST /_stcore/agent/v1/mcp` is an OpenAPI path. `initialize` negotiates
`2025-06-18`. `tools/call` returns `structuredContent` and a text block. GET
is 405 with an empty body.

### Previously open, now different

| Issue | Tenth trial |
| --- | --- |
| MCP missing from OpenAPI `paths` | **Fixed.** The path is listed. GET is still an empty 405, not the JSON error envelope. |
| Dialog key not in `actions`; no dismiss | **Partly fixed.** While open, `actions` includes `confirm_clear_*` and the dialog key `$$ID-…-None`. Firing that key closes the dialog and keeps the note. Confirm clears the log. There is still no control labeled dismiss. |
| `st.mermaid_chart` is `markdown` | **Not this round.** The node type is `mermaid_chart` and the source is `props.body`. |
| `unknown_page` without pages | **Still fixed.** `404 unknown_page` includes `session_id` and `error.pages`. The message says the default page ran. |
| Fragment-scoped rerun | **Works** on the hour slider and the species selectbox. |
| One-shot bound `query_params` | **Works** (`month`, `origins`, `late_minutes`, `exclude_early`, `strike_year`). Values come back as string lists; widgets are typed. |
| `clear_on_submit` | **Still open.** See below. |

### New or sharper this round

**AJ. A stale `query_params` entry is applied again on navigation and overwrites a later edit.**
On Delay, clearing `origins` to `[]` updated the widget and left the previous
list in `query_params`. The next `page` put that list back. On Strike, a
session created with `strike_year: ["2000"]` then set to `2001` kept
`query_params` at 2000; navigating to Airport restored the year widget to
2000. The navigation snapshot itself often shows `query_params: {}` while the
widgets still hold the values, and a later rerun or a return to the first page
puts the echoed keys back. Echo is not uniform: Delay wrote `month`,
`origins`, `late_minutes`, and `exclude_early` into `query_params` on some
patches; Strike’s year slider on a session whose query string was still empty
did not echo until a later page, while `costly_only` did echo once a query
string already existed. Bool strings flipped between `True` and `true` across
a round trip.

**AK. Unbound keys are stored in `query_params` and do not change the widget.**
A creating call with `min_flights: ["100"]`, `wildlife_size: ["Large"]`,
`time_of_day: ["Night"]`, or `limit_distance: ["true"]` echoes those keys and
leaves the widgets at their defaults. The help text on minimum flights, size,
and time of day says they are not bound. Citing `query_params` from that
snapshot describes filters the page did not apply. Metrics stayed on the
unfiltered catalog (10,000 flights, 10,000 strikes).

**AL. An open expander’s body is the next sibling, not `children`.**
`definitions` with `expanded: true` has `children: []`. The methodology
paragraph is the following `markdown` node. The same shape holds for the
strike field-name expander. A closed expander does not include that paragraph.
Lazy tabs, by contrast, put the open tab’s charts in that tab’s `children`
and leave the others empty.

**AM. `st.progress` reports an integer percent.** The app passed a 0–1 late
rate. The snapshot says `value: 20` next to text `Late rate 20.7%`. Page
metrics are display strings (`"10,000"`, `"14.6 min"`, `"30.2%"`,
`"$40,545,276"`). The hour-fragment metric is the exception: numeric `value`
plus `display_value`. `st.json` `props.body` is a string. Feedback sent as
`4` comes back as `"4"`, and `props.options` is `"stars"` rather than a list.

**AN. Plotly `complete: true` is not an Arrow table.** The histogram inlines
`{dtype: "i2", bdata: …}` and sets `spec_omitted: ["layout.template"]`. No
`url`. Selection is `support: read_only_in_v1` (`400 unsupported_element`).
ECharts is an inlined spec, also `complete: true`, also no Arrow. `st.map` is
`complete: true` with `row_count` and a media URL, but no `preview` and no
`columns`; the points are in the deck layer and in that Arrow file. A native
`line_chart` spec still carries `width: 0` and `height: 0`. Altair, bar, and
scatter on these pages have both a spec and Arrow.

### Scorecard deltas

| Item | Tenth trial |
| --- | --- |
| Drill-down numbers | **Match** the Vega aggregates, from captions and from Arrow/CSV. |
| Fragment rerun | **Works.** Full-app counter stays; fragment counter moves. |
| `clear_on_submit: true` | **Still does not clear** on save or discard, on both apps. The success line is what shows the submit landed. |
| `query_params` as the filter citation | **Unsafe.** Empty, stale, partial, or holding unbound keys. Widget values and the active-filter caption matched the numbers. |
| Lazy tabs | **Honest.** Unselected charts are absent. |
| Dialog dismiss | **Possible**, via `$$ID-…-None`. |
| Read-only selection, editor, uploader, Plotly select | **`400 unsupported_element`.** A selection key the current filter does not render is **`409 not_on_page`**. Disabled writes are **`409 disabled_widget`**. |
| MCP | **In OpenAPI**, with `structuredContent`. |
| Email / HTML | **True** for this KPI briefing if the exporter trusts captions over `query_params` and inlines Arrow or `bdata` immediately. |

## Remaining issues (prioritized)

### 1. `clear_on_submit`

Form `clear_on_submit: true` still leaves submitted field values in the snapshot.
The tenth trial saw this on save and on discard, on both apps, including the
next interact. Lazy expanders are addressable, but an open expander’s
paragraph is the next sibling: `children` stays empty.

### 2. `props` that contradict `value`

Selectbox `props.index` stayed at the authored default in the kitchen-sink
trials. On the live host in round 9 the spec selectbox no longer sends
`index` at all. Trust `value`.
Pills/`format_func` now round-trip: snapshot `value` is the formatted label.

### 3. Query params and citation of filters

Unchanged from earlier trials: string query params coerced; no structured
`applied_filters`. **New from the live app:** `query_params` is session-global
for some names. Round 8: after P3 ∩ bug, Python coverage still showed
`label: ["type:bug", "priority:P3"]`. Round 9: the OpenAPI text now says a
page that binds none of them drops them. Wiki `file` did drop when navigating
to Spec renderer. Open-issues `label` did not — Spec renderer has no label
widget and still returned `label: ["type:bug", "priority:P2"]`. A creating-call
`query_params.ai_usage_workflows` was stored but did **not** seed the pills
(those keys are not bound). Bound ones (`label`, wiki `file`, pytest `tab`)
do seed on create. Do not cite `query_params` as “the filters that produced
this page.”

**Tenth trial, local Vega apps.** One-shot bound params still seed the
widgets, and the echo is a list of strings (`late_minutes: ["30"]`,
`exclude_early: ["True"]`, later `["true"]`). A later `widget_state` edit
does not reliably replace that echo. Navigation then reapplies the stale
entry (cleared origins come back; year 2001 reverts to the created 2000)
while the navigation snapshot often shows `query_params: {}`. Unbound create
params (`min_flights`, `wildlife_size`, `time_of_day`, `limit_distance`) are
stored and do not move the widget. The active-filter caption and the widget
`value`s matched the numbers. `query_params` did not.

### 4. Surfaces without a full data contract

Vega/Altair charts and **`st.map` now have Arrow.** **`st.echarts_chart` and
`st.plotly_chart` do not.** Plotly reports `data.complete: true` with the
figure `spec` inlined and now names `spec_omitted: ["layout.template"]`.
Small coverage figures are a few kilobytes; load testing was still
**492 KB** (twelve ~38 k-char specs) and Playwright performance **317 KB**.
Displayed `st.exception` still flips interact `status` to `error` when the
exception is uncaught. A handled `st.exception` stays `status: ready`.
On the tenth trial `st.mermaid_chart` is its own node and the source is
`props.body`. Plotly `complete: true` can be a `bdata` blob with no Arrow
URL. `st.map` has an Arrow URL and no `preview` or `columns`. A native
`line_chart` spec still has `width: 0` and `height: 0`. `st.progress`
`value` was the integer `20` beside `Late rate 20.7%`.

### 5. Other papercuts

- **Watchlist `wl_title.options`** dumps ~3176 strings into every snapshot on that page. Live Issue explorer dumps 497 / 157 / 591 / 256 the same way.
- **Generated keys** are the default on a real app. Copy from `actions`; do not persist.
- **Iframe / embed prefix** is required on Community Cloud (`/~/+/`). OpenAPI now has `servers: [{url: "/"}]`; that only helps if the document was fetched under the prefix. Naked origin is still 303. `Link` is still stripped.
- **MCP** is an OpenAPI path as of the tenth trial (`POST /_stcore/agent/v1/mcp`). `structuredContent` arrives at protocol `2025-06-18`, with a JSON text block beside it. GET is 405 with an empty body, same as GET interact.
- **`clear_on_submit`** is advertised and not applied (see #1).
- **Tabs** with `on_change="rerun"` are now addressable. Eager tabs still dump every child.
- **Metric values** are still display strings when the author formats them (`98.88%`, `9m 5s`). Duplicate labels collide (AI usage, load-testing scenarios). On this host `chart_data` is under `data`.
- **Empty interact is a rerun**, not a read. Empty `trigger: {}` on a creating call is **400** `invalid_request`.
- **`page` + `widget_state`** on an existing session is **400** `invalid_request`.
- **`run_timed_out`** is described as **202**. This host’s slow creates did not return it.
- **Catalog preview order** is not “top by the page’s sort.”
- **Plotly / echarts** inline a spec with `complete: true` and no Arrow (`spec_omitted` drops the theme only).
- **Dataframe and chart selection** are not in `actions`; captions may still say “click.”
- **Dialog dismiss** is the generated trigger `$$ID-…-None`, listed in `actions` while the dialog is open. Firing it closes the dialog and leaves the saved note. Confirm is a separate trigger. There is still no control labeled dismiss.
- **`st.json` body is a string.** Feedback `value` is a string (`"4"`) and `props.options` is `"stars"`, not a list. `page_link` to a default page whose `url_path` is `""` omits `page`.
- **Popover children** are in the tree and addressable while closed.
- **Long first paints / dead sessions** on this host: `github_stats` >180 s; reused `session_id` ended in connection refused. Prefer one-shot `{page}` creates.
- **`unknown_page.pages`** is now populated (was AA).

## Downstream tasks specifically

The spec’s claim is that one observation layer serves email reports and static HTML
without Streamlit growing a mailer or an exporter.

**Round 1:** true for KPI + definition briefings; not yet true for complete tables and
charts (callers filtered an *unfiltered* Arrow because the *filtered* table had no URL).

**Round 2:** true for KPI + definition briefings **and** for a complete dump of the
current filtered catalog, if the exporter fetches `data.url` immediately and inlines
it. The HTML briefing used this snapshot’s 34-row Japan Arrow. The email named
Paramount from this snapshot’s 206-row Drama Arrow. Neither used the round-1
workaround. Neither hot-linked `/media/...`.

What the snapshot now gives those consumers:

- Metrics, captions, help, expander bodies (even collapsed)
- Widget `key` / `label` / `value` for citation of filters
- `app_title`, `page.title`, `url_path`, `observed_at` (after a fragment-scoped
  interact, check `fragments[].rendered` before citing a number as of that instant)
- Complete small tables (`complete: true`)
- Arrow for truncated *and* mid-size filtered tables and for charts, from the
  **current** snapshot
- One-shot `query_params` so “run this parameterized report” is one POST

What they still invent:

- Walking widgets for “applied filters” (and a footnote when a second page does not
  share them)
- Trusting `value` over `props.index`
- Not embedding `/media/...` (correct; unique hashes 404 once unreferenced)
- Fetching `st.map` Arrow immediately (the Deck.gl `spec` is still inlined)

A real exporter no longer needs a guaranteed-complete-or-URL patch for Vega charts,
dataframes, or maps in this trial. It would still want structured `filters`, numeric
metric values, and an Arrow path for `st.echarts_chart`. Chart *figures* are still
not in the snapshot; the associated Arrow table is the exportable meaning.

**Round 7 (live Issue explorer):** still true for KPI + definition briefings and
for a complete dump of the *current* open-issue slice, if the exporter uses
the iframe base `https://issues.streamlit.app/~/+/` for both interact and
`/media/…`. The HTML briefing inlined the interrupt metrics and the 109-row
`type:bug` Arrow. It did not call GitHub. Plotly pages were cited from
metrics and Altair/dataframe Arrow, not from figure specs. `query_params`
was not used as a citation of filters after a later `page` change.

**Round 8:** still true if the exporter **one-shots** each page (do not
reuse a session across many heavy navigations) and fetches Arrow before
the next filter (the 115-row bug Arrow 404’d after P2). Cross-page
comparisons need the page named: Interrupt Playwright delta ≠ Playwright
stats delta. Load-testing scenario filters are not safe to cite from
duplicate metric labels. MCP `tools/call` is an equivalent observe path
for the landing snapshot, with the snapshot nested as text.

**Round 9:** still true. MCP `2025-06-18` also returns `structuredContent`,
so a client that negotiates that version does not have to parse the text
block. The 2-row P2 Arrow was inlined only because it was fetched in the
same breath as the snapshot; the previous hash was already 404. GitHub
stats (194 KB) and the enhancement catalog (867 rows) are the same shape
of briefing: metrics and captions from the snapshot, tables from Arrow,
figures left as `spec_omitted` charts.

**Round 10:** still true for a February PHX briefing, with one extra
footnote. The email cited the active-filter caption and the widget values.
`query_params` on that snapshot was empty, and on other sessions it was
stale or held keys the page did not apply. The HTML inlined the 3-row
destination Arrow and two extremes from a 202-row scatter Arrow. The
histogram was inlined from Plotly `bdata`, not from a media URL. Media URLs
in that session still returned 200 after the chart had left the tree; the
exporter fetched them before relying on that.

## First trial (baseline)

Same apps and challenges, before the patches. All five completed without a browser.
Callers recovered from the data hole by fetching an earlier unfiltered Arrow and
filtering client-side. `page.title` was always the app name. Disabled sliders and the
uploader returned `not_on_page`. Unknown page on create was 200. Empty `trigger: {}`
was a rerun. Dialogs were undescribed and clickable. Error responses had no `Link`.

Artifacts: `work-tmp/agent-challenges/reports/` (not `reports-r2/`).

## Verdict

v1 is a usable **observe → act → observe** loop on both kitchen-sink apps and
a real 21-page Community Cloud dashboard: value widgets (including generated
keys), bound one-shot `query_params`, Altair/dataframe Arrow, lazy expanders,
pills/dates that reject bad input, and fragment-tagged regions. After the
honesty patch the snapshot is honest on the holes the fourth trial named.
After the fragment work, acting inside a region reruns only that region.

On the live host the new load-bearing facts are **where** to send the
request (`/~/+/` on Community Cloud, including `/media/`) and **not** to
treat `query_params` as the current page’s filters after a navigation.
OpenAPI `servers: [{url: "/"}]` confirms the prefix only if the document
was fetched from it. Plotly is not a data contract, even with
`spec_omitted`. Dataframe clicks are not actions. MCP `interact` works
beside HTTP. Some pages never return inside 180 s; a reused session can
vanish. Email and HTML still work if the exporter one-shots the page,
fetches iframe-prefixed Arrow immediately, and inlines it — that is how
the 115-row `type:bug` catalog, the 2025 closer table, and the interrupt
metrics were cited, without GitHub. Round 9 added the enhancement catalog,
the two current P2 bugs, and the GitHub-stats KPIs the same way. `label`
in `query_params` is still not a citation of the page you are on. Round 10,
on two local Vega apps, is the same citation rule with a sharper failure:
a stale query param is written back onto the widgets at the next page
change, and an unbound param can sit in `query_params` without filtering
anything. Fragments, lazy tabs, one-shot bound params, Arrow, and MCP
`structuredContent` held. `clear_on_submit` still does not clear.
