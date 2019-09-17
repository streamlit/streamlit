# Streamlit documentation

We use Sphinx to build our documentation site. This allows us autogenerate some
of the documentation, using Sphinx's autodoc directives.

## Basics

The documentation is written using Markdown (`.md`), ReStructuredText (`.rst`),
and pure text (`.txt`) files in this folder and its subfolders. The default
format for Sphinx is rst, but md syntax is simpler so that's what we're
using for Streamlit.

However, since md syntax is less powerful than rst, sometimes we insert
ReStructuredText code into our Markdown files using a special code block (more
on this below).

## File and folder structure

- `conf.py` This is Sphinx's configuration file.
- `_build/` This is where the generated documentation goes.
- `_ext/` This is where custom extensions to ReStructuredText are placed.
- `_templates/` Not used right now, but if we ever decide to use custom
  templates, this is where they should go.
- `_static/` Not used right now, but if we ever decide to use custom
  templates, this is where their static files (CSS, etc) should go.

## Building

To build the docs just **go to the folder above this one** and run:

```bash
$ make docs
```

Or you can build _and start a web server_ by running:

```bash
$ make devel-docs
```

The docs will be viewable at http://localhost:8000. **Note that any time you
modify the source files you'll need to manually rebuild the docs.**

## Publishing

To publish the docs into our public site, **go to the folder above this one**
and run:

```bash
$ make publish-docs
```

## Embedding ReStructuredText into Markdown

Sometimes we need our Markdown files to go beyond what its allowed in the md
spec. In those cases, we can embed ReStructuredText code in a special
block that tells Sphinx to parse it with the rst parser:

    This code is Markdown

    ```eval_rst
    This code is ReStructuredText
    ```

    An this is Markdown again.

This is used often in our documentation in order to do things like generating
our table of contents and automatically generating documentation for our Python
modules.

## Embedding Streamlit apps

It's a good idea to make sure our docs have plenty of example code and their
results. Rather than showing the results using a boring static image, you can
embed a Streamlit app right in the documentation. To do this, just use our
custom directive, called `output`:

```rst
.. output::
   [URL to Streamlit app]
   [inline styles to pass to the <iframe> tag]
```

For example:

```rst
.. output::
   https://share.streamlit.io/0.25.0-22EmZ/index.html?id=YHHvgDnAdo5JKQivWhK6tE
   height: 200px
```

or simply:

```rst
.. output::
   https://share.streamlit.io/0.25.0-22EmZ/index.html?id=YHHvgDnAdo5JKQivWhK6tE
```

You can use this directive "as is" inside pydoc strings and ReStructuredText
files. To use it in Markdown files, though, you need to do the following:

    This is my Markdown file

    ```eval_rst
    .. output::
       https://share.streamlit.io/0.25.0-22EmZ/index.html?id=YHHvgDnAdo5JKQivWhK6tE
    ```

    An this is Markdown again.

### Location of embedded app source files

Before we can use `.. output::` to embed a Streamlit app in some doc, we
first need to create a Streamlit-powered Python script, run it, share it, and
take note of its shared URL. To make these scripts easier to find, we place
them in the same folder as the file that references them, and name them using
the following pattern:

```
[referrer file name].[example name].py
```

For example, if `docs/api/charts.py` includes an embedded example of a Vega-Lite chart,
then the Python script to generate that should be:

```
docs/api/charts.vega_lite_chart.py
```
