Files in this directory are static type-checking tests for the public API. `make python-types` checks them with mypy and ty. They are not executed by pytest.

This is useful because in some cases, such as those involving TypeVars and overloads, the logic necessary to determine what the types are is somewhat non-trivial, so it's nice to affirmatively check that certain typing results are correctly achieved. Furthermore, the rest of the testing code, which is naturally focused more on ensuring correct behavior, might not have sufficient coverage of the static typing possibilities; thus, this directory of code.

Intentional invalid calls use `# type: ignore[...]` for mypy and `# ty: ignore[...]` for ty. Valid calls that still disagree between checkers may keep `# ty: ignore[type-assertion-failure]`.
