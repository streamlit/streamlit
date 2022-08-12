"""Keras unit test."""

from unittest.mock import patch
import unittest

try:
    from tensorflow.python.keras.utils import vis_utils
    from tensorflow.python.keras.models import Sequential
    from tensorflow.python.keras.layers import Conv2D, MaxPooling2D, Dense, Flatten

    HAS_KERAS = True
except ImportError:
    HAS_KERAS = False

import streamlit as st


@unittest.skipIf(not HAS_KERAS, "Keras not installed")
class KerasTest(unittest.TestCase):
    """Test ability to marshall keras models."""

    def test_model(self):
        """Test that it can be called with a model."""
        model = Sequential()
        model.add(Conv2D(10, (5, 5), input_shape=(28, 28, 1), activation="relu"))
        model.add(MaxPooling2D(pool_size=(2, 2)))
        model.add(Flatten())
        model.add(Dense(8, activation="relu"))

        with patch(
            "streamlit.delta_generator.DeltaGenerator.graphviz_chart"
        ) as graphviz_chart:
            st.write(model)

            dot = vis_utils.model_to_dot(model)
            graphviz_chart.assert_called_once_with(dot.to_string())
