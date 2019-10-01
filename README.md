# Welcome to Streamlit :wave:

**[Streamlit](https://streamlit.io/) is the fastest way to build custom ML tools.**

All in Python. Free and open source.

![streamlit_uber_demo|635x380](https://aws1.discourse-cdn.com/standard10/uploads/streamlit/original/1X/292e985f7f75ef7bef8c27b5899f71f76cd577e0.gif)

Streamlit is an app framework for machine learning that allows you to rapidly create ML tools to visualize, explore, and compare your data and models. Quickly get the tools you need so you can spend more time on research and discovery and less on frontend development and infrastructure.

https://streamlit.io/

## Example

```python
import streamlit as st

# Strings appear in your app, with Markdown:
'''
# My first Streamlit app

Move the slider below and see what happens!
'''

# A simple app in 2 lines of code!
reps = st.slider('Repetitions', 1, 10)
st.write('Hello world. ' * reps)
```

## Installation :floppy_disk:

#### Prerequisites
- Your favorite IDE
- [Python 2.7.0 or later / Python 3.6.x or later](https://www.python.org/downloads/)
- [PIP](https://pip.pypa.io/en/stable/installing/)

#### Install
```
$ pip install streamlit
$ streamlit hello
```
That's it!

## Get Started :bar_chart:
- See our [Main concepts](https://streamlit.io/docs/main_concepts.html) documentation for a fast overview of how Streamlit works (data flow, caching primitives, interactive widgets).
- Use the [Getting started](https://streamlit.io/docs/getting_started.html) guide to dive into Streamlit function calls.
- If you want a deep dive into why we built Streamlit the way we did, check out this [blog post](https://needlink) by our CEO and co-founder, Adrien Treuille.

## Tutorials :flashlight:
- [These tutorials](https://streamlit.io/docs/tutorial/index.html) dive into how to create your own data exploration and model comparison apps.
- We also have a number of [demo projects](https://github.com/streamlit/) you can check out and run. Let us know if you have a cool idea for a new project we could do, and we'll add it to one our upcoming Hackathons!

## Documentation :books:
- [Main concepts](https://streamlit.io/docs/main_concepts.html)
- [Getting started](https://streamlit.io/docs/getting_started.html)
- [API reference](https://streamlit.io/docs/api.html)
- [Change log](https://streamlit.io/secret/docs/changelog.html)

## Community Support :family:
- Please join and ask questions on our [Community forum](https://discuss.streamlit.io/).
- Our development team actively follows the forum and loves to hear your feedback. Our forum is also where we post our latest release notes.

## Contributing :ant:
- Post new bugs and feature requests at [GitHub issues](https://github.com/streamlit/streamlit/issues/new/choose)
- If you'd like to contribute with code — thanks! Check out our contributing-guidelines **here**.
- For anything else, post on the [forum](https://discuss.streamlit.io/).

## License :scroll:
- Streamlit licensed under the [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) license.
