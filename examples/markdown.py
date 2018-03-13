"""Example of everything that's possible in streamlet."""

import sys

sys.path.append('local/server')
from streamlet import Notebook, Chart, LineChart

with Notebook() as write:

    write("# Markdown Example", fmt='markdown')

    write.markdown("""
This example shows how to format text using Markdown, a simple markup language.
Accoring to its inventor [John Gruber](https://en.wikipedia.org/wiki/John_Gruber):

> Markdown is intended to be as easy-to-read and easy-to-write as is feasible

It allows for adding markup to plain text with intuitive and minimal syntax.
For example:

- to *emphasize* a word simply surround it with `*`
- headings are prefixed with `#`, where the count indicates the level
- lists like these have each item prefixed with `-`

```python
  # it's even possible to display code
  for i in range(0, 10):
    print(i)
```
""")

    write.markdown("Check out [Markdown: Syntax](https://daringfireball.net/projects/markdown/syntax) for a complete syntax overview.")
