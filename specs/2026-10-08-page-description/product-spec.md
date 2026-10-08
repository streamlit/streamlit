---
author: lukasmasuch
created: 2026-10-08
---

# Page description (`help` on `st.Page`, `page_description` on `st.set_page_config`)

## Summary

Add an authored page description in the two places a page already has a title. `st.Page(help=...)` is the sentence for that page, shown as a tooltip on the nav item and on `st.page_link`, and available without running the page. `st.set_page_config(page_description=...)` overrides it for the current run. The resolved sentence is what search snippets, link previews, and an agent snapshot read.

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

[#16878](https://github.com/streamlit/streamlit/issues/16878) asks for a first-class page description. A page can already declare `title` / `page_title` and `icon` / `page_icon`. There is no matching place to say what the page is. Authors put that sentence in `st.caption`, `st.markdown`, or `menu_items["About"]`, none of which is structured metadata and none of which the nav can show before the page runs.

The same sentence is wanted in five places:

- **Navigation.** `st.Page` can name a page and cannot explain it, so a nav list cannot tell "Regional revenue" apart from "Reports" without running the page. `st.page_link` already has a hover tooltip (`help`), but the built-in nav does not, and the link's tooltip is not shared with the page.
- **Agents.** The agent snapshot in [#16843](https://github.com/streamlit/streamlit/pull/16843) identifies each page by `url_path`, `title`, and `icon` only. Widget `help` is already in the snapshot; the page itself has no equivalent, so a model has to infer what "Regional revenue" means from body copy such as `st.caption`. That fails when the meaning is not on the page, and it fails for every page the agent has not opened. `Page.help` is known when `st.navigation` declares the page, which is the same moment the snapshot's `pages` list exists. [#16843](https://github.com/streamlit/streamlit/pull/16843) lists this as its authored-descriptions follow-up ([#16878](https://github.com/streamlit/streamlit/issues/16878)).
- **Search snippets.** Google uses `<meta name="description">` when it describes the page better than body text. Self-hosted apps have no way to set it ([#16634](https://github.com/streamlit/streamlit/issues/16634), [#2469](https://github.com/streamlit/streamlit/issues/2469)).
- **Link previews.** Open Graph `og:description` is the preview body. Community Cloud injects sharing tags; other deployments do not ([#6567](https://github.com/streamlit/streamlit/issues/6567)).
- **The page itself, once it is running.** A page often wants a more specific sentence than the nav default ("Net revenue by billing region for the selected quarter").

`st.set_page_config` is where authors already set the browser-tab title. The description belongs next to it, with `st.Page` holding the default the same way it holds the default title.

This spec covers the page. App-level title and description on `st.App` stay in [#16878](https://github.com/streamlit/streamlit/issues/16878) and are out of scope here.

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

`page_description` on `st.set_page_config`, keyword-only. The existing parameters stay positional. A `*` is introduced before `page_description` if the command does not already have one.

```python
def set_page_config(
    page_title: str | None = None,
    page_icon: PageIcon | None = None,
    layout: Layout | None = None,
    initial_sidebar_state: InitialSideBarState | None = None,
    menu_items: MenuItems | None = None,
    *,
    page_description: str | None = None,
) -> None:
```

| Parameter | Command | Default | Role |
|-----------|---------|---------|------|
| `help` | `st.Page` | `None` | Default description for that page. Tooltip in the nav. Inherited by `st.page_link`. |
| `page_description` | `st.set_page_config` | `None` | Overrides the running page's description for this run. |

`help` accepts the same GitHub-flavored Markdown as other `help` parameters, because the nav tooltip renders it. `page_description` is plain text. Meta tags, link previews, and the agent snapshot store the string as text, so Markdown there would show up as raw syntax or have to be stripped before anyone sees it. Both values are dedented, so a triple-quoted string can be indented with the script. `None` and a blank string mean unset. `Page.help` returns `""` when unset, matching `Page.icon`.

`help` is the nav word because that is what `st.page_link`, buttons, and the other tooltip parameters are already called (API principles #7 and #10). `page_description` is the page-config word because that command's parameters are `page_title` and `page_icon`, and it is not a hover target. The two names are one sentence: `Page.help` is the default, `page_description` overrides it.

### Behavior

**One resolved description per running page.**

| Source | When it wins |
|--------|----------------|
| Last non-blank `page_description` passed to `st.set_page_config` in this run | Always, for the running page |
| `Page.help` of the running page | When this run did not pass a `page_description` |
| Nothing | Single-page apps, `pages/` apps, and `st.Page` calls that set neither |

Calls that omit `page_description` leave a value set earlier in the same run, same as `page_title`. A later call that passes a new string replaces it. Navigating to another page drops the previous run's override. The new page resolves its own description from scratch.

`Page.help` on the `Page` object does not change when `page_description` overrides the running page. Reading `page.help` returns what `st.Page` was given.

**Where the resolved sentence is published.**

- `<meta name="description">` and `<meta property="og:description">`. Tags are created or replaced when a description exists, and removed when the running page resolves to none, so a previous page's sentence does not linger. A host-injected description is left alone until an author description is set; after that, Streamlit owns these two tags for the session.
- The built-in nav item (sidebar, top nav, and the overflow menu), as a tooltip. `Page.help` is rendered as Markdown. A `page_description` override is shown as plain text.
- The nav link's accessible description, as plain text.
- The agent snapshot ([#16843](https://github.com/streamlit/streamlit/pull/16843)). The current page carries the resolved sentence next to `title` and `icon`. Every entry in `pages` carries that page's `Page.help`, so an agent can choose a page without running it. `page_description` changes the open page only. This spec does not define the agent endpoint; it supplies the sentence that snapshot was missing.

Published text is plain. `page_description` is used as written. `Page.help` is reduced to text first (Markdown markers removed, link text kept) when it is the description that fills a meta tag, an accessible description, or the snapshot.

The tooltip matches `st.page_link`: hover the item itself, no question-mark icon, and immediate open on keyboard focus. The hover delay is the button help delay (`HELP_TOOLTIP_HOVER_DELAY_MS`, 500ms), the same delay `st.page_link` already uses, rather than the 200ms shared tooltip default. On touch there is no popup; the link still exposes the plain-text sentence as its accessible description. Keyboard focus announces that sentence once.

The description is not shown as body text. A visible subtitle remains `st.markdown` or `st.caption`. It does not fill `menu_items["About"]`, the browser-tab title, or the nav label.

**Nav tooltips for pages that are not running** come only from `Page.help`. They are available as soon as `st.navigation` declares the pages, without executing those pages. `page_description` changes the tooltip of the running page only. An external-URL `st.Page` can still set `help`; that tooltip is on its nav item and is never the document description, because the external page is not this document.

**`st.page_link`.** The link's `help` is the tooltip for that link and nothing else. Omitted `help` uses the target page's `Page.help` when the argument is a `Page` or a path to a registered page. An external URL string infers nothing. `help=""` shows no tooltip even when the page has one, same as `icon=""`.

**`pages/` directory and single-page apps.** There is no `st.Page`, so `page_description` is the only input. Other automatic-multipage entries have no tooltip, because their scripts have not run.

**Timing.** The tags are applied when the page config arrives, same as `document.title` today. Crawlers that execute JavaScript, and prerender (the existing `prerenderReady` flag), see them. Link-preview clients that read only the initial HTML do not. That is the same gap as the page title ([#9058](https://github.com/streamlit/streamlit/issues/9058)). Closing it requires metadata known before the script runs, which is the `st.App` follow-up.

There is no length limit and no error for a long string. Docs should suggest one or two sentences; search results truncate on their own.

### Examples

Nav default, then a more specific sentence once the page runs:

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

```python
# revenue.py
import streamlit as st

st.set_page_config(
    page_title="Regional revenue",
    page_description="Net revenue by billing region for the selected quarter. Excludes refunds.",
)
```

A single-page app only needs `st.set_page_config`:

```python
import streamlit as st

st.set_page_config(
    page_title="Regional revenue",
    page_icon=":material/payments:",
    page_description="Net revenue by billing region. Excludes refunds. Periods are UTC.",
)
```

A link can keep the page sentence or replace the tooltip locally. The local string is not the document description:

```python
st.page_link(revenue)  # tooltip is revenue's help
st.page_link(revenue, help="Opens revenue and keeps the current filters.")
st.page_link(revenue, help="")  # no tooltip
```

### Naming

**Option 1: `help` on `st.Page`, `page_description` on `st.set_page_config`** ✅ PREFERRED

- Pros: The nav tooltip uses the same parameter as `st.page_link` and every other tooltip. Page config stays in the `page_title` / `page_icon` family. Each call site uses the word that command already speaks. One resolved sentence still feeds the tooltip, the accessible description, and the meta tags.
- Cons: Two names for one sentence. The docs have to say that `Page.help` is the default `page_description`.

**Option 2: `description` on `st.Page`, `page_description` on `st.set_page_config`**

- Pros: One noun for the metadata, aligned with the GitHub issue's wording.
- Cons: `description` is not a public Streamlit parameter. The tooltip on `st.page_link` would stay `help`, so the nav and the link would use different names for the same hover text (principles #7 and #10).

**Option 3: `help` on `st.Page`, `page_help` on `st.set_page_config`**

- Pros: One word on both commands.
- Cons: `page_help` sits beside `page_title` and `page_icon` and reads like the existing "Get help" menu item. `st.set_page_config` has nothing to hover.

Adopt **Option 1**. The tooltip is `help` because that is the established parameter. The page-config override is `page_description` because that command names page identity with a `page_` prefix, and "description" is what the meta tag is called.

## Out of Scope (Future Work)

- **`title` and `description` on `st.App`.** Static app identity, including a site name in `<title>` and `og:site_name`, and a description available before the script runs. The agent spec's static app descriptor depends on this ([#16843](https://github.com/streamlit/streamlit/pull/16843)). Tracked on [#16878](https://github.com/streamlit/streamlit/issues/16878). Page-level text in the snapshot does not wait on it.
- **Description in the initial HTML** for clients that do not run JavaScript ([#9058](https://github.com/streamlit/streamlit/issues/9058)). v1 updates the live document, same as the page title.
- **The rest of a social card.** `og:title`, `og:image`, `og:url`, Twitter card tags, and `<link rel="canonical">`. `page_icon` stays the favicon; it is a poor preview image.
- **Arbitrary `<meta>` tags**, including Google Search Console verification ([#16634](https://github.com/streamlit/streamlit/issues/16634)).
- **`keywords`, `author`, `robots`, and JSON-LD.** `keywords` is ignored by search engines. Indexing policy and structured data are separate features.
- **Visible subtitle** under the page heading, and copying the description into the About dialog.
- **A length limit.** Docs suggest one or two sentences; consumers truncate on their own.

## Checklist

| Item | ✅ or comment |
|------|---------------|
| Works on SiS, Cloud, etc? | ✅ Tooltip and accessible description use the existing nav. Meta tags update the app document, same as `document.title`. A host that injects its own description keeps it until the app sets one. |
| No breaking API changes | ✅ Keyword-only additions. Existing `st.Page` and `st.set_page_config` calls are unchanged. A new `*` before `page_description` does not move the current positional parameters. |
| No new dependencies | ✅ Reuses the `st.page_link` help tooltip and `to_help_str`. |
| Metrics collected | ✅ Both commands are already wrapped with `@gather_metrics`. String arguments record length, not content, so the description text is not sent. |
| Any security/legal impact? | Author-controlled Markdown in the tooltip uses the existing help renderer. Meta content is the plain text, escaped into the attribute. No new execution path. |
| Any docs changes needed? | ✅ `st.Page` and `st.set_page_config` API pages, plus a short mention in the multipage-apps guide that `help` is the nav sentence and `page_description` overrides it for the open page. |
