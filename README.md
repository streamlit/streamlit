# Welcome to Streamlit :wave:

**MODIFIED BY THE IMPULSO TEAM**

The modification allows a folder called "resources" on the same path from where the script was executed, to serve as a static folder for the server. It is accessible through /resources

**The fastest way to build custom ML tools.**

Streamlit lets you create apps for your machine learning projects with deceptively simple Python scripts. It supports hot-reloading, so your app updates live as you edit and save your file. No need to mess with HTTP requests, HTML, JavaScript, etc. All you need is your favorite editor and a browser. Take a look at Streamlit in action:

![Example of live coding a dashboard in Streamlit|635x380](https://aws1.discourse-cdn.com/standard10/uploads/streamlit/original/1X/292e985f7f75ef7bef8c27b5899f71f76cd577e0.gif)

**Check out our [launch blog post](https://towardsdatascience.com/coding-ml-tools-like-you-code-ml-models-ddba3357eace)!!**

**1st Way** (Tested and safe)

First install streamlit normally, then simply copy the modified file in /lib/streamlit/server/Server.py from this repo to the corresponding <streamlit_installation_path>/streamlit/server/Server.py target. You can find out where that place is by using

```bash
pip3 show streamlit
```

The problem is that this requires the user redoing the process after every streamlit update.

**2nd Way** (Not implemented yet)

If you have streamlit installed currently, uninstall it:

```
pip3 uninstall streamlit
```

Download the file in the directory "builds". Its a wheel file, then execute the command:

```
sudo pip3 install <filepath>
```

If you decide to revert to the original version do the same uninstall and then do

```
sudo pip3 install streamlit --no-cache-dir
```

**3rd Way** (Hard to work, not recommended)

Building it. (Not recommended because its too heavy and requires lots of installations)
Clone this repo:

```
https://github.com/ImpulsoGov/streamlit
```

Execute the `build.sh` script and when inside the virtualenv execute the `build-part2.sh` script.
A .whl file will be generated outside the library's repo,then repeat the above procedure pip3 install procedure with this file.

## Installation

```bash
pip install streamlit
streamlit hello
```

We also have suggestions for installing Streamlit in a virtual environment in [Windows](https://github.com/streamlit/streamlit/wiki/Installing-in-a-virtual-environment#on-windows), [Mac](https://github.com/streamlit/streamlit/wiki/Installing-in-a-virtual-environment#on-mac--linux), and [Linux](https://github.com/streamlit/streamlit/wiki/Installing-in-a-virtual-environment#on-mac--linux).

## Example

Streamlit lets you build interactive apps ridiculously easily:

```python
import streamlit as st

x = st.slider('Select a value')
st.write(x, 'squared is', x * x)
```

<img src="https://streamlit-demo-data.s3-us-west-2.amazonaws.com/squared-image-for-github-readme-2.png" width=490/>

## A Bigger Example

Despite its simplicity Streamlit lets you build incredibly rich and powerful tools. [This demo project](https://github.com/streamlit/demo-self-driving) lets you browse the entire [Udacity self-driving-car dataset](https://github.com/udacity/self-driving-car) and run inference in real time using the [YOLO object detection net](https://pjreddie.com/darknet/yolo).

![Making-of Animation](https://raw.githubusercontent.com/streamlit/demo-self-driving/master/av_final_optimized.gif "Making-of Animation")

The complete demo is implemented in less than 300 lines of Python. In fact, the app contains [only 23 Streamlit calls](https://github.com/streamlit/demo-self-driving/blob/master/app.py) which illustrates all the major building blocks of Streamlit. You can try it right now with:

```bash
pip install --upgrade streamlit opencv-python
streamlit run https://raw.githubusercontent.com/streamlit/demo-self-driving/master/app.py
```

## More Information

- Our [launch post](https://towardsdatascience.com/coding-ml-tools-like-you-code-ml-models-ddba3357eace)
- Our lovely [community](https://discuss.streamlit.io/)
- Streamlit [documentation](https://docs.streamlit.io/)
- More [demo projects](https://github.com/streamlit/)
- If you would like to contribute, see [instructions here](https://github.com/streamlit/streamlit/wiki/Contributing)

## Streamlit for Teams

[Streamlit for Teams](https://streamlit.io/for-teams/) is our enterprise edition, with single-click deploy, authentication, web editing, versioning, and more. Please contact us if you would like to learn more.

## License

Streamlit is completely free and open source and licensed under the [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) license.
