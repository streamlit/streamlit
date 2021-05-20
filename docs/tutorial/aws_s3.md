# Connect Streamlit to AWS S3

## Introduction

This guide explains how to securely access files on AWS S3 from Streamlit sharing or Streamlit for Teams. It uses the [s3fs](https://github.com/dask/s3fs) library and Streamlit's [secrets management](../deploy_streamlit_app.html#secrets-management).

## Create an S3 bucket and add a file

```eval_rst
.. note:: If you already have a bucket that you want to use, feel free to `skip to the next step <aws_s3.html#create-access-keys>`__.
```

First, [sign up for AWS](https://aws.amazon.com/) or log in. Go to the [S3 console](https://s3.console.aws.amazon.com/s3/home) and create a new bucket:

```eval_rst
.. thumbnail:: ../media/databases/aws-1.png
   :width: 49%

.. thumbnail:: ../media/databases/aws-2.png
   :width: 49%
```

Navigate to the upload section of your new bucket:

```eval_rst
.. thumbnail:: ../media/databases/aws-3.png
   :width: 49%

.. thumbnail:: ../media/databases/aws-4.png
   :width: 49%

And upload the following CSV file, which contains some example data:

:download:`myfile.csv <../media/databases/myfile.csv>`
```

## Create access keys

Go to the [AWS console](https://console.aws.amazon.com/), create access keys as shown below and copy the "Access Key ID" and "Secret Access Key":

```eval_rst
.. thumbnail:: ../media/databases/aws-5.png
   :width: 49%

.. thumbnail:: ../media/databases/aws-6.png
   :width: 49%

.. tip:: Access keys created as a root user have wide-ranging permissions. In order to make your AWS account more secure, you should consider creating an IAM account with restricted permissions and using its access keys. More information `here <https://docs.aws.amazon.com/general/latest/gr/aws-sec-cred-types.html>`__. 
```

## Add the key to your local app secrets

Your local Streamlit app will read secrets from a file `.streamlit/secrets.toml` in your app's root directory. Create this file if it doesn't exist yet and add the access key to it as shown below:

```python
# .streamlit/secrets.toml
AWS_ACCESS_KEY_ID = "xxx"
AWS_SECRET_ACCESS_KEY = "xxx"
```
```eval_rst
.. important:: Add this file to ``.gitignore`` and don't commit it to your Github repo!
```

## Copy your app secrets to the cloud

As the `secrets.toml` file above is not committed to Github, you need to pass its content to your deployed app (on Streamlit sharing or Streamlit for Teams) separately. Go to the [app dashboard](https://share.streamlit.io/) and in the app's dropdown menu, click on **Edit Secrets**. Copy the content of `secrets.toml` into the text area. More information in [Secrets Management](../deploy_streamlit_app.html#secrets-management).

![](../media/databases/aws-7.png)

## Add s3fs to your requirements file

Add the [s3fs](https://github.com/dask/s3fs) package to your `requirements.txt` file, preferably pinning its version (just replace `x.x.x` with the version you want installed):

```
# requirements.txt
s3fs==x.x.x
```

## Write your Streamlit app

Copy the code below to your Streamlit app and run it. Make sure to adapt the name of your bucket and file. Note that Streamlit automatically turns the access keys from your secrets file into environment variables, where `s3fs` searches for them by default.

```python
# streamlit_app.py

import streamlit as st
import s3fs
import os

# Create connection object.
# `anon=False` means not anonymous, i.e. it uses access keys to pull data.
fs = s3fs.S3FileSystem(anon=False)

# Retrieve file contents. 
# Uses st.cache to only rerun when the query changes or after 10 min.
@st.cache(ttl=600)
def read_file(filename):
    with fs.open(filename) as f:
        return f.read().decode("utf-8")

content = read_file("testbucket-jrieke/myfile.csv")

# Print results.
for line in content.strip().split("\n"):
    name, pet = line.split(",")
    st.write(f"{name} has a :{pet}:")
```

See `st.cache` above? Without it, Streamlit would run the query every time the app reruns (e.g. on a widget interaction). With `st.cache`, it only runs when the query changes or after 10 minutes (that's what `ttl` is for). Watch out: If your database updates more frequently, you should adapt `ttl` or remove caching so viewers always see the latest data. Read more about caching [here](../caching.md).

If everything worked out (and you used the example file given above), your app should look like this:

![](../media/databases/aws-8.png)