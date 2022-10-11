# Welcome to Streamlit :wave:

**The fastest way to build and share data apps.**

Streamlit lets you turn data scripts into shareable web apps in minutes, not weeks. It’s all Python, open-source, and free! And once you’ve created an app you can use our [Community Cloud platform](https://streamlit.io/cloud) to deploy, manage, and share your app!

![Example of live coding an app in Streamlit|635x380](https://raw.githubusercontent.com/streamlit/docs/main/public/images/Streamlit_overview.gif)

## Installation

```bash
pip install streamlit
streamlit hello
```

Streamlit can also be installed in a virtual environment on [Windows](https://github.com/streamlit/streamlit/wiki/Installing-in-a-virtual-environment#on-windows), [Mac](https://github.com/streamlit/streamlit/wiki/Installing-in-a-virtual-environment#on-mac--linux), and [Linux](https://github.com/streamlit/streamlit/wiki/Installing-in-a-virtual-environment#on-mac--linux).

## A little example

Streamlit makes it incredibly easy to build interactive apps:

```python
import streamlit as st

x = st.slider('Select a value')
st.write(x, 'squared is', x * x)
```

<img src="https://raw.githubusercontent.com/streamlit/docs/main/public/images/simple_example.png"/>

## A bigger example

Streamlit's simple and focused API lets you build incredibly rich and powerful tools.  [This demo project](https://github.com/streamlit/demo-self-driving) lets you browse the entire [Udacity self-driving-car dataset](https://github.com/udacity/self-driving-car) and run inference in real-time using the [YOLO object detection net](https://pjreddie.com/darknet/yolo).

![Final App Animation](https://raw.githubusercontent.com/streamlit/docs/main/public/images/complex_app_example.gif)

The complete demo is implemented in less than 300 lines of Python. In fact, the app contains [only 23 Streamlit calls](https://github.com/streamlit/demo-self-driving/blob/master/streamlit_app.py) which illustrates all the major building blocks of Streamlit. You can try it right now at [share.streamlit.io/streamlit/demo-self-driving](https://share.streamlit.io/streamlit/demo-self-driving).

## The Streamlit GitHub badge

Streamlit's GitHub badge helps others find and play with your Streamlit app.

[![Streamlit App](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://share.streamlit.io/streamlit/demo-face-gan)

Once you deploy your app, you can embed this badge right into your GitHub readme.md as follows:

```markdown
[![Streamlit App](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://share.streamlit.io/yourGitHubName/yourRepo/yourApp/)
```

## More Information

- Our [launch post](https://towardsdatascience.com/coding-ml-tools-like-you-code-ml-models-ddba3357eace?source=friends_link&sk=f7774c54571148b33cde3ba6c6310086) explaining why we created Streamlit
- Our [Community Cloud platform announcement](https://blog.streamlit.io/introducing-streamlit-cloud)
- Our amazing [community](https://discuss.streamlit.io/) where Streamlit users share apps, ask questions, and help each other out
- Streamlit [documentation](https://docs.streamlit.io/) and [blog](https://blog.streamlit.io) for the latest Streamlit info
- More [demo projects](https://github.com/streamlit/) to inspire you
- And if you would like to contribute, see [instructions here](https://github.com/streamlit/streamlit/wiki/Contributing)

## Community Cloud

With [Community Cloud](https://streamlit.io/cloud) you can deploy, manage, and share your apps with the world, directly from Streamlit — all for free. Sign-up [here](https://share.streamlit.io/signup).

## License

Streamlit is completely free and open-source and licensed under the [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) license.

