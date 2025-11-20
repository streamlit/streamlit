---
applyTo: "**/*.ts, **/*.tsx"
---

# TypeScript Development Guide

- TypeScript: v5
- Linter: eslint v9
- Formatter: prettier v3
- Framework: React v18
- Styling: @emotion/styled v11
- Build tool: vite v7
- Testing: vitest v3 & react testing library v16
- Package manager: yarn v4 with workspaces

## Key TypeScript Principles

- Prefer functional, declarative programming.
- Prefer iteration and modularization over duplication.
- Use descriptive variable names with auxiliary verbs (e.g., isLoading).
- Use the Receive an Object, Return an Object (RORO) pattern.
- Ensure functions have explicit return types.
- **Prefer optional chaining**: Use optional chaining (`?.`) instead of `&&` chains for property access. This is enforced by the `@typescript-eslint/prefer-optional-chain` rule.

## Key Frontend Principles

- Leverage all of best practices of React 18.
- Write performant frontend code.
- Ensure referential stability by leveraging React Hooks.
- Prefix event handlers with "handle" (e.g., handleClick, handleSubmit).
- Favor leveraging @emotion/styled instead of inline styles.
- Leverage object style notation in Emotion.
- All styled components begin with the word `Styled` to indicate it's a styled component.
- Utilize props in styled components to display elements that may have some interactivity.
  - Avoid the need to target other components.
- When using BaseWeb, be sure to import our theme via `useEmotionTheme` and use those values in overrides.
- Use the following pattern for naming custom CSS classes and test IDs: `stComponentSubcomponent`, for example: `stTextInputIcon`.
- Avoid using pixel sizes for styling, always use rem, em, percentage, or other relative units.

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
  const alignmentMap = { /* same data */ }
  return alignmentMap[config.alignment]
}
```

</bad-example>

## Yarn Workspaces

- Project Structure: Monorepo managed with Yarn Workspaces.
- Packages:
  - `app` - Main application UI.
  - `connection` - WebSocket handling
  - `lib` - Shared UI components.
  - `utils` - Shared TypeScript utilities.
  - `protobuf` - Generated Protocol definitions.
  - `typescript-config` - Configuration for TypeScript.
  - `eslint-plugin-streamlit-custom` - ESLint plugin with custom rules.
- Package-specific scripts are executed within their respective directories.

## Relevant `make` commands

Run from the repo root:

- `make frontend-fast`: Build the frontend (vite).
- `make frontend-dev`: Start the frontend development server (hot-reload).
- `make frontend-lint`: Lint and check formatting of frontend files (eslint).
- `make frontend-types`: Run the TypeScript type checker (tsc).
- `make frontend-format`: Format frontend files (eslint).
- `make frontend-tests`: Run all frontend unit tests (vitest).

## TypeScript Test Guide

- Test Framework: Vitest
- UI Testing Library: React Testing Library (RTL)

### Key Principles

- Coverage: Implement both unit and integration tests (using RTL where applicable).
- Robustness: Test edge cases and error handling scenarios.
- Accessibility: Validate component accessibility compliance.
- Parameterized Tests: Use `it.each` for repeated tests with varying inputs.
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

### Testing guidance (see [TypeScript Test Guide](#typescript-test-guide))

- Unit test render-time derivations directly (no Effects involved).
- For Effects that fetch or subscribe, test cleanup and race handling (use fake timers/abort signals).
- RTL: assert behavior and results, not internal hook usage.

### References

- React docs: You Might Not Need an Effect — https://react.dev/learn/you-might-not-need-an-effect
