---
author: lukasmasuch
created: 2026-10-08
---

# Page description (`help` on `st.Page`, `page_description` on `st.set_page_config`)

## Summary

Add two page sentences that stay separate. `st.Page(help=...)` is the tooltip on the nav item and on `st.page_link`, and the agent hint for that page. It is available without running the page. `st.set_page_config(page_description=...)` is the document description: `<meta name="description">` and `og:description` for the running page. `help` is not copied into those tags. A client that reads only the initial HTML does not see `page_description`, including most link-preview crawlers. That is the same gap as the page title, and it stays the `st.App` follow-up ([#9058](https://github.com/streamlit/streamlit/issues/9058)).

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

The sentence shows up in four places, and they are not one string:

- **Navigation.** `st.Page` can name a page and cannot explain it, so a nav list cannot tell "Regional revenue" apart from "Reports" without running the page. `st.page_link` already has a hover tooltip (`help`), but the built-in nav does not, and the link's tooltip is not shared with the page. This is `Page.help`.
- **Agents.** The agent snapshot in [#16843](https://github.com/streamlit/streamlit/pull/16843) identifies each page by `url_path`, `title`, and `icon` only. Widget `help` is already in the snapshot; the page itself has no equivalent, so a model has to infer what "Regional revenue" means from body copy such as `st.caption`. That fails when the meaning is not on the page, and it fails for every page the agent has not opened. `Page.help` is known when `st.navigation` declares the page, which is the same moment the snapshot's `pages` list exists. [#16843](https://github.com/streamlit/streamlit/pull/16843) lists this as its authored-descriptions follow-up ([#16878](https://github.com/streamlit/streamlit/issues/16878)).
- **Search snippets.** Google uses `<meta name="description">` when it describes the page better than body text. Self-hosted apps have no way to set it ([#16634](https://github.com/streamlit/streamlit/issues/16634), [#2469](https://github.com/streamlit/streamlit/issues/2469)). v1 writes the tag into the live document from `page_description`. A crawler sees it when it executes JavaScript or when prerender has run.
- **Link previews.** Open Graph `og:description` is the preview body. Community Cloud injects sharing tags; other deployments do not ([#6567](https://github.com/streamlit/streamlit/issues/6567)). Most preview crawlers read the initial HTML and never run the app, so v1 does not fill those previews. The live document still gets both `<meta name="description">` and `og:description` from `page_description`, so a client that executes JavaScript or honors prerender sees one string in both places. Putting the description in the initial HTML is the `st.App` follow-up ([#9058](https://github.com/streamlit/streamlit/issues/9058)).

`help` is Markdown, because the tooltip renders it. Stripping that Markdown to a meta description needs a second parser kept in sync with the tooltip. `page_description` is plain text and is the only source for the tags.

`st.set_page_config` is where authors already set the browser-tab title. The document description belongs next to it. `st.Page` holds the tooltip the same way it holds the nav label.

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

`page_description` on `st.set_page_config`, keyword-only after a new `*`. The existing parameters stay positional.

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
| `help` | `st.Page` | `None` | Tooltip in the nav. Inherited by `st.page_link`. Agent hint. Not the meta description. |
| `page_description` | `st.set_page_config` | `None` | `<meta name="description">` and `og:description` for the running page. Not a tooltip. |

- `help` accepts the same Markdown as other `help` parameters, because the nav tooltip renders it.
- `page_description` is plain text.
- Both values are dedented, so a triple-quoted string can be indented with the script.
- `None`, `""`, and whitespace-only set nothing. `Page.help` returns `""` when unset. Unlike `icon`, nothing is inferred, so `None` and `""` match. `icon=""` forces no icon, and omitting `icon` can still take a filename emoji.

`help` is the nav word because that is what `st.page_link`, buttons, and the other tooltip parameters are already called (API principles #7 and #10). `page_description` is the page-config word because that command's parameters are `page_title` and `page_icon`, and it is not a hover target.

### Behavior

**`Page.help` is the tooltip and the agent hint.** It is not written into the document.

The built-in nav item (sidebar, top nav, and the overflow menu) shows `Page.help` as a tooltip, including on the open page. Pages that are not running show it as soon as `st.navigation` declares them, without executing those pages. An external-URL `st.Page` can set `help`; that tooltip is on its nav item and is never the document description, because the external page is not this document. A `pages/` app has no `st.Page`, so its nav items get no tooltip from this feature.

The tooltip matches `st.page_link` in what a pointer user sees: hover the item itself, no question-mark icon, and immediate open on keyboard focus. The hover delay is 500ms, the same delay `st.page_link` and button help already use, rather than the 200ms shared tooltip default. On touch there is no popup. The nav link's accessible description is the text of the rendered tooltip, taken from that render on the frontend, including below the small breakpoint, and that sentence is announced once. The visual tooltip stays for pointer users. The popup is hidden from assistive tech, because the link already exposes the description and keyboard focus would otherwise announce it twice. There is no backend pass that strips Markdown.

That permanent description is only on the built-in nav item. `st.page_link` keeps today's `BaseButtonTooltip`: below the small breakpoint it renders the trigger with no tooltip, and it points `aria-describedby` at the tooltip only while that tooltip is open. Inheriting `Page.help` changes the tooltip text, not that behavior. Changing `BaseButtonTooltip` would change every button, popover, and badge.

**`st.page_link`.** The link's `help` is the tooltip for that link and nothing else. Omitted `help` uses the target page's `Page.help` when the argument is a `Page` or a path to a registered page. That path case is wider than icon inheritance. `st.page_link` copies `icon` only from a `Page` object, not from a script path, so the page registry has to store `Page.help` for the path lookup. Several `st.Page` objects can share one script when their `url_path` values differ. `st.page_link("revenue.py")` already selects the first registered page with that `script_path`, and inherited `help` comes from that same page, so the label and the tooltip stay together. Icon inheritance from a script path stays a separate difference. An external URL string infers nothing. `help=""` shows no tooltip even when the page has one, same as `icon=""`. An instructional string passed to `st.page_link` stays on that link.

**Agent snapshot** ([#16843](https://github.com/streamlit/streamlit/pull/16843)). The snapshot stores `Page.help` under `description`, next to `title` and `icon`, as the dedented Markdown. The current page and each `pages` entry use that page's `Page.help`. `page_description` does not change the field. Omit `description` when `help` is unset. An agent can choose a page without running it. Wiring the field into the snapshot waits on that PR. Tooltips and meta tags can ship without it.

**`page_description` is the document description.** It updates `<meta name="description">` and `<meta property="og:description">` only.

- A fresh session with no `page_description` leaves a host-injected `description` and `og:description` in place. Resolving to none does not delete tags Streamlit did not write.
- When a run applies a `page_description`, Streamlit replaces those two tags and owns them for the rest of the session.
- When a later full run passes no non-blank `page_description`, Streamlit removes the tags it wrote. The original host tags stay gone. Streamlit does not put back HTML it did not save, and a page with no `page_description` must not keep the previous page's sentence. `Page.help` does not fill the gap.

Before the string is written into the attribute, strip the ends and collapse internal line breaks and runs of whitespace into a single space. A triple-quoted `page_description` must not put newlines into the attribute. Blank, empty after dedent and strip, is decided before this collapse and means the call did not set a description. Escaping into the attribute happens after the collapse.

Calls that omit `page_description`, and calls that pass `None`, `""`, or a whitespace-only string, leave a value set earlier in the same run. A later non-blank string replaces the description. A later blank value does not clear it. `page_title=""` is the same kind of no-op. The backend assigns the empty string, proto3 omits it on the wire, and the frontend applies a title only when the string is non-empty (`if (title)` in `handlePageConfigChanged`), so the tab keeps the inferred or previous title. `page_description=""` follows that. `st.page_link(help="")` and `st.Page(icon="")` do clear a tooltip or an icon on that call. Page config does not.

Page titles are sticky: `isPageTitleSet` is cleared only when `mainScriptHash` changes, and the entrypoint hash stays constant across page navigation, so once any page sets `page_title`, a later page that omits it keeps that title. Descriptions are not sticky. A full run that passes no non-blank `page_description` ends by removing the tags Streamlit wrote, so a page without one does not keep the previous page's sentence. Implementers should not copy the title flag.

`st.navigation` runs the entrypoint on every page, so a `page_description` there is part of every page's run and sets the meta tags for whichever page is running. It does not change any tooltip. A non-blank `page_description` in the page script replaces it. An app-wide sentence belongs on `st.App`, which is out of scope.

**Timing.** A non-blank `page_description` is sent with the same `page_config_changed` message as `page_title` and updates the two meta tags when that call runs. The last non-blank call in the run wins. The runtime does not require a call order. `st.navigation()` returns a page and `Page.run()` returns, so the same full run can call `st.set_page_config` before `st.navigation`, between `st.navigation` and `page.run()`, or after `page.run()` returns. At the end of a full run that passed no non-blank `page_description`, remove the tags Streamlit owns.

A fragment rerun executes only the fragment body. `st.set_page_config` written outside the fragment does not run again, so it sends no new page config and the published description stays. A fragment that calls `st.set_page_config` follows the same rule as the other arguments: a non-blank `page_description` in that call updates the tags, and omitting it leaves them alone. A fragment rerun does not clear the tags.

`Page.help` on the `Page` object does not change when the running page sets `page_description`. Reading `page.help` returns that page's sentence after dedent.

The description is not shown as body text. A visible subtitle remains `st.markdown` or `st.caption`. It does not fill `menu_items["About"]`, the browser-tab title, or the nav label.

Crawlers that execute JavaScript, and prerender (the existing `prerenderReady` flag), see the tags in the app document. Link-preview clients that read only the initial HTML do not. That is the same gap as the page title ([#9058](https://github.com/streamlit/streamlit/issues/9058)). Closing it requires metadata known before the script runs, which is the `st.App` follow-up.

Community Cloud and SiS run the app in an iframe. `document.title` is set in that iframe and also sent to the host with `SET_PAGE_TITLE`. Description meta tags written in the iframe never reach the top-level document those hosts show to crawlers. v1 does not add a host message. The tooltip and the accessible description still use the nav inside the iframe.

There is no length limit and no error for a long string. Docs should suggest one or two sentences; search results truncate on their own.

### Examples

Tooltip on each page, and a meta description only where the page sets one:

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

`revenue.py` sets the meta description for that run. The nav tooltip stays `revenue`'s `help`. `costs.py` sets no `page_description`, so after that run the meta tags Streamlit wrote are removed. Its tooltip stays its own `help`.

A `page_description` on the entrypoint sets the meta description for every page, because the entrypoint runs on every page. It does not change tooltips, and it is not an app-wide sentence. That belongs on `st.App`.

```python
st.set_page_config(
    page_description="Finance apps. Net revenue excludes refunds.",
)
st.navigation([revenue, costs]).run()
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

- Pros: The nav tooltip uses the same parameter as `st.page_link` and every other tooltip. Page config stays in the `page_title` / `page_icon` family and is what the meta tag is called. The two parameters do different jobs.
- Cons: Two names. An author who only sets `help` gets a tooltip and no meta description. The docs have to say that.

**Option 2: `description` on `st.Page`, `page_description` on `st.set_page_config`**

- Pros: One noun for the metadata, aligned with the GitHub issue's wording.
- Cons: `description` is not a public Streamlit parameter. The tooltip on `st.page_link` would stay `help`, so the nav and the link would use different names for the same hover text (principles #7 and #10).

**Option 3: `help` on `st.Page`, `page_help` on `st.set_page_config`**

- Pros: One word on both commands.
- Cons: `page_help` sits beside `page_title` and `page_icon` and reads like the existing "Get help" menu item. `st.set_page_config` has nothing to hover, and the value is a meta description, not a tooltip.

Adopt **Option 1**. The tooltip is `help` because that is the established parameter. The document description is `page_description` because that command names page identity with a `page_` prefix, and "description" is what the meta tag is called.

## Out of Scope (Future Work)

- **`title` and `description` on `st.App`.** Static app identity, including a site name in `<title>` and `og:site_name`, and a description available before the script runs. The agent spec's static app descriptor depends on this ([#16843](https://github.com/streamlit/streamlit/pull/16843)). Tracked on [#16878](https://github.com/streamlit/streamlit/issues/16878). Page-level `help` in the snapshot does not wait on it.
- **Description in the initial HTML** for clients that do not run JavaScript ([#9058](https://github.com/streamlit/streamlit/issues/9058)). v1 updates the live document, same as the page title. Most link-preview crawlers are in this group.
- **A document-level accessible description.** Screen readers do not announce `<meta name="description">`. v1 exposes `Page.help` on the built-in nav link. `page_description` is not announced. `st.page_link` keeps today's tooltip. A visible subtitle stays `st.caption` or `st.markdown`.
- **Copying `Page.help` into the meta tags.** That needs a Markdown-to-text pass kept in sync with the tooltip renderer. v1 does not do it.
- **The rest of a social card.** `og:title`, `og:image`, `og:url`, Twitter card tags, and `<link rel="canonical">`. `page_icon` stays the favicon; it is a poor preview image.
- **A host message for embedded apps.** `SET_PAGE_DESCRIPTION`, and whether `SET_APP_PAGES` carries each page's `help`, so Community Cloud and SiS can put the description on the top-level document. v1 only writes the tags in the app iframe.
- **Arbitrary `<meta>` tags**, including Google Search Console verification ([#16634](https://github.com/streamlit/streamlit/issues/16634)).
- **`keywords`, `author`, `robots`, and JSON-LD.** `keywords` is ignored by search engines. Indexing policy and structured data are separate features.
- **Visible subtitle** under the page heading, and copying the description into the About dialog.
- **A length limit.** Docs suggest one or two sentences; consumers truncate on their own.

## Checklist

| Item | ✅ or comment |
|------|---------------|
| Works on SiS, Cloud, etc? | ✅ Tooltip and accessible description use the existing nav inside the app iframe. Meta tags update that iframe document only. Community Cloud and SiS do not receive them on the top-level page in v1, because there is no host message. A host-injected description in the iframe stays until the app sets one. |
| No breaking API changes | ✅ Keyword-only additions. Existing `st.Page` and `st.set_page_config` calls are unchanged. A new `*` before `page_description` does not move the current positional parameters. |
| No new dependencies | ✅ `to_help_str` dedents the stored string. The `Page.help` tooltip reuses the help Markdown renderer. The accessible description is the text of that render. No Markdown-to-text package. |
| Metrics collected | ✅ Both commands are already wrapped with `@gather_metrics`. String arguments record length, not content, so the description text is not sent. |
| Any security/legal impact? | Author-controlled Markdown in the tooltip uses the existing help renderer. Meta content is `page_description`, escaped into the attribute. `help` is not copied into the attribute. No new execution path. |
| Any docs changes needed? | ✅ `st.Page` and `st.set_page_config` API pages, plus a short mention in the multipage-apps guide. `help` is the nav tooltip and the agent hint. `page_description` is the meta description. Setting `help` does not set the meta tags. |
