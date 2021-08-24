# Connect Streamlit to Snowflake

## Introduction

This guide explains how to securely access a Snowflake database from Streamlit Sharing or Streamlit for Teams. It uses the [snowflake-connector-python](https://docs.snowflake.com/en/user-guide/python-connector.html) library and Streamlit's [secrets management](../deploy_streamlit_app.html#secrets-management).

## Create a Snowflake database

```eval_rst
.. note:: If you already have a database that you want to use, feel free to `skip to the next step <snowflake.html#add-username-and-password-to-your-local-app-secrets>`__.
```

First, [sign up for Snowflake](https://signup.snowflake.com/) and log into the [Snowflake web interface](https://docs.snowflake.com/en/user-guide/connecting.html#logging-in-using-the-web-interface) (note down your username, password, and account identifier!):

![](../media/databases/snowflake-1.png)

Enter the following queries into the SQL editor in the Worksheets page to create a database and a table with some example values:

```sql
CREATE DATABASE PETS;

CREATE TABLE MYTABLE (
    NAME            varchar(80),
    PET             varchar(80)
);

INSERT INTO MYTABLE VALUES ('Mary', 'dog'), ('John', 'cat'), ('Robert', 'bird');

SELECT * FROM MYTABLE;
```

Select **All Queries** and click on **Run** to execute the queries. Make sure to note down the name of your warehouse, database, and schema from the dropdown menu on the same page:

```eval_rst
.. thumbnail:: ../media/databases/snowflake-2.png
   :width: 50%

.. thumbnail:: ../media/databases/snowflake-3.png
   :width: 48%
```

## Add username and password to your local app secrets

Your local Streamlit app will read secrets from a file `.streamlit/secrets.toml` in your app’s root directory. Create this file if it doesn’t exist yet and add your Snowflake username, password, account identifier, and the name of your warehouse, database, and schema as shown below:

```python
# .streamlit/secrets.toml

[snowflake]
user = "xxx"
password = "xxx"
account = "xxx"
warehouse = "xxx"
database = "xxx"
schema = "xxx"
```

If you created the database from the previous step, the names of your database and schema are `PETS` and `PUBLIC`, respectively.

```eval_rst
.. important:: Add this file to ``.gitignore`` and don't commit it to your Github repo!
```

## Copy your app secrets to the cloud

As the `secrets.toml` file above is not committed to Github, you need to pass its content to your deployed app (on Streamlit Sharing or Streamlit for Teams) separately. Go to the [app dashboard](https://share.streamlit.io/) and in the app's dropdown menu, click on **Edit Secrets**. Copy the content of `secrets.toml` into the text area. More information is available at [Secrets Management](../deploy_streamlit_app.html#secrets-management).

![](../media/databases/edit-secrets.png)

## Add snowflake-connector-python to your requirements file

Add the [snowflake-connector-python](https://docs.snowflake.com/en/user-guide/python-connector.html) package to your `requirements.txt` file, preferably pinning its version (replace `x.x.x` with the version you want installed):

```
# requirements.txt
snowflake-connector-python==x.x.x
```

## Write your Streamlit app

Copy the code below to your Streamlit app and run it. Make sure to adapt query to use the name of your table.

```python
# streamlit_app.py

import streamlit as st
import snowflake.connector

# Initialize connection.
# Uses st.cache to only run once.
@st.cache(allow_output_mutation=True, hash_funcs={"_thread.RLock": lambda _: None})
def init_connection():
    return snowflake.connector.connect(**st.secrets["snowflake"])

conn = init_connection()

# Perform query.
# Uses st.cache to only rerun when the query changes or after 10 min.
@st.cache(ttl=600)
def run_query(query):
    with conn.cursor() as cur:
        cur.execute(query)
        return cur.fetchall()

rows = run_query("SELECT * from mytable;")

# Print results.
for row in rows:
    st.write(f"{row[0]} has a :{row[1]}:")
```

See `st.cache` above? Without it, Streamlit would run the query every time the app reruns (e.g. on a widget interaction). With `st.cache`, it only runs when the query changes or after 10 minutes (that's what `ttl` is for). Watch out: If your database updates more frequently, you should adapt `ttl` or remove caching so viewers always see the latest data. Read more about caching [here](../caching.md).

If everything worked out (and you used the example table we created above), your app should look like this:

![](../media/databases/snowflake-4.png)
