![Streamlit logo|200x200](https://i.ibb.co/5FdSr1V/streamlit.png)

# Streamlit

**A faster way to build and share data apps.**

Streamlit lets you turn data scripts into shareable web apps in minutes, not weeks. It’s all Python, open-source, and free! And once you’ve created an app you can use our [Community Cloud platform](https://streamlit.io/cloud) to deploy, manage, and share your app!


## Installation

Open a terminal and run:
```bash
$ pip install streamlit 
$ streamlit hello
```

This should open our sweet _Streamlit Hello_ app right in your browser. It features a bunch of examples of what you can do with Streamlit!

<img src="https://media.cleanshot.cloud/media/55064/9RAuEZKubvrlrlPVua50xuhyPIiD8MBdvzi7Pa3s.gif?Expires=1674790062&Signature=fqIRLW0tMXntC1vCrSq3yLPTtA58SRLiO1i0y~7YshYuOfQQokc0OI6uxWg6IBL8rw2gGnzA4ML-OdGWPgK6WSulyLR-wNbQAPiKX4LF0vXS9F6AmZ8V39Tze5Fo9TWfA3JZF3mnu7q6JrkssCk~6614xuugx9gojkOJMtsbFrOiM2kNLkje2OepBbxromYKVLLEQGwuPcFvUiA3Hb6ZuSHtNX~99wLu94PAKpXfPUf21sCt4vfmYItkl0z6BuHWYP5Zs5SlvPo8iXvdrb-dKL-~-kbTRjpcTFgWhFT1zg8iNZNCeR0Q~QvpS8rzfQPMMeIiBiRJFmTm4RC7~FRktA__&Key-Pair-Id=K269JMAT9ZF4GZ" alt="Streamlit Hello" width=500 href="none"></img>

Read more on getting started with Streamlit in our [documentation](https://docs.streamlit.io/library/get-started).


## Quick start

#### A little example

Streamlit makes it incredibly easy to build interactive apps:

```python
import streamlit as st
x = st.slider("Select a value")
st.write(x, "squared is", x * x)
```

<img src="https://user-images.githubusercontent.com/7164864/214900507-1c89fc6b-e196-4f5c-890f-7e0be62d5d9d.png" width=300 alt="Little example"></img>

#### Give me more!

Streamlit comes in with [a ton of additional powerful elements](https://docs.streamlit.io/library/api-reference) to spice up your data apps and delight your viewers. Some examples:

<table border="0">
   <tr>
     <td><img src="https://docs.streamlit.io/images/api/date_input.jpg" style="max-height:150; width:auto; display:block;"></td>
     <td><img src="https://user-images.githubusercontent.com/7164864/215110064-5eb4e294-8f30-4933-9563-0275230e52b5.gif"  style="max-height:150; width:auto; display:block;"></td>
     <td><img src="https://docs.streamlit.io/images/api/line_chart.jpg" style="max-height:150; width:auto; display:block;"></td>
     <td><img src="https://docs.streamlit.io/images/api/tabs.jpg" style="max-height:150; width:auto; display:block;"></td>
     <td><img src="https://docs.streamlit.io/images/mpa-add-pages.png" style="max-height:150; width:auto; display:block;"></td>
     <td><img src="https://user-images.githubusercontent.com/7164864/215109229-6ae9111f-e5c1-4f0b-b3a2-87a79268ccc9.gif" style="max-height:150; width:auto; display:block;"></td>

  </tr>
    <tr>
      <td>Input widgets</td>
      <td>Dataframes</td>
      <td>Charts</td>
      <td>Layout</td>
      <td>Multi-page apps</td>
      <td>Fun</td>
   </tr>
<table>

Our vibrant creators community also extends Streamlit capabilities using [Streamlit Components](https://streamlit.io/components) 🧩

## Get inspired 
 
There's so much you can build with Streamlit!
- 🧬  [Science & technology apps](https://streamlit.io/gallery?category=science-technology)
- 💬  [NLP & language apps](https://streamlit.io/gallery?category=nlp-language)
- 👀  [Computer vision apps](https://streamlit.io/gallery?category=computer-vision-images)
- 🏦  [Finance & business apps](https://streamlit.io/gallery?category=finance-business)
- 🗺  [Geography & society apps](https://streamlit.io/gallery?category=geography-society)
- and more!

**Check out [our gallery](https://streamlit.io/gallery)** 🎈

## Community Cloud
  
Deploy, manage and share your apps for free using our [Community Cloud](https://streamlit.io/cloud)! Sign-up [here](https://share.streamlit.io/signup). <br><br>
<img src="https://user-images.githubusercontent.com/7164864/214965336-64500db3-0d79-4a20-8052-2dda883902d2.gif" width="400"></img>

## Resources

- Streamlit [docs](https://docs.streamlit.io), [community forum](https://discuss.streamlit.io) and [blog](https://blog.streamlit.io)
- Extend Streamlit's capabilities by installing or creating your own [Streamlit Components](https://streamlit.io/components).
- Help others find and play with your app by using the Streamlit GitHub badge in your repository:
```markdown
[![Streamlit App](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](URL_TO_YOUR_APP)
```
[![Streamlit App](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://share.streamlit.io/streamlit/roadmap)

## License

Streamlit is completely free and open-source and licensed under the [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) license.
