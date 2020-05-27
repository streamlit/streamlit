# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""An example of monitoring a simple neural net as it trains."""

import streamlit as st
from streamlit import config

from tensorflow.keras.datasets import mnist
from tensorflow.keras.layers import Conv2D, MaxPooling2D, Dropout, Dense, Flatten
from tensorflow.keras.models import Sequential
from tensorflow.keras.optimizers import SGD
from keras.utils import np_utils
from tensorflow import keras
import math
import numpy as np
import pandas as pd
import time

import tensorflow as tf

# dynamically grow the memory used on the GPU
# this option is fine on non gpus as well.
tf_config = tf.compat.v1.ConfigProto()
tf_config.gpu_options.allow_growth = True
tf_config.log_device_placement = True

# https://kobkrit.com/using-allow-growth-memory-option-in-tensorflow-and-keras-dc8c8081bc96
tf.compat.v1.keras.backend.set_session(tf.compat.v1.Session(config=tf_config))


class MyCallback(keras.callbacks.Callback):
    def __init__(self, x_test):
        self._x_test = x_test

    def on_train_begin(self, logs=None):
        st.header("Summary")
        self._summary_chart = st.area_chart()
        self._summary_stats = st.text("%8s :  0" % "epoch")
        st.header("Training Log")

    def on_epoch_begin(self, epoch, logs=None):
        self._ts = time.time()
        self._epoch = epoch
        st.subheader("Epoch %s" % epoch)
        self._epoch_chart = st.line_chart()
        self._epoch_progress = st.info("No stats yet.")
        self._epoch_summary = st.empty()

    def on_batch_end(self, batch, logs=None):
        if batch % 10 == 0:
            rows = {"loss": [logs["loss"]], "accuracy": [logs["accuracy"]]}
            self._epoch_chart.add_rows(rows)
        if batch % 100 == 99:
            rows = {"loss": [logs["loss"]], "accuracy": [logs["accuracy"]]}
            self._summary_chart.add_rows(rows)
        percent_complete = batch / self.params["steps"]
        self._epoch_progress.progress(math.ceil(percent_complete * 100))
        ts = time.time() - self._ts
        self._epoch_summary.text(
            "loss: %(loss)7.5f | accuracy: %(accuracy)7.5f | ts: %(ts)d"
            % {"loss": logs["loss"], "accuracy": logs["accuracy"], "ts": ts}
        )

    def on_epoch_end(self, epoch, logs=None):
        # st.write('**Summary**')
        indices = np.random.choice(len(self._x_test), 36)
        test_data = self._x_test[indices]
        prediction = np.argmax(self.model.predict(test_data), axis=1)
        st.image(1.0 - test_data, caption=prediction)
        summary = "\n".join(
            "%(k)8s : %(v)8.5f" % {"k": k, "v": v} for (k, v) in logs.items()
        )
        st.text(summary)
        self._summary_stats.text(
            "%(epoch)8s :  %(epoch)s\n%(summary)s"
            % {"epoch": epoch, "summary": summary}
        )


st.title("MNIST CNN")

(x_train, y_train), (x_test, y_test) = mnist.load_data()

img_width = 28
img_height = 28

x_train = x_train.astype("float32")
x_train /= 255.0
x_test = x_test.astype("float32")
x_test /= 255.0

# reshape input data
x_train = x_train.reshape(x_train.shape[0], img_width, img_height, 1)
x_test = x_test.reshape(x_test.shape[0], img_width, img_height, 1)

# one hot encode outputs
y_train = np_utils.to_categorical(y_train)
y_test = np_utils.to_categorical(y_test)
num_classes = y_test.shape[1]

sgd = SGD(lr=0.01, decay=1e-6, momentum=0.9, nesterov=True)

# build model

model = Sequential()
layer_1_size = 10
epochs = 3

model.add(Conv2D(10, (5, 5), input_shape=(img_width, img_height, 1), activation="relu"))
model.add(MaxPooling2D(pool_size=(2, 2)))
# model.add(Conv2D(config.layer_2_size, (5, 5), input_shape=(img_width, img_height,1), activation='relu'))
# model.add(MaxPooling2D(pool_size=(2, 2)))
# model.add(Dropout(0.2))
model.add(Flatten())
model.add(Dense(8, activation="relu"))
model.add(Dense(num_classes, activation="softmax"))

model.compile(loss="categorical_crossentropy", optimizer=sgd, metrics=["accuracy"])

show_terminal_output = not config.get_option("server.liveSave")
model.fit(
    x_train,
    y_train,
    validation_data=(x_test, y_test),
    epochs=epochs,
    verbose=show_terminal_output,
    callbacks=[MyCallback(x_test)],
)

st.success("Finished training!")

# model.save("convnet.h5")
