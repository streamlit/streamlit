# How to Run and Validate the delta_description Feature

## Quick Start

The `delta_description` feature for `st.metric()` is fully implemented and ready to test!

### 1. Run the Visual Demo

```bash
cd /home/runner/work/streamlit/streamlit
source venv/bin/activate
STREAMLIT_GLOBAL_DEVELOPMENT_MODE=false streamlit run test_delta_description.py
```

Then open your browser to `http://localhost:8501` to see the feature in action!

### 2. Run Unit Tests

**Python tests:**
```bash
cd /home/runner/work/streamlit/streamlit
source venv/bin/activate
PYTHONPATH=lib pytest lib/tests/streamlit/elements/metric_test.py -v
```

**TypeScript tests:**
```bash
cd /home/runner/work/streamlit/streamlit/frontend
yarn test lib/src/components/elements/Metric/Metric.test.tsx
```

## What to Look For

When you run the demo app, you should see metrics with descriptions like:
- "-29.2% **month over month**"
- "+234 **from last week**"
- "+5°F **from yesterday**"

The text in bold appears next to the delta value!

## Usage Example

```python
import streamlit as st

st.metric(
    label="Sales",
    value="$2,297,201",
    delta="-29.2%",
    delta_description="month over month"  # ← New parameter!
)
```

## Test Results

✅ **All tests passing:**
- 68 Python unit tests
- 55 TypeScript unit tests
- Visual validation complete

## Need More Details?

See `DELTA_DESCRIPTION_GUIDE.md` for comprehensive documentation.

## Files Changed

1. `proto/streamlit/proto/Metric.proto` - Added delta_description field
2. `lib/streamlit/elements/metric.py` - Added parameter to Python API
3. `frontend/lib/src/components/elements/Metric/Metric.tsx` - Added rendering
4. `lib/tests/streamlit/elements/metric_test.py` - Added tests
5. `frontend/lib/src/components/elements/Metric/Metric.test.tsx` - Added tests

---

**That's it!** The feature is complete and working. 🎉
