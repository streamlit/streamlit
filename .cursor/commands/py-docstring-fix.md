# Python Docstrings - Fix

## Overview

Add or correct Numpydoc-style docstrings for public modules, classes, functions, and methods without changing code behavior.

Refer to the Docstrings guidance in `.cursor/rules/python.mdc`.

## Success Criteria

- All public APIs have clear, accurate Numpydoc docstrings.
- Module-level docstrings exist for user-facing modules.
- Parameter names, types, defaults, and behavior align with the implementation and type hints.
- Relevant exceptions are documented in a `Raises` section.
- Nontrivial functions/classes include a minimal, runnable `Examples` section.
- `make python-lint` and `make python-tests` pass.

## What to do

1. Discover targets

   - Find public callables and classes missing docstrings or with incomplete/incorrect content.
   - Add module-level docstrings where users are expected to import from the module.

2. Write/repair docstrings (Numpydoc)

   - Start with a one-sentence summary line (imperative mood), followed by a short paragraph if useful.
   - Common sections to use:
     - `Parameters`: names, types, and concise descriptions; include defaults (e.g., `float, default=1e-9`).
     - `Returns` or `Yields`: type and meaning; describe shape/units if applicable.
     - `Raises`: list exceptions and the conditions that trigger them.
     - `Examples`: simple doctest-style examples for nontrivial behavior.
     - Optionally: `See Also`, `Notes`, `Warnings` for important context.
   - For classes, document constructor arguments in the class docstring rather than `__init__`.
   - Keep terminology consistent with code; align with type hints and actual behavior.

3. Validate
   - Ensure no code behavior or signatures change.
   - Run `make python-lint` and `make python-tests` and fix any issues.

## Do not

- Modify production logic, public APIs, or test behavior.
- Reformat unrelated code.
- Add speculative sections (e.g., `Raises`) that do not reflect actual behavior.

## Example (format only)

```python
def normalize(values: Sequence[float], *, epsilon: float = 1e-9) -> list[float]:
    """Normalize values so they sum to 1.

    Parameters
    ----------
    values : Sequence[float]
        Input numbers; must be finite and non-empty.
    epsilon : float, default=1e-9
        Small constant to avoid division by zero.

    Returns
    -------
    list[float]
        Normalized weights summing to 1.

    Raises
    ------
    ValueError
        If `values` is empty or contains non-finite numbers.

    Examples
    --------
    >>> normalize([1, 1, 2])
    [0.25, 0.25, 0.5]
    """
```

## Checklist

[ ] Public modules/classes/functions/methods documented with Numpydoc.
[ ] Module-level docstrings added where applicable.
[ ] Parameter names, types, and defaults aligned with code and hints.
[ ] Relevant exceptions listed in `Raises`.
[ ] Examples added for nontrivial APIs.
[ ] `make python-lint` and `make python-tests` pass.
