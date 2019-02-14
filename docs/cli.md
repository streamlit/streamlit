```eval_rst
:tocdepth: 1
```

# Command-line tool

When you install Streamlit, the Streamlit CLI tool gets installed as
well. The main purpose of this tool is to help you diagnose and fix issues.

Below are the commands accepted by Streamlit CLI:

## version

```bash
$ streamlit version
```
Shows the version of Streamlit in your current Python environment.

## help

```bash
$ streamlit help
```
Opens Streamlit's documentation (i.e. this website) in a web browser.

## hello

```bash
$ streamlit hello
```
Opens Streamlit's Hello World report in a web browser. This is useful for
testing Streamlit.

## kill_proxy

```bash
$ streamlit kill_proxy
```
Kills the Streamlit proxy server, if any. This is useful when making config
changes, for example, since the config file is read when the server
initializes.

## show_config

```bash
$ streamlit show_config
```
Shows all config options for Streamlit, as well as their current values.
