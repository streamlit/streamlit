import pytest
from tests import testutil
from streamlit.runtime.scriptrunner import StopException
import streamlit as st


class StopTest(testutil.DeltaGeneratorTestCase):
    def test_stop(self):
        with pytest.raises(StopException) as exc_message:
            st.stop()
