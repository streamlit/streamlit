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

Six trials, same protocol, growing app set. The first found holes where the
snapshot was dishonest. Later trials re-ran after patches. The fifth added an
element gallery to sweep many `st.*` commands at once. The sixth is the first
that can drive `@st.fragment` regions and `st.dialog` bodies the way a browser
would.

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

## Remaining issues (prioritized)

### 1. `clear_on_submit`

Form `clear_on_submit: true` still leaves submitted field values in the snapshot.
Lazy expanders of the same shape as lazy tabs are now addressable.

### 2. `props` that contradict `value`

Selectbox `props.index` stays at the authored default. Trust `value`.
Pills/`format_func` now round-trip: snapshot `value` is the formatted label.

### 3. Query params and citation of filters

Unchanged: string query params coerced; `widget_state` does not write
`query_params`; navigation can desync them; no structured `applied_filters`.

### 4. Surfaces without a full data contract

Vega/Altair charts and **`st.map` now have Arrow.** **`st.echarts_chart` does
not** (option inlined in `spec`). Map nodes omit `row_count`. `st.status`
now reports `complete`. Displayed `st.exception` still flips interact
`status` to `error`. `st.mermaid_chart` is `markdown`.

### 5. Other papercuts

- **Watchlist `wl_title.options`** dumps ~3176 strings into every snapshot on that page.
- **`clear_on_submit`** is advertised and not applied (see #1).
- **Tabs** with `on_change="rerun"` are now addressable. Eager tabs still dump every child.
- **Metric values** are still display strings when the author formats them; `display_value` duplicates `props.value`. `chart_data` is under `data`.
- **Empty interact is a rerun**, not a read.
- **Catalog preview order** is not “top by the page’s sort.”
- **Dialog overlay** still has a generated tree `key` that is not in `actions` (acting on it is `unknown_key`). Confirm *is* in `actions` while the dialog is open.
- **No dismiss action.** `props.dismissible: true` is advertised; closing is a full rerun, not an overlay-only X.
- **Popover children** are in the tree and addressable while closed.

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

## First trial (baseline)

Same apps and challenges, before the patches. All five completed without a browser.
Callers recovered from the data hole by fetching an earlier unfiltered Arrow and
filtering client-side. `page.title` was always the app name. Disabled sliders and the
uploader returned `not_on_page`. Unknown page on create was 200. Empty `trigger: {}`
was a rerun. Dialogs were undescribed and clickable. Error responses had no `Link`.

Artifacts: `work-tmp/agent-challenges/reports/` (not `reports-r2/`).

## Verdict

v1 is a usable **observe → act → observe** loop across a wide `st.*` surface:
value widgets (including dates, pills with `format_func`, datetime, color,
feedback, pagination), Vega/Altair charts, maps (Arrow), lazy tabs and
expanders, forms, chat, **fragment-scoped reruns**, **driveable dialogs**,
and one-shot `query_params`. After the honesty patch the snapshot is honest on
the holes the fourth trial named (pills, dates/shapes, map Arrow, status,
tabs). After the fragment work, acting inside a region reruns only that
region, and an open dialog stays open until a full rerun.

What is left is narrower: `clear_on_submit` does not clear; echarts has no
Arrow; a displayed `st.exception` marks the interact `error`; mermaid is
markdown; query_params can still diverge; a dialog has no dismiss short of a
full rerun. Those do not block the spec’s email/HTML examples. Clients that
need to finish a dialog must do it before touching anything else.
