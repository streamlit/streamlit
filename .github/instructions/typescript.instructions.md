---
applyTo: "**/*.ts, **/*.tsx"
---

<!-- Generated from frontend/AGENTS.md. Edit that file instead, then run: uv run python scripts/generate_agent_rules.py -->

# TypeScript Development Guide

- TypeScript: v5
- Linters: oxlint v1 + eslint v9
- Formatter: oxfmt v0.41
- Framework: React v18
- Styling: @emotion/styled v11
- Build tool: vite v8
- Testing: vitest v4 & react testing library v16
- Package manager: yarn v4 with workspaces

## Key TypeScript Principles

- Prefer functional, declarative programming.
- Prefer iteration and modularization over duplication.
- Use descriptive variable names with auxiliary verbs (e.g., isLoading).
- Use the Receive an Object, Return an Object (RORO) pattern.
- Ensure functions have explicit return types.
- **Omit trivially inferred types**: Do not add type annotations when TypeScript can trivially infer them (e.g., `const count = 0` not `const count: number = 0`). Add explicit types only when they improve clarity or are required.
- **Prefer optional chaining**: Use optional chaining (`?.`) instead of `&&` chains for property access. This is enforced by the `@typescript-eslint/prefer-optional-chain` rule.
- **Prefer JSDoc over regular comments**: When documenting functions, types, interfaces, classes, or their members, use JSDoc (`/** ... */`) instead of regular comments (`//` or `/* */`). JSDoc enables IDE tooltips, auto-completion hints, and better documentation generation.
- **No barrel files**: Do not create `index.ts`/`index.tsx` barrel files that only re-export from sibling modules. Import directly from the source file instead (e.g., `import Foo from "./Foo/Foo"` not `import Foo from "./Foo"`). The only exceptions are package entry points (`app/src/index.tsx`, `lib/src/index.ts`, `connection/src/index.ts`, `utils/src/index.ts`) and `component-v2-lib/src/index.ts` (shipped as an npm library). Files named `index.ts` that contain actual logic (e.g., `DataFrame/columns/index.ts`, `WindowDimensions/index.ts`, emotion theme files) are fine — the rule applies only to files whose sole purpose is re-exporting.

## Key Frontend Principles

- Leverage all of best practices of React 18.
- Follow the [Rules of React](https://react.dev/reference/rules): pure components and hooks, immutable props and state, and call hooks at the top level of React functions.
- Write performant frontend code.
- Ensure referential stability by leveraging React Hooks.
- Name refs with a `Ref` suffix: Variables assigned from `useRef(...)` must end with `Ref`. This is enforced by eslint.
  - ✅ `const inputRef = useRef<HTMLInputElement>(null)`
  - ❌ `const input = useRef<HTMLInputElement>(null)`
- **Updater functions must be pure**: `setState(prev => newState)` updaters must not mutate `prev` or have side effects—return a new object. See [useState](https://react.dev/reference/react/useState#setstate-parameters).
- Prefix event handlers with "handle" (e.g., handleClick, handleSubmit).

## Theming and Styling

- **Use theme properties**: Always strongly prefer theme properties from `useEmotionTheme()` instead of hardcoded values: `theme.colors`, `theme.spacing`, `theme.sizes`, `theme.radii`, `theme.fontSizes`, `theme.fontWeights`, `theme.fonts`, `theme.lineHeights`, `theme.shadows`, `theme.iconSizes`, `theme.breakpoints`, `theme.zIndices`. See `frontend/lib/src/theme/` to find out more about theming.
- **Avoid inline `style` props**: Prefer `@emotion/styled` components over inline `style` attributes. Move styled components to `styled-components.ts` when possible.
- Leverage object style notation in Emotion.
- **Avoid complex/deeply nested CSS selectors**: Prefer flat, simple selectors in styled components. Deeply nested selectors (e.g., `& > div > span > button`) are fragile, hard to maintain, and often indicate a need to refactor into smaller styled components.
- All styled components begin with the word `Styled` to indicate it's a styled component.
- Utilize props in styled components to display elements that may have some interactivity.
- Avoid the need to target other components.
- When using BaseWeb, be sure to import our theme via `useEmotionTheme` and use those values in overrides.
- Use the following pattern for naming custom CSS classes and test IDs: `stComponentSubcomponent`, for example: `stTextInputIcon`.
- Avoid using pixel sizes for styling, always use rem, em, percentage, or other relative units.

## Accessibility (a11y) Guidelines (must-follow)

- **Prefer semantic HTML for interaction**: Use `<button>` for clicks and `<a href>` for navigation. Avoid `onClick` on non-interactive elements.
- **Focusable controls must have an accessible name**:
  - Icon-only buttons/links must have `aria-label` (and decorative SVGs should use `aria-hidden="true"`).
  - For reusable components that render a focusable trigger by default, prefer TypeScript prop unions to make unlabeled triggers impossible (example: `TooltipIcon`).
- **Don’t hide interactive content from assistive tech**:
  - Never set `aria-hidden` on a wrapper that contains focusable descendants (it hides them from screen readers).
  - If you need to avoid duplicate announcements, apply `aria-hidden` only to the _visual label text node_ (e.g. wrap the label text in `<span aria-hidden="true">…</span>`), not the entire label container.
- **Avoid duplicate tab stops**:
  - Be careful with libraries that spread props onto wrappers (e.g. `react-dropzone` `getRootProps()` adds `tabIndex=0` by default).
  - If there’s an inner "real" control (like a `<button>`), set the wrapper `tabIndex={-1}` so keyboard users don’t hit the same control twice.
- **Focus styling must be keyboard-friendly**:
  - We **assume the browser supports `:focus-visible`**. Do not implement `:focus-visible` fallbacks (e.g. `:focus` + `:focus:not(:focus-visible)` patterns).
  - Don't remove focus outlines without replacing them. Prefer `:focus-visible` styles and use `theme.shadows` values for consistent rings.
- **Keyboard dismissal shouldn’t steal focus**: Popovers/tooltips/dialogs should support Escape to dismiss while keeping focus on the trigger unless there’s a strong reason to move it.

## Logging

- Use `loglevel`'s `getLogger` for logging (e.g. warnings / errors). Create a module-level `LOG` constant with a descriptive name:

```tsx
import { getLogger } from "loglevel"

const LOG = getLogger("MyComponent")
```

## Static Data Structures

- Extract static lookup maps and constants to module-level scope outside functions/components
- Static data recreated on every call/render wastes memory and CPU
- Exception: Keep inside function only if data depends on parameters, props, or state

<good-example>

```tsx
// ✅ Module-level - created once
const ALIGNMENT_MAP: Record<Alignment, CSSProperties["textAlign"]> = {
  [Alignment.LEFT]: "left",
  [Alignment.CENTER]: "center",
  // ...
} as const

function getAlignment(config: AlignmentConfig) {
  return ALIGNMENT_MAP[config.alignment]
}
```

</good-example>

<bad-example>

```tsx
// ❌ Recreated every call
function getAlignment(config: AlignmentConfig) {
  const alignmentMap = {
    /* same data */
  }
  return alignmentMap[config.alignment]
}
```

</bad-example>

## Yarn Workspaces

- Project Structure: Monorepo managed with Yarn Workspaces.
- Packages:
  - `app` - Main application UI.
  - `component-lib` - Library for building Streamlit custom components v1.
  - `component-v2-lib` - Support library for Streamlit Components v2.
  - `connection` - WebSocket handling
  - `eslint-plugin-streamlit-custom` - ESLint plugin with custom rules.
  - `lib` - Shared UI components.
  - `protobuf` - Generated Protocol definitions.
  - `typescript-config` - Configuration for TypeScript.
  - `utils` - Shared TypeScript utilities.
- Package-specific scripts are executed within their respective directories.

## Relevant `make` commands

Run from the repo root (requires Node major version from `.nvmrc`):

- `make frontend-fast`: Build the frontend (vite).
- `make frontend-dev`: Start the frontend development server (hot-reload).
- `make frontend-lint`: Lint and check formatting of frontend files (oxlint + eslint).
- `make frontend-knip`: Run Knip dependency analysis.
- `make frontend-types`: Run the TypeScript type checker (tsc).
- `make frontend-format`: Format frontend files (oxfmt).
- `make frontend-tests`: Run all frontend unit tests (vitest).

## TypeScript Test Guide

- Test Framework: Vitest
- UI Testing Library: React Testing Library (RTL)

### Key Principles

- Coverage: Implement both unit and integration tests (using RTL where applicable).
- Robustness: Test edge cases and error handling scenarios.
- Accessibility: Validate component accessibility compliance.
- Parameterized Tests: Use `it.each` for repeated tests with varying inputs.
- Positive + negative assertions (anti-regression): When you assert that something appears/changes, also add at least one complementary assertion when practical that something else does **not** appear/change (inverse state, error message that must not show, callback that must not fire, etc.).
  - Presence: `getBy*` / `findBy*` + `toBeVisible()`
  - Absence: `queryBy*` + `not.toBeInTheDocument()` or `not.toBeVisible()`
- Framework Exclusivity: Only use Vitest syntax; do not use Jest.

### Running Tests

- Yarn test commands must be run from the `<GIT_ROOT>/frontend` directory.

- Run All Tests: `yarn test`
- Run Specific File: `yarn test lib/src/components/path/component.test.tsx`
- Run Specific Test: `yarn test -t "the test name" lib/src/components/path/component.test.tsx`

### React Testing Library best practices

Cheat sheet for queries from RTL:

|            | No Match | 1 Match | 1+ Match | Await? |
| ---------- | -------- | ------- | -------- | ------ |
| getBy      | throw    | return  | throw    | No     |
| findBy     | throw    | return  | throw    | Yes    |
| queryBy    | null     | return  | throw    | No     |
| getAllBy   | throw    | array   | array    | No     |
| findAllBy  | throw    | array   | array    | Yes    |
| queryAllBy | []       | array   | array    | No     |

- Utilizing any query that throws if not found AND asserting using `toBeInTheDocument` is redundant and must be avoided. Prefer `toBeVisible` instead.
- User interactions should utilize the `userEvent` library.
- Tests should be written in a way that asserts user behavior, not implementation details.

#### Query Priority Order

Based on the Guiding Principles, your test should resemble how users interact with your code (component, page, etc.) as much as possible. With this in mind, we recommend this order of priority:

1. Queries Accessible to Everyone Queries that reflect the experience of visual/mouse users as well as those that use assistive technology.
   - getByRole, getByLabelText, getByPlaceholderText, getByText, getByDisplayValue

2. Semantic Queries HTML5 and ARIA compliant selectors. Note that the user experience of interacting with these attributes varies greatly across browsers and assistive technology.
   - getByAltText, getByTitle

3. Test IDs
   - getByTestId - The user cannot see (or hear) these, so this is only recommended for cases where you can't match by role or text or it doesn't make sense (e.g. the text is dynamic).

## You Might Not Need an Effect

Authoritative rules for deciding when to use or remove `useEffect` in React components. Based on React docs: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).

### Purpose

- Write React that is simpler, faster, and less error‑prone by avoiding unnecessary Effects.
- Prefer deriving values during render and handling actions in event handlers.
- Only use Effects to synchronize with external systems.

### Core Principles (enforce by default)

- Derive during render: If a value can be computed from props/state, compute it inline. Do NOT mirror it in state or set it in an Effect.
- Events, not Effects: Handle user interactions in event handlers. Do NOT move event-driven logic into Effects.
- Memoize expensive pure work: Use `useMemo` for heavy pure computations, not `useEffect` + state.
- One responsibility per Effect: Each Effect should sync exactly one external concern.
- Clean up or don’t ship: Any Effect that subscribes, starts timers, or allocates resources must return a cleanup.
- Stable refs over re-subscribes: Keep subscriptions stable; avoid recreating on every render.

### When an Effect IS appropriate

Use an Effect only to synchronize the component with an external system:

- Subscriptions: event listeners, WebSocket, ResizeObserver, etc. Ensure cleanup.
- Imperative APIs: integrating non-React widgets or DOM APIs.
- Network sync: Keep local UI in sync with remote data for given parameters (with race handling and cleanup).
- Scheduling/out-of-React side effects: analytics pings, imperative focus when tied to visibility.

If no external system is involved, you likely don’t need an Effect.

### Anti-patterns to reject (rewrite required)

- Setting derived state in an Effect (e.g., `setFullName(firstName + ' ' + lastName)`). Compute during render instead.
- Filtering/sorting data via Effect + state. Compute during render; use `useMemo` only if the computation is expensive.
- Using Effects to respond to user actions that can be handled in the event handler.
- Chains of Effects where each triggers the next via `setState`. Compute the final value directly during render or perform the action in the initiating handler.
- Missing cleanup for listeners, intervals, timeouts, blob URLs, or object URLs.
- Data fetching without race protection (stale response can overwrite newer data).

### Rewrite patterns (preferred code)

- Derived value during render:

```tsx
// ❌ Avoid
// const [fullName, setFullName] = useState("")
// useEffect(() => setFullName(`${firstName} ${lastName}`), [firstName, lastName])

// ✅ Do
const fullName = `${firstName} ${lastName}`
```

- Expensive pure computation:

```tsx
// ❌ Effect + state
// const [visibleTodos, setVisibleTodos] = useState<Todo[]>([])
// useEffect(() => setVisibleTodos(filterTodos(todos, filter)), [todos, filter])

// ✅ Render-time compute (useMemo only if slow)
const visibleTodos = useMemo(() => filterTodos(todos, filter), [todos, filter])
```

- Handle user action in the handler:

```tsx
// ❌ useEffect that watches flag and then performs action
// useEffect(() => { if (shouldBuy) buy() }, [shouldBuy])

// ✅ Directly do the work in response to the event
function handleBuyClick() {
  void buy()
}
```

- Data fetching with race protection and cleanup:

```tsx
useEffect(() => {
  const abort = new AbortController()
  let ignore = false

  fetch(makeUrl(query, page), { signal: abort.signal })
    .then(r => r.json())
    .then(data => {
      if (!ignore) setResults(data)
    })
    .catch(err => {
      if (!ignore && (err as any)?.name !== "AbortError") setError(err)
    })

  return () => {
    ignore = true
    abort.abort()
  }
}, [query, page])
```

- Reset state without Effects:

```tsx
// ✅ Keyed reset when parent prop changes
;<Child key={userId} userId={userId} />

// ✅ Set initial controlled values from props during render
const initialTab = props.defaultTab ?? "overview"
```

### Effect checklist (must pass all)

1. External sync: Does this Effect synchronize with an external system? If no, remove it.
2. Single responsibility: Exactly one external concern in this Effect.
3. Complete deps: Dependency array is complete and correct; avoid stale closures.
4. Cleanup: All listeners, timers, object URLs, and subscriptions are cleaned in the return function.
5. Race safety: For network requests, ignore/cancel stale responses (AbortController or an `ignore` flag).
6. Referential stability: Use `useCallback`/`useMemo` to prevent unnecessary effect re-runs caused by unstable references.
7. Error handling: Async paths have error handling; no silent failures.

### Decision guide

- Can it be computed from existing state/props? Compute during render.
- Is the logic triggered by a user event? Put it in the event handler.
- Is it an expensive pure calculation? Use `useMemo` (not Effect) to cache.
- Are you integrating with something outside React? Use an Effect with cleanup.
- Are you fetching data tied to inputs/visibility? Use an Effect with race handling and cleanup.

### Review heuristics (quick scans)

- Search for `useEffect` followed by immediate `setState` of values derivable from render inputs.
  - Effects that only read props/state and don’t touch external systems are candidates for removal.
- Multiple Effects updating each other’s state in a chain indicate a missing render-time computation or misplaced event logic.
- Effects creating event listeners/timers without `return` cleanup are bugs.

### Performance notes

- Prefer render-time computation; add `useMemo` only for provably expensive pure work.
- Avoid creating new objects/arrays inline in JSX props each render; memoize when it affects memoized children.
- Keep dependency arrays minimal but complete. Split Effects if different concerns require different deps.
- Prevent unnecessary re-renders, e.g. consider using `React.memo`, `useCallback`, or `useMemo`.

### Testing guidance (see [TypeScript Test Guide](#typescript-test-guide))

- Unit test render-time derivations directly (no Effects involved).
- For Effects that fetch or subscribe, test cleanup and race handling (use fake timers/abort signals).
- RTL: assert behavior and results, not internal hook usage.

### References

- React docs: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
