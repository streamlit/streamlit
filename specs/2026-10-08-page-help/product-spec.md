---
author: lukasmasuch
created: 2026-10-08
---

# Page help (`help` on `st.Page`)

## Summary

Add `help` to `st.Page`: one sentence that says what a page is. It is the tooltip on the page's nav item, the default tooltip for `st.page_link` to that page, and the page's hint in the agent snapshot. It is known when `st.navigation` declares the page, so the nav and an agent can show it for pages that have not run. A meta description for search and link previews is not part of this spec. It needs metadata declared before the script runs, and stays with the `st.App` follow-up ([#9058](https://github.com/streamlit/streamlit/issues/9058)).

```python
import streamlit as st

revenue = st.Page(
    "revenue.py",
    title="Regional revenue",
    icon=":material/payments:",
    help="Net revenue by billing region. Excludes refunds. Periods are UTC.",
)

st.navigation([revenue]).run()
```

## Problem

[#16878](https://github.com/streamlit/streamlit/issues/16878) asks for a first-class page description. A page can already declare `title` and `icon`. There is no matching place to say what the page is. Authors put that sentence in `st.caption`, `st.markdown`, or `menu_items["About"]`, none of which is structured metadata and none of which the nav can show before the page runs.

Two readers need that sentence before the page runs:

- **Navigation.** `st.Page` can name a page and cannot explain it, so a nav list cannot tell "Regional revenue" apart from "Reports" without running the page. `st.page_link` already has a hover tooltip (`help`), but the built-in nav does not, and the link's tooltip is not shared with the page.
- **Agents.** The agent snapshot ([#16843](https://github.com/streamlit/streamlit/pull/16843)) identifies each page by `url_path`, `title`, and `icon` only. Widget `help` is already in the snapshot; the page itself has no equivalent, so a model has to infer what "Regional revenue" means from body copy such as `st.caption`. That fails when the meaning is not on the page, and it fails for every page the agent has not opened, where the only way to find out is to run it. [#16843](https://github.com/streamlit/streamlit/pull/16843) lists this as its authored-descriptions follow-up.

Search snippets and link previews also want a page description ([#16634](https://github.com/streamlit/streamlit/issues/16634), [#2469](https://github.com/streamlit/streamlit/issues/2469), [#6567](https://github.com/streamlit/streamlit/issues/6567)). They read `<meta name="description">` and `og:description`, mostly from the initial HTML, and on Community Cloud and SiS from the top-level document outside the app iframe. A value the script sets while it runs can only reach the live iframe document, which misses both. That is the same gap as the page title, so it is left to static metadata on `st.App` (see [Out of Scope](#out-of-scope-future-work)).

## Proposal

### API

`help` on `st.Page`, keyword-only, next to `title` and `icon`:

```python
st.Page(
    page: str | Path | Callable[[], None],
    *,
    title: str | None = None,
    icon: str | None = None,
    url_path: str | None = None,
    default: bool = False,
    visibility: Literal["visible", "hidden"] = "visible",
    help: str | None = None,
)
```

- `help` accepts the same Markdown as other `help` parameters, because the nav tooltip renders it.
- The value is dedented, so a triple-quoted string can be indented with the script.
- `None`, `""`, and a value that is empty after dedenting and stripping set nothing. `Page.help` returns `""` when unset. Unlike `icon`, nothing is inferred, so `None` and `""` match. `icon=""` forces no icon, and omitting `icon` can still take a filename emoji.

### Behavior

**Nav tooltip.** The built-in nav item (sidebar, top nav, and the overflow menu) shows `Page.help` as a tooltip, including on the open page. Pages that are not running show it as soon as `st.navigation` declares them, without executing those pages. An external-URL `st.Page` can set `help`; the tooltip is on its nav item. A page with `visibility="hidden"` has no nav item and so no tooltip, but the snapshot and inheriting `st.page_link` calls still use its `help`. A `pages/` app has no `st.Page`, so its nav items get no tooltip from this feature.

Like `st.page_link`, the tooltip opens on hover over the item itself and has no question-mark icon:

- Hover waits 1000ms, because the pointer crosses the nav on the way to most clicks. `st.page_link` and button help keep 500ms.
- Once one tooltip has opened, the shared tooltip warm-up opens the next item's tooltip right away, so scanning the list waits only once.
- Keyboard focus opens it immediately. Touch shows no popup.
- The nav link always exposes the sentence as its accessible description, at every breakpoint and while the popup is closed. The nav item renders `help` with the help Markdown renderer into a hidden element that the link's `aria-describedby` references, so links in it add no tab stops. That render is reused until `help` changes, so an app with many pages does not re-render every sentence on each nav update. There is no backend pass that strips Markdown.
- The popup is hidden from assistive tech, so keyboard focus announces the sentence once.

The always-present accessible description applies only to the built-in nav item. `st.page_link` keeps its current tooltip behavior: below the small breakpoint it shows no tooltip, and it references the tooltip as its description only while the tooltip is open. Inheriting `Page.help` changes the tooltip text, not that behavior. Buttons, popovers, and badges share that tooltip code, so changing it would change all of them.

**`st.page_link`.** The link's `help` is the tooltip for that link and nothing else.

- Omitted `help` inherits the target page's `Page.help` when the argument is a `Page` or a path to a registered page.
- `help=""` shows no tooltip even when the page has one, same as `icon=""`.
- An external URL string inherits nothing.
- An instructional string passed to `st.page_link` stays on that link.

Inheriting from a path goes further than icon inheritance: `st.page_link` copies `icon` only from a `Page` object, so the page registry has to store `Page.help` for the path lookup. Several `st.Page` objects can share one script when their `url_path` values differ. `st.page_link("revenue.py")` already selects the first registered page with that `script_path`, and inherited `help` comes from that same page, so the label and the tooltip stay together.

**Agent snapshot** ([#16843](https://github.com/streamlit/streamlit/pull/16843)). The snapshot stores `Page.help` under `help`, next to `title` and `icon`, as the dedented Markdown. Page entries use the `st.Page` parameter names, and widget `help` is already reported as `help`. The current page and each `pages` entry use that page's `Page.help`. A page without `help` has no `help` key. An agent can choose a page without running it. The snapshot already lists pages ([#17527](https://github.com/streamlit/streamlit/pull/17527)), so this adds one optional field to each page entry and to the page schema the protocol publishes.

`Page.help` is not written into the document and is not shown as body text. It does not fill `<meta name="description">`, `menu_items["About"]`, the browser-tab title, or the nav label. A visible subtitle remains `st.markdown` or `st.caption`.

There is no length limit and no error for a long string. Docs should suggest one or two sentences, since the tooltip and every snapshot carry it.

### Examples

A tooltip on each page:

```python
# streamlit_app.py
import streamlit as st

revenue = st.Page(
    "revenue.py",
    title="Regional revenue",
    icon=":material/payments:",
    help="Net revenue by billing region. Excludes refunds.",
)
costs = st.Page(
    "costs.py",
    title="Costs",
    help="Operating costs by team, in EUR.",
)

st.navigation([revenue, costs]).run()
```

A link can keep the page sentence or replace the tooltip locally:

```python
st.page_link(revenue)  # tooltip is revenue's help
st.page_link(revenue, help="Opens revenue and keeps the current filters.")
st.page_link(revenue, help="")  # no tooltip
```

### Naming

**Option 1: `help`** ✅ PREFERRED

- Pros: The nav tooltip uses the same parameter as `st.page_link` and every other tooltip (API principles #7 and #10). `st.page_link` can inherit it under the name it already has.
- Cons: "Help" undersells the agent use. The docs have to say that the snapshot reports it.

**Option 2: `description`**

- Pros: The word [#16878](https://github.com/streamlit/streamlit/issues/16878) uses.
- Cons: `description` is not a public Streamlit parameter. The tooltip on `st.page_link` would stay `help`, so the nav and the link would use different names for the same hover text. It also reads like the meta description, which this spec does not set, so an author would expect search snippets they do not get.

Adopt **Option 1**.

## Out of Scope (Future Work)

- **A page meta description** (`<meta name="description">`, `og:description`), for example `page_description` on `st.set_page_config` ([#16634](https://github.com/streamlit/streamlit/issues/16634), [#2469](https://github.com/streamlit/streamlit/issues/2469), [#6567](https://github.com/streamlit/streamlit/issues/6567)). A value set while the script runs can only be written into the live app document by JavaScript. Link-preview crawlers read the initial HTML, and Community Cloud and SiS show crawlers the top-level document, so neither would see it; only a crawler that runs JavaScript against a self-hosted app would. It belongs with static metadata declared before the script runs, together with initial-HTML tags ([#9058](https://github.com/streamlit/streamlit/issues/9058)) and the rest of a social card (`og:title`, `og:image`, canonical URL). If a run-time value lands anyway, it should not go into the agent snapshot: it describes only the page the agent is already reading, and set in the entrypoint it is app-wide, the same ambiguity that keeps `page_title` out of the snapshot.
- **`title` and `description` on `st.App`.** Static app identity, and a description available before the script runs. The agent spec's static app descriptor depends on this ([#16843](https://github.com/streamlit/streamlit/pull/16843)). Tracked on [#16878](https://github.com/streamlit/streamlit/issues/16878). Page-level `help` in the snapshot does not wait on it.
- **Copying `Page.help` into meta tags.** That needs a Markdown-to-text pass kept in sync with the tooltip renderer.
- **A host-rendered nav that shows `help`.** `SET_APP_PAGES` already sends each page's `help` to the host (see the checklist), but no host nav shows it yet.
- **A document-level accessible description.** This version exposes `Page.help` on the built-in nav link only. `st.page_link` keeps today's tooltip.
- **Visible subtitle** under the page heading, and copying the sentence into the About dialog.

## Checklist

| Item | ✅ or comment |
|------|---------------|
| Works on SiS, Cloud, etc? | ✅ The tooltip and the accessible description use the existing nav inside the app iframe. The agent snapshot is served by the Streamlit server. `help` is an optional field on each page in the page list, and `SET_APP_PAGES` forwards that list to the host unchanged, so Community Cloud and SiS receive it. A host that does not read the field is unaffected. |
| No breaking API changes | ✅ One keyword-only parameter. Existing `st.Page` calls are unchanged. |
| No new dependencies | ✅ The stored string is dedented like every other `help` value. The tooltip and the accessible description reuse the help Markdown renderer. No Markdown-to-text package. |
| Metrics collected | ✅ `st.Page` is already wrapped with `@gather_metrics`. String arguments record length, not content, so the help text is not sent. |
| Any security/legal impact? | Author-controlled Markdown in the tooltip uses the existing help renderer. In the snapshot it is app text like page titles and widget help, which the agent protocol already tells clients to treat as data, not instructions. The snapshot reports nothing the browser does not receive, since the nav gets the same string. No new execution path. |
| Any docs changes needed? | ✅ The `st.Page` API page, inheritance on the `st.page_link` page, a short mention in the multipage-apps guide, and the `st.Page` examples in the bundled `developing-with-streamlit` agent skill (`references/multipage-apps.md`), so coding agents write one sentence per page. `help` is the nav tooltip and the agent hint. It does not set a meta description. |
