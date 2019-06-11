"""An example of a Keras Chart."""

import streamlit as st

from tensorflow.python.keras.layers import Conv2D, MaxPooling2D, Dense, Flatten
from tensorflow.python.keras.models import Sequential

st.title('MNIST CNN - Keras')

# build model
model = Sequential()
model.add(Conv2D(10, (5, 5), input_shape=(28, 28, 1), activation='relu'))
model.add(MaxPooling2D(pool_size=(2, 2)))
model.add(Flatten())
model.add(Dense(8, activation='relu'))
model.add(Dense(2, activation='softmax'))

st.write('You should see a graph of vertically connected nodes.')
st.write(model)
