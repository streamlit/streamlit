import keras
from keras.datasets import mnist
from keras.models import Sequential
from keras.layers import Conv2D, MaxPooling2D, Dropout, Dense, Flatten
from keras.utils import np_utils
from keras.optimizers import SGD
import numpy as np
import pandas as pd

# import wandb
# from wandb.wandb_keras import WandbKerasCallback
#
# run = wandb.init()
# config = run.config

from tiny_notebook import Notebook, Chart

class PritnfCallback(keras.callbacks.Callback):
    def __init__(self, print):
        self._print = print

    def on_train_begin(self, logs=None):
        self._print.header('Training Log', level=3)

    def on_epoch_begin(self, epoch, logs=None):
        self._print.header(f'Epoch {epoch}')
        self._data = pd.DataFrame(columns=['batch', 'loss', 'acc'])
        # self._epoch_graph = print.alert('No info yet.')
        self._epoch_summary = print.alert('No info yet.')

            # write('Line Chart', fmt='header', level=4)
            # line_chart = Chart(chart_data, 'line_chart')
            # line_chart.x_axis()
            # line_chart.y_axis()
            # line_chart.cartesian_grid(stroke_dasharray='3 3')
            # line_chart.tooltip()
            # line_chart.legend()
            # line_chart.line(type='monotone', data_key='pv', stroke='#8884d8')
            # line_chart.line(type='monotone', data_key='uv', stroke='#82ca9d')
            # write(line_chart)

    # def on_batch_begin(self, batch, logs=None):
    #     self._print('on_batch_begin', batch, logs)

    def on_batch_end(self, batch, logs=None):
        # self._epoch_graph(self._data)
        self._epoch_summary('on_batch_end', batch, logs)
        # self._data.append([batch, logs['loss'], logs['acc']])

    def on_epoch_end(self, epoch, logs=None):
        self._print('on_epoch_end', epoch, logs)

    def on_train_end(self, logs=None):
        self._print('on_train_end', logs)

with Notebook() as print:
    print.header('MNIST CNN', level=1)

    (x_train, y_train), (x_test, y_test) = mnist.load_data()

    img_width=28
    img_height=28

    x_train = x_train.astype('float32')
    x_train /= 255.
    x_test = x_test.astype('float32')
    x_test /= 255.

    #reshape input data
    x_train = x_train.reshape(x_train.shape[0], img_width, img_height, 1)
    x_test = x_test.reshape(x_test.shape[0], img_width, img_height, 1)

    print.header('Input Data', level=3)
    print('x_train', x_train.shape)
    print('y_train', y_train.shape)
    print('x_test', x_train.shape)
    print('y_test', y_train.shape)
    indices = np.random.choice(len(x_train), 36)
    print.img(x_train[indices], caption=y_train[indices])

    # one hot encode outputs
    y_train = np_utils.to_categorical(y_train)
    y_test = np_utils.to_categorical(y_test)
    num_classes = y_test.shape[1]
    # print(y_train[indices])

    sgd = SGD(lr=0.01, decay=1e-6, momentum=0.9, nesterov=True)

    # build model

    model = Sequential()
    layer_1_size = 10
    epochs = 10

    model.add(Conv2D(10, (5, 5), input_shape=(img_width, img_height,1), activation='relu'))
    model.add(MaxPooling2D(pool_size=(2, 2)))
    #model.add(Conv2D(config.layer_2_size, (5, 5), input_shape=(img_width, img_height,1), activation='relu'))
    #model.add(MaxPooling2D(pool_size=(2, 2)))
    #model.add(Dropout(0.2))
    model.add(Flatten())
    model.add(Dense(8, activation='relu'))
    model.add(Dense(num_classes, activation='softmax'))

    model.compile(loss='categorical_crossentropy', optimizer=sgd,
        metrics=['accuracy'])
    model.fit(x_train, y_train, validation_data=(x_test, y_test),
        epochs=epochs, callbacks=[PritnfCallback(print)])

    model.save("convnet.h5")
