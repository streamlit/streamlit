
# Streamlit code organization

For most simple apps, keep everything in one file—it's cleaner and more straightforward. The app file should read like a normal Python script for data processing, with a few Streamlit commands sprinkled in.

Name the main file `streamlit_app.py` (Streamlit's default).

## When to split

**Keep in one file (most apps):**
- Apps under ~1000 lines
- One-off scripts and prototypes
- Apps where logic is straightforward

**Consider splitting when:**
- Data processing is complex (50+ lines of non-UI code)
- Multiple pages share logic
- You want to test business logic separately

If splitting makes sense, here's how to organize it.

## Directory structure

```
my-app/
├── streamlit_app.py      # Main entry point
├── app_pages/            # Page UI modules
│   ├── dashboard.py
│   └── settings.py
└── utils/                # Business logic & helpers
    ├── data.py
    └── api.py
```

## Separating UI from logic

When you do split, keep Streamlit files focused on UI and move complex logic to utility modules:

```python
# streamlit_app.py - UI-focused
import streamlit as st
from utils.data import load_sales_data, compute_metrics

st.title("Sales Dashboard")

start = st.date_input("Start")
end = st.date_input("End")

data = load_sales_data(start, end)
metrics = compute_metrics(data)

st.metric("Revenue", f"${metrics['revenue']:,.0f}")
st.dataframe(data)
```

## Avoid if __name__ == "__main__"

Streamlit apps run the entire file on each interaction. Don't use the main guard in Streamlit files.

```python
# BAD - don't do this in streamlit_app.py or pages
if __name__ == "__main__":
    main()

# GOOD - just put the code directly
import streamlit as st

st.title("My App")
```

The main guard is fine in utility modules for quick testing:

```python
# utils/data.py
def load_data(path):
    ...

# Optional: test this module directly with `python utils/data.py`
if __name__ == "__main__":
    print(load_data("test.csv"))
```

## References

- [Multipage apps](https://docs.streamlit.io/develop/concepts/multipage-apps)
- [st.cache_data](https://docs.streamlit.io/develop/api-reference/caching-and-state/st.cache_data)
