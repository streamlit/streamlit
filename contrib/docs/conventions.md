# Streamlit Coding Conventions

## Every language
- Set up your editor to use our `.editorconfig file` (see
  [http://editorconfig.org])
- Set up a linter in your editor!
- Always include the Streamlit license header in all files:

  > Copyright 2018 Streamlit Inc. All rights reserved.

- Never leave commented-out code in the codebase.

## Python

We use [PEP8 style](https://pep8.org) for Python code, with a few adjustments:

### Imports

* Always put Python2/3 compatibility imports at the top of the import list
* Imports should be split into groups, in this order:
  - Compat
  - Standard library
  - 3rd party
  - Streamlit
* Imports within each group should be sorted
* Imports should not wrap (makes them easier to sort)
* Don’t import items from modules; import the entire module instead:
  - WRONG: `from streamlit.mymodule import internal_function`
  - RIGHT: `from streamlit import mymodule`
* The exception to the above is classes. You should import them this way:
  - RIGHT: `from streamlit.MyClass import MyClass`
* Only one import per line:
  - WRONG: `from streamlit import module1, module2`
  - RIGHT:
  ```
  from streamlit import module1
  from streamlit import module2
  ```

### Doctstrings

* Use [Numpydoc style](https://numpydoc.readthedocs.io/en/latest/format.html).

### Logging and printing

The main principle here is "anything the user may want to able to easily pipe
into a file / another process should go into `stdout`, everything else
`stderr`".

This means you should always have logs, warnings, errors, and notices end up in
`stderr`. Never `stdout`.


## JavaScript

We use the [AirBNB style](https://github.com/airbnb/javascript).

We've begun moving some of our JavaScript code to TypeScript. In TypeScript files, we're using arrow-functions for class functions:

```typescript
class MyClass {
  // Do this:
  public sayHello = (name: string) => {
    console.log(`Hello, ${name}!`);
  };

  // Not this:
  public dontSayItLikeThis(name: string) {
    console.log(`Hello, ${name}!`);
  }
}
```

This saves the programmer from having to remember to `bind(this)` within a class's constructor on all the class's member functions that are invoked by React elements.

(This pattern works in JavaScript as well, but we're only enforcing it in TypeScript.)
