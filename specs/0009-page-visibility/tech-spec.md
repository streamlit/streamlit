---
author: lukasmasuch
created: 2025-02-11
status: Draft
---

# Tech Spec: Page visibility parameter for `st.Page`

## Overview

This document describes the technical implementation for adding a `visibility` parameter
to `st.Page` that controls whether a page appears in the navigation menu while remaining
accessible via URL.

## Architecture

The implementation spans three layers:

1. **Backend (Python)**: Add `visibility` parameter to `st.Page` and `StreamlitPage`
2. **Protocol Buffers**: Add `is_hidden` field to `AppPage` message
3. **Frontend (TypeScript)**: Filter hidden pages from navigation display

## Implementation Details

### 1. Backend Changes

#### 1.1 `lib/streamlit/navigation/page.py`

**Update `Page()` function signature:**

```python
@gather_metrics("Page")
def Page(
    page: str | Path | Callable[[], None],
    *,
    title: str | None = None,
    icon: str | None = None,
    url_path: str | None = None,
    default: bool = False,
    visibility: Literal["visible", "hidden"] = "visible",  # NEW
) -> StreamlitPage:
```

**Update `StreamlitPage` class:**

```python
class StreamlitPage:
    def __init__(
        self,
        page: str | Path | Callable[[], None],
        *,
        title: str | None = None,
        icon: str | None = None,
        url_path: str | None = None,
        default: bool = False,
        visibility: Literal["visible", "hidden"] = "visible",  # NEW
    ) -> None:
        # ... existing code ...

        # Validate visibility parameter
        if visibility not in ("visible", "hidden"):
            raise StreamlitAPIException(
                f'Invalid visibility "{visibility}". '
                'The visibility parameter must be either "visible" or "hidden".'
            )
        self._visibility: Literal["visible", "hidden"] = visibility
```

Note: `_visibility` is an internal attribute, not exposed as a public property.
Users set visibility at page creation and don't need to read it back.

#### 1.2 `lib/streamlit/commands/navigation.py`

**Update navigation proto message construction:**

In the `_navigation()` function, add the `is_hidden` field when building `app_pages`:

```python
for section_header in nav_sections:
    for page in nav_sections[section_header]:
        p = msg.navigation.app_pages.add()
        p.page_script_hash = page._script_hash
        p.page_name = page.title
        p.icon = f"emoji:{page.icon}" if is_emoji(page.icon) else page.icon
        p.is_default = page._default
        p.section_header = section_header
        p.url_pathname = page.url_path
        p.is_hidden = page._visibility == "hidden"  # NEW
```

### 2. Protocol Buffer Changes

#### 2.1 `proto/streamlit/proto/AppPage.proto`

Add `is_hidden` field to the `AppPage` message:

```protobuf
message AppPage {
  string page_script_hash = 1;
  string page_name = 2;
  string icon = 3;
  bool is_default = 4;
  string section_header = 5;
  string url_pathname = 6;
  bool is_hidden = 7;  // NEW: Whether page is hidden from navigation
}
```

**Naming rationale:** Using `is_hidden` (boolean) in the proto rather than a
`visibility` enum because:
1. Proto field naming convention prefers `is_*` for boolean flags
2. The feature is binary (visible/hidden) in the frontend rendering
3. Simpler serialization and less overhead
4. The string enum is a Python API concern, not a wire format concern

After adding the field, run `make protobuf` to regenerate Python and TypeScript bindings.

### 3. Frontend Changes

#### 3.1 `frontend/app/src/components/Navigation/utils.ts`

Add a utility function to filter visible pages:

```typescript
/**
 * Filters out hidden pages from the app pages list.
 * Hidden pages remain in NavigationContext for URL routing but are not displayed.
 */
export function filterVisiblePages(pages: IAppPage[]): IAppPage[] {
  return pages.filter(page => !page.isHidden)
}
```

#### 3.2 `frontend/app/src/components/Navigation/SidebarNav.tsx`

Filter hidden pages before rendering. Update the component to use `filterVisiblePages`:

```typescript
const SidebarNav = ({ ... }: Props): ReactElement | null => {
  // ... existing hooks ...

  const { pageLinkBaseUrl, appPages, onPageChange, currentPageScriptHash } =
    useContext(NavigationContext)

  // Filter out hidden pages for display
  const visiblePages = useMemo(
    () => filterVisiblePages(appPages),
    [appPages]
  )

  const navigationStructure = useMemo(() => {
    return processNavigationStructure(groupPagesBySection(visiblePages))
  }, [visiblePages])

  // ... rest of component uses visiblePages/navigationStructure instead of appPages ...
}
```

Key points:
- Filter pages in `useMemo` for performance
- Use `visiblePages` in `navigationStructure` calculation
- Update `numVisiblePages` to count only visible pages
- The active page highlighting still works because `currentPageScriptHash` may
  reference a hidden page (when navigated to directly)

#### 3.3 `frontend/app/src/components/Navigation/TopNav.tsx`

Apply the same filtering pattern:

```typescript
const TopNav: React.FC<Props> = ({ endpoints, widgetsDisabled }) => {
  const { pageLinkBaseUrl, currentPageScriptHash, appPages, onPageChange } =
    useContext(NavigationContext)

  const visiblePages = useMemo(
    () => filterVisiblePages(appPages),
    [appPages]
  )

  const { data, itemKey } = useMemo(() => {
    const navSections = groupPagesBySection(visiblePages)
    // ... rest of memo logic ...
  }, [visiblePages])

  // ... rest of component ...
}
```

#### 3.4 Navigation Context Unchanged

**Important:** The `NavigationContext` continues to include all pages (including hidden
ones) in `appPages`. This ensures:

1. URL routing works for hidden pages
2. `st.page_link` to hidden pages works
3. `currentPageScriptHash` can reference hidden pages
4. Page script hash lookups succeed

The filtering happens only at the display layer (`SidebarNav`, `TopNav`).

### 4. Section Handling

When all pages in a section are hidden, the section header should not be displayed.

The existing `processNavigationStructure` and `groupPagesBySection` functions already
handle empty sections correctly - they simply won't include sections with no pages.
Since we filter hidden pages before calling these functions, sections with only hidden
pages will naturally be excluded.

### 5. Edge Cases

| Scenario | Handling |
|----------|----------|
| All pages hidden | Navigation not displayed (no visible pages) |
| Single visible page | Navigation not displayed (existing behavior) |
| Hidden default page | Allowed; loads at root URL, not shown in nav |
| Empty section after filtering | Section header not displayed |
| Navigate to hidden page via URL | Works normally (page still in NavigationContext) |

## File Changes Summary

| File | Change Type |
|------|-------------|
| `lib/streamlit/navigation/page.py` | Add visibility parameter and property |
| `lib/streamlit/commands/navigation.py` | Pass is_hidden to proto |
| `proto/streamlit/proto/AppPage.proto` | Add is_hidden field |
| `frontend/app/src/components/Navigation/utils.ts` | Add filterVisiblePages function |
| `frontend/app/src/components/Navigation/SidebarNav.tsx` | Filter hidden pages |
| `frontend/app/src/components/Navigation/TopNav.tsx` | Filter hidden pages |

## Testing Strategy

### Python Unit Tests

Location: `lib/tests/streamlit/navigation/page_test.py`

1. Test `visibility` parameter validation (valid values, invalid values raise error)
2. Test default visibility is "visible"

Location: `lib/tests/streamlit/commands/navigation_test.py`

1. Test hidden pages are included in proto message with `is_hidden=True`
2. Test visible pages have `is_hidden=False`
3. Test hidden pages can be default page
4. Test URL routing works for hidden pages

### Frontend Unit Tests

Location: `frontend/app/src/components/Navigation/utils.test.ts`

1. Test `filterVisiblePages` filters hidden pages
2. Test `filterVisiblePages` preserves visible pages
3. Test empty array handling

Location: `frontend/app/src/components/Navigation/SidebarNav.test.tsx`

1. Test hidden pages are not rendered
2. Test sections with only hidden pages are not rendered
3. Test navigation still works when current page is hidden

Location: `frontend/app/src/components/Navigation/TopNav.test.tsx`

1. Same tests as SidebarNav for TopNav component

### E2E Tests

Location: `e2e_playwright/st_page_visibility_test.py`

1. Test hidden page not shown in sidebar navigation
2. Test hidden page not shown in top navigation
3. Test hidden page accessible via direct URL
4. Test `st.page_link` to hidden page works
5. Test `st.switch_page` to hidden page works
6. Test hidden default page behavior
7. Test section with all hidden pages not displayed

## Migration & Compatibility

- **Backward compatible**: New optional parameter with default `"visible"`
- **No breaking changes**: Existing code continues to work unchanged
- **Proto compatibility**: New field with default value (false) is backward compatible

## Documentation Updates

- Update `st.Page` API reference with `visibility` parameter
- Add example showing hidden pages pattern
- Update multipage apps concept documentation if needed
