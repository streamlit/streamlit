# Code Style Guide

Streamlit uses code auto-formatters and linters on pre-commit. Most of the style-related work is automatically done for you. For everything else, there's this page.

> [!NOTE]
> We have added [development guides](README.md#development-guides) for different parts of the Streamlit codebase. While written primarily for AI agents, these guides are also helpful for human developers.

## Every language

- **Write tests!** It is very rare that any contribution will be accepted without tests.
- **After tests, the most important thing is _readability_!** Name functions and variables in such a way that you don't need comments to explain the code.
- **Avoid inheritance (prefer composition)**
- **Avoid methods (prefer non-class functions, or static).**
- **Ask before introducing new dependencies!**
- **Consider splitting up your pull request.** Sometimes our pull requests get really big.

## Python

We use [PEP8 style](https://pep8.org) for Python code, with a few adjustments:

- Inside a module, anything that is declared at the root level MUST be prefixed with a `_` if it's only used inside that module. (That is, anything private must start with `_`)

### Docstrings

- Use [Numpydoc style](https://numpydoc.readthedocs.io/en/latest/format.html).
- Docstrings are meant for users of a function, not developers who may edit the internals of that function in the future. If you want to talk to future developers, use comments.
- All modules that we expect users to interact with must have top-level docstrings. If a user is not meant to interact with a module, docstrings are optional.
- Brief docstring comments on test functions are recommended, but not enforced.
- A docstring should not be a simple re-statement of the function name / class name / filename. For example, this is a bad docstring for DeltaGenerator.py: "Declares the DeltaGenerator class".

### Logging and printing

The main principle here is "anything the user may want to be able to easily pipe
into a file / another process should go into `stdout`, everything else
`stderr`".

This means you should always have logs, warnings, errors, and notices end up in
`stderr`. Never `stdout`.

## JavaScript / TypeScript

- We use the [AirBNB style](https://github.com/airbnb/javascript) for JavaScript and TypeScript.

- Before adding a new JS dependency, check that the license is compatible with Apache 2.0.

## Styling Components - CSS-in-JS

- We have removed almost all of the CSS/SCSS in our code, so please do not create new files/(S)CSS styles.
- When editing or creating a new component that needs styling, add those styles in the form of [styled components](https://emotion.sh/docs/styled) in an accompanying `styled-components.ts` file.
  - We use [Emotion](https://emotion.sh/docs/introduction) to style our components
  - All styled components begin with the word `Styled` to indicate it's a styled component.
  - We use [Object Styles](https://emotion.sh/docs/object-styles) where possible to leverage TypeScript's benefits.
  - Utilize props in styled components to display elements that may have some interactivity.
  - Where possible, avoid the need to [target other components](https://emotion.sh/docs/styled#targeting-another-emotion-component). Sometimes, targeting outside components is necessary, but we want to try to avoid the interconnectedness between these components where possible.
  - Use the theme everywhere. Each styled component has a function input with a `theme` parameter (in addition to any props). The theme argument will be equivalent in structure to the main theme. Use the proper values that match the color/spacing/sizing/font style you are looking for.
  - Sometimes, the theme won't provide a valid value. That is fine, hard-code the value if needed in either the Theme (if it can be generalized) or in the styled component (if it is a special case)
- When using [BaseWeb](https://baseweb.design), our design system library, be sure to import our theme via `useEmotionTheme` and use those values in overrides.

## Assets

If you need to add image assets, fonts, etc, first check with Streamlit developers so we can look at the license. If all is good, you'll still need to add a line to the `update-notices` rule in our `Makefile`, and rerun `make update-notices`.

![Views](https://api.views-badge.org/badge/st-wiki-styleguide)
