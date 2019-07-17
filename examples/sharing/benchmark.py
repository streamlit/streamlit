# From https://databricks.com/tensorflow/using-a-gpu
import streamlit as st

import sys
import numpy as np
import tensorflow as tf
from datetime import datetime

device_name = sys.argv[1]  # Choose device from cmd line. Options: gpu or cpu
shape = (int(sys.argv[2]), int(sys.argv[2]))
if device_name == "gpu":
    device_name = "/gpu:0"
else:
    device_name = "/cpu:0"

with tf.device(device_name):
    random_matrix = tf.random_uniform(shape=shape, minval=0, maxval=1)
    dot_operation = tf.matmul(random_matrix, tf.transpose(random_matrix))
    sum_operation = tf.reduce_sum(dot_operation)


startTime = datetime.now()


# Shared GPU has memory sharing issues
# https://www.tensorflow.org/guide/using_gpu
config=tf.ConfigProto(log_device_placement=True)
config.gpu_options.allow_growth = True
with tf.Session(config=config) as session:
        result = session.run(sum_operation)
        st.write(result)

st.write("Shape:", shape, "Device:", device_name)
st.write("Time taken:", datetime.now() - startTime)
