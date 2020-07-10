# Develop Streamlit Components

The first step in developing a Streamlit Component is deciding whether to create a static component (i.e. rendered once, controlled by Python) or to create a bi-directional component that can communicate from Python to JavaScript and back.

## Create a static component

If your goal in creating a Streamlit Component is solely to display HTML code or render a chart from a Python visualization library, Streamlit provides two methods that greatly simplify the process: `components.html()` and `components.iframe()`.

If you are unsure whether you need bi-directional communication, **start here first**!

### Render an HTML string

While [`st.text`](api.html#streamlit.text), [`st.markdown`](api.html#streamlit.text) and [`st.write`](api.html#streamlit.text) make it easy to write text to a Streamlit app, sometimes you'd rather implement a custom piece of HTML. Similarly, while Streamlit natively supports [many charting libraries](api.html#display-charts), you may want to implement a specific HTML/JavaScript template for a new charting library. components.html works by giving you the ability to embed an iframe inside of a Streamlit app that contains your desired output.

```eval_rst
.. autofunction:: streamlit.components.v1.html
```

**Example**

```python
import streamlit as st
import streamlit.components.v1 as components

# embed a twitter feed in streamlit
components.html("""
                <a class="twitter-timeline"
                href="https://twitter.com/streamlit?ref_src=twsrc%5Etfw">Tweets by streamlit</a>
                <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
                """
                )
```

### Render an iframe URL

`components.iframe` is similar in features to `components.html`, with the difference being that `components.iframe` takes a URL as its input. This is used for situations where you want to include an entire page within a Streamlit app.

```eval_rst
.. autofunction:: streamlit.components.v1.iframe
```

**Example**

```python
import streamlit as st
import streamlit.components.v1 as components

# embed streamlit docs in a streamlit app
components.iframe("https://docs.streamlit.io/en/latest")
```

## Create a bi-directional component

A bi-directional Streamlit Component has two parts:

1. A **frontend**, which is built out of HTML and any other web tech you like (JavaScript, React, Vue, etc.), and gets rendered in Streamlit apps via an iframe tag.
2. A **Python API**, which Streamlit apps use to instantiate and talk to that frontend

To make the process of creating bi-directional Streamlit Components easier, we've created a React template and a TypeScript-only template in the [Streamlit Component-template GitHub repo](https://github.com/streamlit/component-template). We also provide some [example Components](https://github.com/streamlit/component-template/tree/master/examples) in the same repo.

### Development Environment Setup

To build a Streamlit Component, you need the following installed in your development environment:

- Python 3.6+
- Streamlit 0.63+
- [nodejs](https://nodejs.org/en/)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

Clone the [component-template GitHub repo](https://github.com/streamlit/component-template), then decide whether you want to use the React.js (["template"](https://github.com/streamlit/component-template/tree/master/template-reactless)) or plain TypeScript (["template-reactless"](https://github.com/streamlit/component-template/tree/master/template-reactless)) template.

1. Initialize and build the component template frontend from the terminal:

   ```shell
   # React template
   $ template/my_component/frontend
   $ npm install    # Initialize the project and install npm dependencies
   $ npm run start  # Start the Webpack dev server

   # or

   # TypeScript-only template
   $ template-reactless/my_component/frontend
   $ npm install    # Initialize the project and install npm dependencies
   $ npm run start  # Start the Webpack dev server
   ```

2. _From a separate terminal_, run the Streamlit app (Python) that declares and uses the component:

   ```shell
   # React template
   $ cd template
   $ . venv/bin/activate # or similar to activate the venv/conda environment where Streamlit is installed
   $ streamlit run my_component/__init__.py # run the example

   # or

   # TypeScript-only template
   $ cd template-reactless
   $ . venv/bin/activate # or similar to activate the venv/conda environment where Streamlit is installed
   $ streamlit run my_component/__init__.py # run the example
   ```

After running the steps above, you should see a Streamlit app in your browser that looks like this:

![Streamlit Component Example App](_static/img/component_demo_example.png)

The example app from the template shows how bi-directional communication is implemented. The Streamlit Component displays a button (`Python → JavaScript`), and the end-user can click the button. Each time the button is clicked, the JavaScript front-end increments the counter value and passes it back to Python (`JavaScript → Python`), which is then displayed by Streamlit (`Python → JavaScript`).

### React-based frontend

### Typescript-only frontend

### Python API

### Data serialization

#### Python → Frontend

You send data from Python to the frontend by passing keyword args to your component's invoke function (that is, the function returned from `declare_component`). You can send the following types of data from Python to the frontend:

- Any JSON-serializable data
- `numpy.array`
- `pandas.DataFrame`

Any JSON-serializable data gets serialized to a JSON string, and deserialized to its JavaScript equivalent. `numpy.array` and `pandas.DataFrame` get serialized using [Apache Arrow](https://arrow.apache.org/) and are deserialized as instances of `ArrowTable`, which is a custom type that wraps Arrow structures and provides a convenient API on top of them.

Check out the [CustomDataframe](https://github.com/streamlit/component-template/tree/master/examples/CustomDataframe) and [SelectableDataTable](https://github.com/streamlit/component-template/tree/master/examples/SelectableDataTable) Component example code for more context on how to use `ArrowTable`.

#### Frontend → Python

You send data from the frontend to Python via the `Streamlit.setComponentValue()` API (which is part of the template code). Unlike arg-passing from Python → frontend, **this API takes a single value**. If you want to return multiple values, you'll need to wrap them in an `Array` or `Object`.

Custom Components can currently _only_ send JSON-serializable data from the frontend to Python. We'll be adding support for returning `ArrowTable` from the frontend in the near future!
