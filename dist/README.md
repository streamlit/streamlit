# Streamlit

This library lets you do realtime data-science. Here is an example of it's use for static data science:

## Installation

Install with:
```bash
pip install streamlit
```
Currently, streamlit requires Python 3.6.

## Static Example

Copy and paste this example and it should work:

```python
import pandas as pd
import numpy as np
from PIL import Image
import urllib, io
import sys

from streamlit import Notebook, Chart, LineChart, AreaChart, BarChart

with Notebook() as write:
    # Title.
    write('Period Table of the Elements', fmt='header', level=1)
    write('This notebook shows some of the awesome elements of streamlit.')

    # Arrays
    write('Numpy Arrays', fmt='header', level=3)
    write(np.random.randn(100, 100))

    # Charts.
    write('Charts', fmt='header', level=3)
    chart_data = pd.DataFrame(
        np.random.randn(20, 5),
        columns=['pv', 'uv', 'a', 'b', 'c']
    )

    write('Line Chart', fmt='header', level=4)
    write(LineChart(chart_data))

    write('Area Chart', fmt='header', level=4)
    write(AreaChart(chart_data))

    write('Bar Chart', fmt='header', level=4)
    write(BarChart(chart_data[['pv', 'uv']].iloc[:10]))

    # Customized charts.
    write('Customized charts', fmt='header', level=3)

    write('Customized Line Chart', fmt='header', level=4)
    write(Chart(chart_data, 'line_chart')
        .line(type='monotone', data_key='pv', stroke='#8884d8')
        .line(type='monotone', data_key='uv', stroke='#82ca9d'))

    write('Composed Chart', fmt='header', level=4)
    write(Chart(chart_data, 'composed_chart')
        .x_axis()
        .y_axis()
        .cartesian_grid(stroke_dasharray='3 3')
        .tooltip()
        .legend()
        .bar(data_key='pv', fill='#82ca9d')
        .area(type='monotone', data_key='uv', fill='#8884d8'))

    # DataFrames
    write('Pandas DataFrames', fmt='header', level=3)
    arrays = [
        np.array(['bar', 'bar', 'baz', 'baz', 'foo', 'foo', 'qux', 'qux']),
        np.array(['one', 'two', 'one', 'two', 'one', 'two', 'one', 'two'])]
    df = pd.DataFrame(np.random.randn(8, 4), index=arrays,
        columns=['A', 'B', 'C', 'D'])
    write('Here is a dataframe.', df, 'And here is its transpose.', df.T)

    # Alerts
    write('Alerts', fmt='header', level=3)
    write.alert('This is a "success" alert.', type='success')
    write.alert('This is an "info" alert.', type='info')
    write.alert('This is a "warning" alert.', type='warning')
    write.alert('This is a "danger" alert.', type='danger')

    # Headers
    write('Headers', fmt='header', level=3)
    write.header('Level 1', level=1)
    write.header('Level 2', level=2)
    write.header('Level 3', level=3)
    write.header('Level 4', level=4)
    write.header('Level 5', level=5)
    write.header('Level 6', level=6)

    # Images - We test all 6 possible file formats.
    write('Images', fmt='header', level=3)
    img_url = 'https://www.psdbox.com/wp-content/uploads/2014/08/HDR-landscape-tutorial-A.jpg'
    img_bytes = urllib.request.urlopen(img_url).read()
    img = np.array(Image.open(io.BytesIO(img_bytes)))
    grayscale = np.average(img, axis=2).astype(np.uint8)
    grayscale2 = grayscale.reshape(grayscale.shape + (1,))
    channels = img.transpose((2, 0, 1))
    channels2 = channels.reshape(channels.shape + (1,))
    channels_caption = ['Red', 'Green', 'Blue']
    write(img, fmt='img', caption="375px", width=375)         #    (w, h, 3)
    write([img], fmt='img', caption="225px", width=225)       # (n, w, h, 3)
    write(grayscale, fmt='img', caption="175px", width=175)   #    (w, h)
    write(grayscale2, fmt='img', caption="125px", width=125)  #    (w, h, 1)
    write.img(channels, caption=channels_caption, width=125)  # (n, w, h)
    write.img(channels2, caption=channels_caption, width=75)  # (n, w, h, 1)

    # Text
    write('Text', fmt='header', level=3)

    write.header('Character Wrapping', level=5)
    write(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do ' +
        'eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ' +
        'ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut ' +
        'aliquip ex ea commodo consequat. Duis aute irure dolor in ' +
        'reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla ' +
        'pariatur. Excepteur sint occaecat cupidatat non proident, sunt in ' +
        'culpa qui officia deserunt mollit anim id est laborum.');

    write.header('Space preservation', level=5)
    write(
        '...    0 leading spaces\n' +
        ' ...   1 leading space\n' +
        '  ...  2 leading spaces\n' +
        '   ... 3 leading spaces');

    write('Markdown', fmt='header', level=3)
    write.markdown("""
        Markdown allows for adding markup to plain text with intuitive
        and minimal syntax. For example:

        - to *emphasize* a word simply surround it with `*`
        - headings are prefixed with `#`, where the count indicates the level
        - lists like these have each item prefixed with `-`
    """)

    write('JSON', fmt='header', level=3)
    write('You can pass a JSON string.')
    write.json('{"object":{"array":[1,true,"3"]}}')
    write('Or an object directly:')
    write.json({'hello': 'world'})

    # Progress
    write('Progress Bars', fmt='header', level=3)
    for percent in [100, 75, 50, 25, 0]:
        write(f'{percent}% progress:')
        write.progress(percent)
```

## Dynamic Example

Copy and paste this example and it should work:

```python
from keras.datasets import mnist
from keras.layers import Conv2D, MaxPooling2D, Dropout, Dense, Flatten
from keras.models import Sequential
from keras.optimizers import SGD
from keras.utils import np_utils
import keras
import math
import numpy as np
import pandas as pd
import sys

from streamlit import Notebook, Chart

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
        indices = np.random.choice(len(self._x_test), 36)
        test_data = self._x_test[indices]
        prediction = np.argmax(self.model.predict(test_data), axis=1)
        self._print.img(1.0 - test_data, caption=prediction)
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

    # one hot encode outputs
    y_train = np_utils.to_categorical(y_train)
    y_test = np_utils.to_categorical(y_test)
    num_classes = y_test.shape[1]

    sgd = SGD(lr=0.01, decay=1e-6, momentum=0.9, nesterov=True)

    # build model

    model = Sequential()
    layer_1_size = 10
    epochs = 5

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
        epochs=epochs, callbacks=[MyCallback(x_test, print)])

    print.alert('Finished training!', type='success')

    # model.save("convnet.h5")
```
