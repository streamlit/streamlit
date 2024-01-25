<br>

<img src="https://user-images.githubusercontent.com/7164864/217935870-c0bc60a3-6fc0-4047-b011-7b4c59488c91.png" alt="Streamlit logo" style="margin-top:50px"></img>

# Streamlit: Turn Data Scripts into Web Apps in Minutes

**Welcome to Streamlit!**  Want to share your data insights and analysis without weeks of web development? Streamlit lets you transform Python scripts into interactive web apps in minutes, all with simple, expressive code. Once you’ve created an app you can use our [Community Cloud platform](https://streamlit.io/cloud) to deploy, manage, and share your app.



## What can you do with Streamlit?

* **Explore and visualize data:** Plot charts, build dashboards, and generate reports effortlessly.
* **Build interactive prototypes:** Let others interact with your data and provide feedback directly.
* **Share your work:** Deploy your app to the Streamlit Cloud or embed it anywhere on the web.
* **Collaborate with others:** Seamlessly work with co-developers and contribute to shared apps.

## Why choose Streamlit?

* **Simple and Pythonic:** Write beautiful code that's easy to read and understand.
* **Fast and Efficient:** Streamlit apps run lightning-fast, with minimal setup and dependencies.
* **Highly Customizable:** Build apps that match your brand and style with complete control over layout and design.
* **Open-Source and Free:** Join a vibrant community and contribute to Streamlit's future.



## Installation

Open a terminal and run:

```bash
$ pip install streamlit
$ streamlit hello
```

If this opens our sweet _Streamlit Hello_ app in your browser, you're all set! If not, head over to [our docs](https://docs.streamlit.io/library/get-started) for specific installs.

The app features a bunch of examples of what you can do with Streamlit. Jump to the [quickstart](#quickstart) section to understand how that all works.

<img src="https://user-images.githubusercontent.com/7164864/217936487-1017784e-68ec-4e0d-a7f6-6b97525ddf88.gif" alt="Streamlit Hello" width=500 href="none"></img>

## Quickstart

### A little example

Create a new file `streamlit_app.py` with the following code:
```python
import streamlit as st
x = st.slider("Select a value")
st.write(x, "squared is", x * x)
```

Now run it to open the app!
```
$ streamlit run streamlit_app.py
```

<img src="https://user-images.githubusercontent.com/7164864/215172915-cf087c56-e7ae-449a-83a4-b5fa0328d954.gif" width=300 alt="Little example"></img>

### Give me more!

Streamlit comes in with [a ton of additional powerful elements](https://docs.streamlit.io/library/api-reference) to spice up your data apps and delight your viewers. Some examples:


<table border="0">
  <tr>
    <td>
      <a target="_blank" href="https://docs.streamlit.io/library/api-reference/widgets">
        <img src="https://user-images.githubusercontent.com/7164864/217936099-12c16f8c-7fe4-44b1-889a-1ac9ee6a1b44.png" style="max-height:150px; width:auto; display:block;">
      </a>
    </td>
    <td>
      <a target="_blank" href="https://docs.streamlit.io/library/api-reference/data/st.dataframe">
        <img src="https://user-images.githubusercontent.com/7164864/215110064-5eb4e294-8f30-4933-9563-0275230e52b5.gif" style="max-height:150px; width:auto; display:block;">
      </a>
    </td>
    <td>
      <a target="_blank" href="https://docs.streamlit.io/library/api-reference/charts">
        <img src="https://user-images.githubusercontent.com/7164864/215174472-bca8a0d7-cf4b-4268-9c3b-8c03dad50bcd.gif" style="max-height:150px; width:auto; display:block;">
      </a>
    </td>
    <td>
      <a target="_blank" href="https://docs.streamlit.io/library/api-reference/layout">
        <img src="https://user-images.githubusercontent.com/7164864/217936149-a35c35be-0d96-4c63-8c6a-1c4b52aa8f60.png" style="max-height:150px; width:auto; display:block;">
      </a>
    </td>
    <td>
      <a target="_blank" href="https://docs.streamlit.io/library/get-started/multipage-apps">
        <img src="https://user-images.githubusercontent.com/7164864/215173883-eae0de69-7c1d-4d78-97d0-3bc1ab865e5b.gif" style="max-height:150px; width:auto; display:block;">
      </a>
    </td>
    <td>
      <a target="_blank" href="https://streamlit.io/gallery">
        <img src="https://user-images.githubusercontent.com/7164864/215109229-6ae9111f-e5c1-4f0b-b3a2-87a79268ccc9.gif" style="max-height:150px; width:auto; display:block;">
      </a>
    </td>
  </tr>
  <tr>
    <td>Input widgets</td>
    <td>Dataframes</td>
    <td>Charts</td>
    <td>Layout</td>
    <td>Multi-page apps</td>
    <td>Fun</td>
  </tr>
</table>


Our vibrant creators community also extends Streamlit capabilities using  🧩 [Streamlit Components](http://components.streamlit.app).

## Get inspired

There's so much you can build with Streamlit:
- 🤖  [LLMs & chatbot apps](https://streamlit.io/gallery?category=llms)
- 🧬  [Science & technology apps](https://streamlit.io/gallery?category=science-technology)
- 💬  [NLP & language apps](https://streamlit.io/gallery?category=nlp-language)
- 🏦  [Finance & business apps](https://streamlit.io/gallery?category=finance-business)
- 🗺  [Geography & society apps](https://streamlit.io/gallery?category=geography-society)
- and more!

**Check out [our gallery!](https://streamlit.io/gallery)** 🎈

## Bonus Features

* **Live Editing:** See your app update instantly as you edit your script.
* **Magic Commands:** Write less code with expressive functions for common tasks.
* **Components:** Build reusable UI elements for cleaner and more modular apps.
* **Enterprise Features:** Secure and scalable deployment options for teams.

## Community Cloud

Deploy, manage and share your apps for free using our [Community Cloud](https://streamlit.io/cloud)! Sign-up [here](https://share.streamlit.io/signup). <br><br>
<img src="https://user-images.githubusercontent.com/7164864/214965336-64500db3-0d79-4a20-8052-2dda883902d2.gif" width="400"></img>

## Resources
- **Docs:** [https://docs.streamlit.io/](https://docs.streamlit.io/)
- **Tutorials:** [https://docs.streamlit.io/knowledge-base/tutorials](https://docs.streamlit.io/knowledge-base/tutorials)
- **Examples:** [https://docs.streamlit.io/streamlit-community-cloud/share-your-app](https://docs.streamlit.io/streamlit-community-cloud/share-your-app)
- **Community Forum:** [https://discuss.streamlit.io/](https://discuss.streamlit.io/)
- **Blog:** [https://blog.streamlit.io](https://blog.streamlit.io).
- Extend Streamlit's capabilities by installing or creating your own [Streamlit Components](http://components.streamlit.app/).
- Help others find and play with your app by using the Streamlit GitHub badge in your repository:
```markdown
[![Streamlit App](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](URL_TO_YOUR_APP)
```
[![Streamlit App](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://share.streamlit.io/streamlit/roadmap)

## Ready to dive in?

Start building your first Streamlit app today!  We're excited to see what you create.

**Make your data sing with Streamlit!**


## License

Streamlit is completely free and open-source and licensed under the [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) license.
