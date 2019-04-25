```eval_rst
:tocdepth: 1
```

# Getting started

Installing Streamlit is just a one-line operation! But first there are some
prerequisites that we must get out of the out of the way:

1. Streamlit requires Python 2.7 or higher, or 3.6 or higher.
2. You'll also need **one of** the following Python package managers:
   - **PIP**:
   [Here](https://pip.pypa.io/en/stable/installing/) is how you can install
   PIP.
   - **Conda**: You can find [instructions
     here](https://conda.io/projects/conda/en/latest/user-guide/install/index.html?highlight=conda).

## Installation

You can install Streamlit by typing one of the following into a terminal:

### Installation via PIP

```bash
$ pip install streamlit
```

### Installation via Conda

```bash
# Add required channels.
$ conda config --add channels conda-forge
$ conda config --add channels https://repo.streamlit.io/streamlit-forge

# Update conda (always a good idea)
$ conda update conda

# Install Streamlit!
$ conda install streamlit
```

## Testing it out
Now that you installed Streamlit, go ahead and try launching our included
"hello world" report:

```bash
$ streamlit hello
```

This last command should open a new tab in your web browser.

The doc that just opened in that tab is actually really useful, and you'll
likely be getting back to it every now and then for quick reference. So to
finish up, we recommend you **take a minute to read that doc** since
it is a great crash course on the most important Streamlit commands.

Next, let's create our [first Streamlit
report](tutorial/tutorial1_first_steps).

## Note

By default, Streamlit collects statistics about how often certain features are
used, and sends them to our servers so we can better understand how to improve
the product. If you would like to opt out, just type these commands in a
terminal:

```bash
$ mkdir -p ~/.streamlit
$ cat << EOF >> ~/.streamlit/config.toml
[browser]
gatherUsageStats = false
EOF
```

