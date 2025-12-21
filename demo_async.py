
import streamlit as st
import asyncio
import time

st.set_page_config(page_title="Async Prototype")

st.title("AsyncIO Prototype Demo")
st.write("This script is running with a custom AsyncScriptRunner that supports top-level await!")

async def async_job(name, duration):
    st.write(f"Starting job {name} ({duration}s)...")
    await asyncio.sleep(duration)
    st.success(f"Job {name} complete!")

st.header("Sequential Await")
# This 'await' is technically top-level in the user script,
# but wrapped inside an async function by our runner.
await async_job("A", 1)
await async_job("B", 1)

st.header("Parallel Await (gather)")
# We can use asyncio.gather
await asyncio.gather(
    async_job("C", 2),
    async_job("D", 2)
)

st.write("All done.")
