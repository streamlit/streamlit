import re

import streamlit as st


def test_external_ip_works():
    """Test that internet is up and works.

    A trivial test but everyone should have an external IP address.
    """
    ip_regex = re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')

    ip = st.util.get_external_ip()
    match = ip_regex.match(ip)
    assert match is not None
