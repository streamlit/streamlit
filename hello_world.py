import streamlit as st

st.image(
    "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/240/apple/285/input-latin-letters_1f524.png",
    width=100,
)

"""
# Test app for text dials

This app tests the prototype for the [text dials spec](https://www.notion.so/streamlit/Draft-Product-Spec-Approved-38612f5f36a74d738c5ec2ddda17f87c).
"""

"## Real-world example"

col1, col2, col3 = st.columns(3)
col3.metric("Creators", 13, 3)
col1.metric("Developers", "50k", "-5%")
col2.metric("Apps", "100k", "10%")


"## Just the metric"

st.metric("Value is None", None)
st.metric("Value is integer", 123)
st.metric("Value is float", 4.56)
st.metric("Value is string", "23k")

"### Unsupported type for value"
try:
    st.metric("Value is unsupported type", [1, 2, 3])
except Exception as e:
    st.write(type(e))
    st.error(e)
st.warning(
    "Message should read: '[1, 2, 3]' is not an accepted type. value only accepts: int, float, str, or None"
)


"## Delta indicator"

st.metric("Delta is None", 123, None)
st.metric("Delta is positive number", 123, 1.23)
st.metric("Delta is negative number", 123, -1.23)
st.metric("Delta is 0", 123, 0)
st.metric("Delta is string", 123, "23 % today")
st.metric("Delta is string with minus sign in front", 123, "-23 % today")
st.metric("Delta is string with minus sign and space in front", 123, "  -23 % today  ")


"## Delta colors"
st.metric("Colors off, positive delta", 123, 123, delta_color="off")
st.metric("Colors off, negative delta", 123, -123, delta_color="off")
st.metric("Colors inverse, positive delta", 123, 123, delta_color="inverse")
st.metric("Colors inverse, negative delta", 123, -123, delta_color="inverse")
st.metric(
    "Colors inverse, string delta w/o minus", 123, "1.23 %", delta_color="inverse"
)
st.metric(
    "Colors inverse, string delta w/ minus", 123, "-1.23 %", delta_color="inverse"
)

"### Unsupported value for delta_color"
try:
    st.metric("Unsupported value for delta_color", 123, 123, delta_color="sdfls")
except st.StreamlitAPIException as e:
    st.write(type(e))
    st.error(e)
st.warning(
    "Message should read: 'sdfls' is not an accepted value. delta_color only accepts: 'normal', 'inverse', or 'off'"
)


"## In columns"

"### Using `col1.metric` syntax:"
col1, col2, col3 = st.columns(3)
col1.metric("Column 1", 123, 123)
col2.metric("Column 2", 123, 123)
col3.metric("Column 3", 123, 123)

"### Using `with col1: st.metric` syntax:"
col1, col2, col3 = st.columns(3)
with col1:
    st.metric("Column 1", 123, 123)
with col2:
    st.metric("Column 2", 123, 123)
with col3:
    st.metric("Column 3", 123, 123)


"## Long label/value/delta"

"### Using int/float for value + delta:"
st.metric(
    "This is a very long text just for demonstration, there's nothing else to see here so where are you looking this should really go away now why is this text so long",
    123456789012345678901234567890,
    1.2345678901234567890123456789001348023804892349802308940923,
)

"### Using string for value + delta:"
st.metric(
    "This is a very long text just for demonstration, there's nothing else to see here so where are you looking this should really go away now why is this text so long",
    "lkasdfjks lfklsjldkfkjslf klsdjlkfklsdfjklsdfklj",
    "lkasdfjks lfklsjldkfkjslf klsdjlkfklsdfjklsdfklj",
)

"### With columns:"

col1, col2, col3 = st.columns(3)
col1.metric(
    "This is a very long text just for demonstration, there's nothing else to see here so where are you looking this should really go away now why is this text so long",
    123456789012345678901234567890,
    1.23456789012345678901234567890013480238048923498023089401234567890123456789001348023804892349802308940923,
)
col2.metric(
    "This is a very long text just for demonstration, there's nothing else to see here so where are you looking this should really go away now why is this text so long",
    123456789012345678901234567890,
    1.23456789012345678901234567890013480238048923498023089409212345678901234567890013480238048923498023089403,
)
col3.metric(
    "This is a very long text just for demonstration, there's nothing else to see here so where are you looking this should really go away now why is this text so long",
    123456789012345678901234567890,
    1.23456789012345678901234567890013480238048923498023123456789012345678900134802380489234980230894008940923,
)
