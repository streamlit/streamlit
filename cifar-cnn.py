import keras
from keras.datasets import cifar10
from keras.preprocessing.image import ImageDataGenerator
from keras.models import Sequential
from keras.layers import Dense, Dropout, Activation, Flatten
from keras.layers import Conv2D, MaxPooling2D
import numpy as np
import pandas as pd
import os
import math

from tiny_notebook import Notebook, Chart

class MyCallback(keras.callbacks.Callback):
    def __init__(self, x_test, print):
        self._x_test = x_test
        self._print = print

    def on_train_begin(self, logs=None):
        self._print.header('Summary', level=2)
        self._summary_chart = self._create_chart('area', 300)
        self._summary_stats = self._print.text(f'{"epoch":>8s} :  0')
        self._print.header('Training Log', level=2)

    def on_epoch_begin(self, epoch, logs=None):
        self._epoch = epoch
        self._print.header(f'Epoch {epoch}', level=3)
        self._epoch_chart = self._create_chart('line')
        self._epoch_progress = self._print.alert('No progress yet.')
        self._epoch_summary = self._print.alert('No stats yet.')

    def on_batch_end(self, batch, logs=None):
        rows = pd.DataFrame([[logs['loss'], logs['acc']]],
            columns=['loss', 'acc'])
        if batch % 10 == 0:
            self._epoch_chart.add_rows(rows)
        if batch % 100 == 99:
            self._summary_chart.add_rows(rows)
        percent_complete = logs['batch'] * logs['size'] /\
            self.params['samples']
        self._epoch_progress.progress(math.ceil(percent_complete * 100))
        self._epoch_summary(
            f"loss: {logs['loss']:>7.5f} | acc: {logs['acc']:>7.5f}")

    def on_epoch_end(self, epoch, logs=None):
        self._print.header('Summary', level=5)
        categories = np.array(['airplane', 'automobile', 'bird', 'cat', 'deer', 'dog',
            'frog', 'horse', 'ship', 'truck'])
        indices = np.random.choice(len(self._x_test), 36)
        test_data = self._x_test[indices]
        prediction = np.argmax(self.model.predict(test_data), axis=1)
        self._print.img(test_data, caption=categories[prediction], width=117)
        summary = '\n'.join(f'{k:>8s} : {v:>8.5f}' for (k, v) in logs.items())
        self._print(summary)
        self._summary_stats(f'{"epoch":>8s} :  {epoch}\n{summary}')

    def _create_chart(self, type='line', height=0):
        empty_data = pd.DataFrame(columns=['loss', 'acc'])
        epoch_chart = Chart(empty_data, f'{type}_chart', height=height)
        epoch_chart.y_axis(type='number',
            y_axis_id="loss_axis", allow_data_overflow="true")
        epoch_chart.y_axis(type='number', orientation='right',
            y_axis_id="acc_axis", allow_data_overflow="true")
        epoch_chart.cartesian_grid(stroke_dasharray='3 3')
        epoch_chart.legend()
        getattr(epoch_chart, type)(type='monotone', data_key='loss',
            stroke='rgb(44,125,246)', fill='rgb(44,125,246)',
            dot="false", y_axis_id='loss_axis')
        getattr(epoch_chart, type)(type='monotone', data_key='acc',
            stroke='#82ca9d', fill='#82ca9d',
            dot="false", y_axis_id='acc_axis')
        return self._print.chart(epoch_chart)

with Notebook() as print:
    print('CIFAR CNN', fmt='header', level=1)
    num_classes = 10
    num_predictions = 20
    save_dir = os.path.join(os.getcwd(), 'saved_models')
    model_name = 'keras_cifar10_trained_model.h5'

    # The data, shuffled and split between train and test sets:
    (x_train, y_train), (x_test, y_test) = cifar10.load_data()

    # Convert class vectors to binary class matrices.
    y_train = keras.utils.to_categorical(y_train, num_classes)
    y_test = keras.utils.to_categorical(y_test, num_classes)

    model = Sequential()
    model.add(Conv2D(32, (3, 3), padding='same',
                     input_shape=x_train.shape[1:]))

    model.add(Activation('relu'))
    model.add(Conv2D(64, (3, 3)))
    model.add(Activation('relu'))
    model.add(MaxPooling2D(pool_size=(2, 2)))
    model.add(Dropout(0.25))

    model.add(Flatten())
    model.add(Dense(512))
    model.add(Activation('relu'))
    model.add(Dropout(0.5))
    model.add(Dense(num_classes))
    model.add(Activation('softmax'))

    # Let's train the model using RMSprop
    model.compile(loss='categorical_crossentropy',
                  optimizer='adam',
                  metrics=['accuracy'])

    x_train = x_train.astype('float32')
    x_test = x_test.astype('float32')
    x_train /= 255
    x_test /= 255

    model.fit(x_train, y_train,
      batch_size=30,
      epochs=100,
      validation_data=(x_test, y_test),
      callbacks=[MyCallback(x_test, print)],
      shuffle=True)


    # if not config.data_augmentation:
    #     print('Not using data augmentation.')
    #     model.fit(x_train, y_train,
    #               batch_size=batch_size,
    #               epochs=epochs,
    #               validation_data=(x_test, y_test),
    #               callbacks=[WandbKerasCallback],
    #               shuffle=True)
    # else:
    #     print('Using real-time data augmentation.')
    #     # This will do preprocessing and realtime data augmentation:
    #     datagen = ImageDataGenerator(
    #         featurewise_center=False,  # set input mean to 0 over the dataset
    #         samplewise_center=False,  # set each sample mean to 0
    #         featurewise_std_normalization=False,  # divide inputs by std of the dataset
    #         samplewise_std_normalization=False,  # divide each input by its std
    #         zca_whitening=False,  # apply ZCA whitening
    #         rotation_range=0,  # randomly rotate images in the range (degrees, 0 to 180)
    #         width_shift_range=0.1,  # randomly shift images horizontally (fraction of total width)
    #         height_shift_range=0.1,  # randomly shift images vertically (fraction of total height)
    #         horizontal_flip=True,  # randomly flip images
    #         vertical_flip=False)  # randomly flip images
    #
    #     # Compute quantities required for feature-wise normalization
    #     # (std, mean, and principal components if ZCA whitening is applied).
    #     datagen.fit(x_train)
    #
    #     # Fit the model on the batches generated by datagen.flow().
    #     model.fit_generator(datagen.flow(x_train, y_train,
    #                                      batch_size=config.batch_size),
    #                         steps_per_epoch=(x_train.shape[0] // config.batch_size) // 20,
    #                         epochs=config.epochs,
    #                         validation_data=(x_test[:200], y_test[:200]),
    #                         workers=4,
    #                         callbacks=[WandbKerasCallback()]
    #     )
    #
    # # Save model and weights
    # if not os.path.isdir(save_dir):
    #     os.makedirs(save_dir)
    #
    # model_path = os.path.join(save_dir, model_name)
    # model.save(model_path)
    # print('Saved trained model at %s ' % model_path)
    #
    # # Score trained model.
    # scores = model.evaluate(x_test, y_test, verbose=1)
    # print('Test loss:', scores[0])
    # print('Test accuracy:', scores[1])
