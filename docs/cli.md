```eval_rst
:tocdepth: 1
```

# Command-line interface

When you install Streamlit, the Streamlit command-line CLI tool gets installed
as well. The main purpose of this tool is to help you diagnose and fix issues.

You can find docs for our CLI tool as usual:

```bash
$ streamlit --help
```

Below are a few of the most useful commands accepted by Streamlit CLI:

## streamlit run

```bash
$ streamlit run your_script.py [script args]
```

Runs your app. At any time you can kill the server with **Ctrl+c**. This is useful when making config changes or changing apps/scripts.

## \-\-version

```bash
$ streamlit --version
```

Shows the version of Streamlit in your current Python environment.

## docs

```bash
$ streamlit docs
```

Opens Streamlit's documentation (i.e. this website) in a web browser.

## hello

```bash
$ streamlit hello
```

Opens Streamlit's Hello World app in a web browser. This is useful for
testing Streamlit.

## config show

```bash
$ streamlit config show
```

Shows all config options for Streamlit, as well as their current values.

## cache clear

```bash
$ streamlit cache clear
```

Clears the [Streamlit cache](api.html#optimize-performance).
