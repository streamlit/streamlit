# Connect Streamlit to MongoDB

## Introduction

This guide explains how to securely access a MongoDB database from Streamlit sharing or Streamlit for Teams. It uses the [PyMongo](https://github.com/mongodb/mongo-python-driver) library and Streamlit's [secrets management](../deploy_streamlit_app.html#secrets-management).

## Create a MongoDB Database

```eval_rst
.. note:: If you already have a database that you want to use, feel free to `skip to the next step <mongodb.html#add-username-and-password-to-your-local-app-secrets>`__.
```

First, follow the official tutorials to [install MongoDB](https://docs.mongodb.com/guides/server/install/), [set up authentication](https://docs.mongodb.com/guides/server/auth/) (note down the username and password!), and [connect to the MongoDB instance](https://docs.mongodb.com/guides/server/drivers/). Once you are connected, open the `mongo` shell and enter the following two commands to create a collection with some example values:

```
use mydb
db.mycollection.insertMany([{"name" : "Mary", "pet": "dog"}, {"name" : "John", "pet": "cat"}, {"name" : "Robert", "pet": "bird"}])
```

## Add username and password to your local app secrets

Your local Streamlit app will read secrets from a file `.streamlit/secrets.toml` in your app's root directory. Create this file if it doesn't exist yet and add the database information as shown below:

```
# .streamlit/secrets.toml

[mongo]
host = "localhost"
port = 27017
username = "xxx"
password = "xxx"
```

```eval_rst
.. important:: Add this file to ``.gitignore`` and don't commit it to your Github repo!
```

## Copy your app secrets to the cloud

As the `secrets.toml` file above is not committed to Github, you need to pass its content to your deployed app (on Streamlit sharing or Streamlit for Teams) separately. Go to the [app dashboard](https://share.streamlit.io/) and in the app's dropdown menu, click on **Edit Secrets**. Copy the content of `secrets.toml` into the text area. More information in [Secrets Management](../deploy_streamlit_app.html#secrets-management).

![](../media/databases/mongodb-1.png)

## Add PyMongo to your requirements file

Add the [PyMongo](https://github.com/mongodb/mongo-python-driver) package to your `requirements.txt` file, preferably pinning its version (just replace `x.x.x` with the version you want installed):

```
# requirements.txt
pymongo==x.x.x
```

## Write your Streamlit app

Copy the code below to your Streamlit app and run it. Make sure to adapt the name of your database and collection.

```python
# streamlit_app.py

import streamlit as st
import pymongo

# Initialize connection.
client = pymongo.MongoClient(**st.secrets["mongo"])

# Pull data from the collection.
# Uses st.cache to only rerun when the query changes or after 10 min.
@st.cache(ttl=600)
def get_data():
    db = client.mydb
    items = db.mycollection.find()
    items = list(items)  # make hashable for st.cache
    return items

items = get_data()

# Print results.
for item in items:
    st.write(f"{item['name']} has a :{item['pet']}:")
```

See `st.cache` above? Without it, Streamlit would run the query every time the app reruns (e.g. on a widget interaction). With `st.cache`, it only runs when the query changes or after 10 minutes (that's what `ttl` is for). Watch out: If your database updates more frequently, you should adapt `ttl` or remove caching so viewers always see the latest data. Read more about caching [here](../caching.md). 

If everything worked out (and you used the example data we created above), your app should look like this:

![](../media/databases/mongodb-2.png)