---
author: lukasmasuch
created: 2026-10-08
---

# Page description (`help` on `st.Page`, `page_description` on `st.set_page_config`)

## Summary

Add an authored page description in the two places a page already has a title. `st.Page(help=...)` is the sentence for that page, shown as a tooltip on the nav item and on `st.page_link`, and available without running the page. `st.set_page_config(page_description=...)` overrides it for the current run. The resolved sentence is what the nav, a crawler that executes JavaScript, prerender, and an agent snapshot read. A client that reads only the initial HTML does not, including most link-preview crawlers. That is the same gap as the page title, and it stays the `st.App` follow-up ([#9058](https://github.com/streamlit/streamlit/issues/9058)).

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
- **Search snippets.** Google uses `<meta name="description">` when it describes the page better than body text. Self-hosted apps have no way to set it ([#16634](https://github.com/streamlit/streamlit/issues/16634), [#2469](https://github.com/streamlit/streamlit/issues/2469)). v1 writes the tag into the live document. A crawler sees it when it executes JavaScript or when prerender has run.
- **Link previews.** Open Graph `og:description` is the preview body. Community Cloud injects sharing tags; other deployments do not ([#6567](https://github.com/streamlit/streamlit/issues/6567)). Most preview crawlers read the initial HTML and never run the app, so v1 does not fill those previews. The live document still gets both `<meta name="description">` and `og:description` from the same sentence, so a client that executes JavaScript or honors prerender sees one string in both places. Putting the description in the initial HTML is the `st.App` follow-up ([#9058](https://github.com/streamlit/streamlit/issues/9058)).
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
| `help` | `st.Page` | `None` | Default description for that page. Tooltip in the nav. Inherited by `st.page_link`. |
| `page_description` | `st.set_page_config` | `None` | Overrides the running page's description for this run. |

- `help` accepts the same Markdown as other `help` parameters, because the nav tooltip renders it.
- `page_description` is plain text. Its tooltip is inserted as text, not parsed as Markdown. Its published form is only dedent, strip, and whitespace collapse.
- Both values are dedented, so a triple-quoted string can be indented with the script.
- `None`, `""`, and whitespace-only set no description. `Page.help` returns `""` when unset. Unlike `icon`, nothing is inferred, so `None` and `""` match. `icon=""` forces no icon, and omitting `icon` can still take a filename emoji.

`help` is the nav word because that is what `st.page_link`, buttons, and the other tooltip parameters are already called (API principles #7 and #10). `page_description` is the page-config word because that command's parameters are `page_title` and `page_icon`, and it is not a hover target. `Page.help` is the default page description. `page_description` overrides it for the active run.

### Behavior

**One resolved description per full run of the running page.**

A fragment rerun executes only the fragment body. `st.set_page_config` written outside the fragment does not run again, so it sends no new page config. The description published by the last full run stays, including the nav tooltip, until the next full run.

A fragment can call `st.set_page_config` inside its body. That call enqueues `page_config_changed` today, including on a user-driven fragment rerun and on a `@st.fragment(run_every=...)` tick. On any fragment rerun, ignore `page_description`. Do not apply it, and do not clear the sentence the last full run published. When that ignored call passes a non-blank `page_description`, log it once per rerun, the same way other ignored parameters that change behavior are logged. When the fragment body does not pass `page_description`, stay silent. Other `set_page_config` arguments keep their current behavior.

| Source | When it wins |
|--------|----------------|
| Last non-blank `page_description` passed to `st.set_page_config` in this full run | Always, for the running page |
| Reduced `Page.help` of the running page | When this full run passed no non-blank `page_description` |
| Nothing | When the running page has neither a non-blank `page_description` nor a `Page.help`. Single-page and `pages/` apps reach this row unless they set `page_description`. |

On a full rerun of the same page, recompute from this run. A conditional description from the previous full rerun does not carry forward when this run passes no non-blank value.

`st.navigation` runs the entrypoint on every page, so a `page_description` there is part of this full run and wins over every page's `Page.help` for the running page's meta tags and nav tooltip. The other nav items keep their own `help`. That is last-wins, not a fallback under `Page.help`. An app-wide sentence belongs on `st.App`, which is out of scope.

Calls that omit `page_description`, and calls that pass `None`, `""`, or a whitespace-only string, leave a value set earlier in the same full run. Blank means empty after dedent and strip, so a whitespace-only string does not publish a meta tag. A later non-blank string replaces the description. A later blank value does not clear it and does not suppress `Page.help`. There is no way to publish an empty description while `Page.help` is set.

`page_title=""` is the same kind of no-op. The backend assigns the empty string, proto3 omits it on the wire, and the frontend applies a title only when the string is non-empty (`if (title)` in `handlePageConfigChanged`), so the tab keeps the inferred or previous title. `page_description=""` follows that. `st.page_link(help="")` and `st.Page(icon="")` do clear a tooltip or an icon on that call. Page config does not.

This is not the title flag. Page titles are sticky: `isPageTitleSet` is cleared only when `mainScriptHash` changes, and the entrypoint hash stays constant across page navigation, so once any page sets `page_title`, a later page that omits it keeps that title. Descriptions are not sticky. Each full run resolves its description from scratch, so a page without one never inherits the previous page's sentence. Implementers should not copy the title flag.

Navigating to another page drops the previous page's override once that new page's full run resolves.

`Page.help` on the `Page` object does not change when `page_description` overrides the running page. Reading `page.help` returns that page's sentence after dedent. A `page_description` override does not change it.

**Where the resolved sentence is published.**

- `<meta name="description">` and `<meta property="og:description">`, in three cases:
  - A fresh session with no author description leaves a host-injected `description` and `og:description` in place. Resolving to none does not delete tags Streamlit did not write.
  - When the running page has an author description, Streamlit replaces those two tags and owns them for the rest of the session.
  - Later in that session, when the running page resolves to none, Streamlit removes the tags it wrote. The original host tags stay gone. Streamlit does not put back HTML it did not save, and a page with no description must not keep the previous page's sentence.
- The built-in nav item (sidebar, top nav, and the overflow menu), as a tooltip. The tooltip uses the winning source in its original form: Markdown `Page.help` when that wins, and the literal `page_description` string when that wins. The open page does not show the stripped sentence while the other items stay formatted. A `pages/` app has a nav tooltip only when that page passes `page_description`.
- The nav link's accessible description, as the plain reduction of that same winning source.
- The agent snapshot ([#16843](https://github.com/streamlit/streamlit/pull/16843)). `Page.help` on the Python object stays the dedented Markdown, and a `page_description` override does not change it. The snapshot stores only the reduced plain sentence, under `description`, next to `title` and `icon`. The current page's `description` is the resolved sentence: a `page_description` override as written, otherwise reduced `Page.help`. Each `pages` entry's `description` is that page's reduced `Page.help`, including the open page, so the override does not rewrite the list. Omit `description` when the reduced string is empty. The snapshot does not keep the Markdown. An agent can choose a page without running it. Wiring the field into the snapshot waits on that PR. Meta tags and tooltips can ship without it.

The reducer turns `Page.help` into the sentence a reader sees in the rendered tooltip. Meta tags, the accessible description, and the snapshot `description` use that sentence when `Page.help` wins. The tooltip itself still shows the original Markdown. When `page_description` wins, those same plain-text places use that string as written, after whitespace normalization, and the tooltip inserts it as text. `page_description` is plain text, so directive and LaTeX unwrapping must not rewrite it. The reducer runs on the backend, because the snapshot and the plain text for pages that are not running are produced there. `plainTextWithBlockGaps` in `frontend/lib/src/util/plainText.ts` reads text from rendered DOM for label tooltips and is not a source reducer to copy.

- Unwrap every Streamlit directive to its inner text, including attribute blocks. `:small[Excludes refunds]`, `:red[refunds]`, `:color[refunds]{foreground="red"}`, `:color-background[...]`, and `:shimmer[...]` all keep the inner text and drop the directive and its attributes.
- Emphasis, strikethrough, headings, lists, blockquotes, and inline code keep their text and drop the markers, so `**Net** revenue` becomes `Net revenue` and `# Heading` becomes `Heading`.
- Link labels are kept and URLs are dropped, so `See the [billing docs](https://example.com)` becomes `See the billing docs`.
- Images, `:material/...:`, `:streamlit:`, and emoji shortcodes are dropped rather than turned into characters. The backend has no emoji-shortcode table.
- Drop `$` / `$$` only when the tooltip renderer treats that span as math, and keep the formula source, so `$E=mc^2$` becomes `E=mc^2`. A dollar amount the tooltip shows as currency stays, including `prices between $5 and $10`.

If reduction removes the whole string (`help=":material/info:"`, `help="![logo](logo.png)"`), plain-text consumers have no author description. The nav tooltip still renders that original Markdown, the same way other `help` values show an icon-only tooltip. Tooltip presence and a published description are separate. Replacing a host `description` or `og:description` with an empty attribute would clear a tag this session has not taken ownership of yet.

Before the string is written into a meta attribute or an accessible description, strip the ends and collapse internal line breaks and runs of whitespace into a single space. A triple-quoted `page_description` must not put newlines into the attribute. Blank, empty after dedent and strip, is decided before this normalization and means the call did not set a description. Escaping into the attribute happens after the reduction and the collapse.

The nav tooltip matches `st.page_link` in what a pointer user sees: hover the item itself, no question-mark icon, and immediate open on keyboard focus. The hover delay is 500ms, the same delay `st.page_link` and button help already use, rather than the 200ms shared tooltip default. On touch there is no popup. The nav link exposes the plain-text sentence as its accessible description all the time, including below the small breakpoint, and that sentence is announced once.

That permanent description is only on the built-in nav item. The visual tooltip stays for pointer users. The popup is hidden from assistive tech, because the link already exposes the plain-text description and keyboard focus would otherwise announce it twice. `st.page_link` keeps today's `BaseButtonTooltip`: below the small breakpoint it renders the trigger with no tooltip, and it points `aria-describedby` at the tooltip only while that tooltip is open. Inheriting `Page.help` changes the tooltip text, not that behavior. Changing `BaseButtonTooltip` would change every button, popover, and badge.

The description is not shown as body text. A visible subtitle remains `st.markdown` or `st.caption`. It does not fill `menu_items["About"]`, the browser-tab title, or the nav label.

**Nav tooltips for pages that are not running** come only from `Page.help`. They are available as soon as `st.navigation` declares the pages, without executing those pages. `page_description` changes the tooltip of the running page only. An external-URL `st.Page` can still set `help`; that tooltip is on its nav item and is never the document description, because the external page is not this document.

**`st.page_link`.** The link's `help` is the tooltip for that link and nothing else. Omitted `help` uses the target page's `Page.help` when the argument is a `Page` or a path to a registered page. That path case is wider than icon inheritance. `st.page_link` copies `icon` only from a `Page` object, not from a script path, so the page registry has to store `Page.help` for the path lookup. Several `st.Page` objects can share one script when their `url_path` values differ. `st.page_link("revenue.py")` already selects the first registered page with that `script_path`, and inherited `help` comes from that same page, so the label and the tooltip stay together. Icon inheritance from a script path stays a separate difference. An external URL string infers nothing. `help=""` shows no tooltip even when the page has one, same as `icon=""`. An instructional string passed to `st.page_link` stays on that link and is not the document description. Inherited `help` is always `Page.help`, never the running page's `page_description`. A `st.page_link` to the open page can therefore show a different sentence from that page's nav tooltip. That split is intentional.

**`pages/` directory and single-page apps.** There is no `st.Page`, so `page_description` is the only input. Nav entries for `pages/` scripts that are not running have no tooltip, because those scripts have not run.

**Timing.** Publish one resolved sentence for the running page at the end of the full run: last non-blank `page_description`, else reduced `Page.help`, else an explicit clear of tags Streamlit owns. Collect every `st.set_page_config` in that full run, then publish once. The runtime does not require a call order. `st.navigation()` returns a page and `Page.run()` returns, so the same full run can call `st.set_page_config` before `st.navigation`, between `st.navigation` and `page.run()`, or after `page.run()` returns. Last non-blank wins across those calls. Do not write the description from the navigation message and again from `pageConfigChanged`. If navigation wrote `Page.help` into the meta tags after an earlier `page_description`, it would replace the override that is supposed to win. Navigation `Page.help` is the tooltip source for pages that are not running. A page that never calls `st.set_page_config` still publishes its reduced `Page.help`. A page with neither source removes tags Streamlit owns, so the previous page's sentence does not stay.

Crawlers that execute JavaScript, and prerender (the existing `prerenderReady` flag), see the tags in the app document. Link-preview clients that read only the initial HTML do not. That is the same gap as the page title ([#9058](https://github.com/streamlit/streamlit/issues/9058)). Closing it requires metadata known before the script runs, which is the `st.App` follow-up.

Community Cloud and SiS run the app in an iframe. `document.title` is set in that iframe and also sent to the host with `SET_PAGE_TITLE`. Description meta tags written in the iframe never reach the top-level document those hosts show to crawlers. v1 does not add a host message. The tooltip and the accessible description still use the nav inside the iframe.

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

A `page_description` on the entrypoint replaces each page's `help` for the page that is running, because the entrypoint runs on every page. It is not an app-wide sentence. That belongs on `st.App`.

```python
st.set_page_config(
    page_description="Finance apps. Net revenue excludes refunds.",
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
- Cons: Two names for one sentence. `Page.help` is also published as `<meta name="description">`, `og:description`, and the agent-snapshot text, which no other `help` is. A tooltip written as an instruction becomes the search snippet. The docs have to say that `Page.help` is the default `page_description`, and that authors should write a page sentence. Keeping the name `help` still matches the hover behavior of `st.page_link`. Option 2 would give the nav and `st.page_link` different names for that hover.

**Option 2: `description` on `st.Page`, `page_description` on `st.set_page_config`**

- Pros: One noun for the metadata, aligned with the GitHub issue's wording.
- Cons: `description` is not a public Streamlit parameter. The tooltip on `st.page_link` would stay `help`, so the nav and the link would use different names for the same hover text (principles #7 and #10).

**Option 3: `help` on `st.Page`, `page_help` on `st.set_page_config`**

- Pros: One word on both commands.
- Cons: `page_help` sits beside `page_title` and `page_icon` and reads like the existing "Get help" menu item. `st.set_page_config` has nothing to hover.

Adopt **Option 1**. The tooltip is `help` because that is the established parameter. The page-config override is `page_description` because that command names page identity with a `page_` prefix, and "description" is what the meta tag is called.

## Out of Scope (Future Work)

- **`title` and `description` on `st.App`.** Static app identity, including a site name in `<title>` and `og:site_name`, and a description available before the script runs. The agent spec's static app descriptor depends on this ([#16843](https://github.com/streamlit/streamlit/pull/16843)). Tracked on [#16878](https://github.com/streamlit/streamlit/issues/16878). Page-level text in the snapshot does not wait on it.
- **Description in the initial HTML** for clients that do not run JavaScript ([#9058](https://github.com/streamlit/streamlit/issues/9058)). v1 updates the live document, same as the page title. Most link-preview crawlers are in this group.
- **A document-level accessible description.** Screen readers do not announce `<meta name="description">`. v1 exposes the sentence on the built-in nav link. `st.page_link` keeps today's tooltip. A visible subtitle stays `st.caption` or `st.markdown`.
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
| No new dependencies | ✅ `to_help_str` dedents the stored string. The `Page.help` tooltip reuses the help Markdown renderer. A `page_description` tooltip is inserted as text. The plain-text reducer is new backend work, with no new package. `plainTextWithBlockGaps` reads rendered DOM and is not that reducer. The nav item is not a straight copy of the page-link tooltip wrapper, because that wrapper hides the sentence on touch. |
| Metrics collected | ✅ Both commands are already wrapped with `@gather_metrics`. String arguments record length, not content, so the description text is not sent. |
| Any security/legal impact? | Author-controlled Markdown in the tooltip uses the existing help renderer. Meta content is the plain text, escaped into the attribute. No new execution path. |
| Any docs changes needed? | ✅ `st.Page` and `st.set_page_config` API pages, plus a short mention in the multipage-apps guide that `help` is the nav sentence and `page_description` overrides it for the open page. The `st.Page` docs warn that `help` is published as the page description, not only a hover string. |
