---
title: "Getting started"
weight: 1
---

Installing Streamlit is just a one-line operation! But first there are some
prerequisites that we must get out of the out of the way:

1. Streamlit requires Python 2.7 or higher, or 3.6 or higher.
2. You'll also need the `pip` tool for installing Python packages. [Here](https://pip.pypa.io/en/stable/installing/) is how you can install `pip`.

## Installation

You can install Streamlit by typing the following line into a terminal:

```bash
$ pip install streamlit
```

**...and you're done!** So now you can go ahead and try launching our
quick-reference page, which is itself written as a Streamlit report:

```bash
$ streamlit help
```

This last command should open a new tab in your web browser.

The doc that just opened in that tab is actually really useful, and you'll
likely be getting back to it every now and then for quick reference. So to
finish up, we recommend you **take a minute to read that doc** since
it is a great crash course on the most important Streamlit commands.

Next, let's create our [first Streamlit report](/docs/tutorial/).

## Note

By default, Streamlit collects statistics about how often certain features are
used, and sends them to our servers so we can better understand how to improve
the product. If you would like to opt out, just type these commands in a
terminal:

```
$ mkdir -p ~/.streamlit
$ cat << EOF >> ~/.streamlit/config.yaml
client:
  remotelyTrackUsage: false
EOF
```
