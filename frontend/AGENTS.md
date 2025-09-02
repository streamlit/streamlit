# TypeScript Development Guide

- TypeScript: v5
- Linter: eslint v9
- Formatter: prettier v3
- Framework: React v18
- Styling: @emotion/styled v11
- Build tool: vite v6
- Package manager: yarn v4 with workspaces

## Key TypeScript Principles

- Prefer functional, declarative programming.
- Prefer iteration and modularization over duplication.
- Use descriptive variable names with auxiliary verbs (e.g., isLoading).
- Use the Receive an Object, Return an Object (RORO) pattern.
- Ensure functions have explicit return types.

## Key Frontend Principles

- Leverage all of best practices of React 18.
- Write performant frontend code.
- Ensure referential stability by leveraging React Hooks.
- Prefix event handlers with "handle" (eg: handleClick, handleSubmit).
- Favor leveraging @emotion/styled instead of inline styles.
- Leverage object style notation in Emotion.
- All styled components begin with the word `Styled` to indicate it's a styled component.
- Utilize props in styled components to display elements that may have some interactivity.
  - Avoid the need to target other components.
- When using BaseWeb, be sure to import our theme via `useEmotionTheme` and use those values in overrides.
- Use the following pattern for naming custom CSS classes and test IDs: `stComponentSubcomponent`, for example: `stTextInputIcon`.

## Yarn Workspaces

- Project Structure: Monorepo managed with Yarn Workspaces.
- Packages: `app, connection, lib, protobuf, typescript-config, utils`
- Package-specific scripts are executed within their respective directories.

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
