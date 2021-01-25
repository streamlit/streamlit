# Copyright 2018-2021 Streamlit Inc.
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

"""St.image example."""

import io
import random

import numpy as np
from PIL import Image, ImageDraw

import streamlit as st


class StreamlitImages(object):
    def __init__(self, size=200, step=10):
        self._size = size
        self._step = step
        self._half = self._size / 2
        self._data = {}

        self.create_image()
        self.generate_image_types()
        self.generate_image_channel_data()
        self.generate_bgra_image()
        self.generate_gif()
        self.generate_pseudorandom_image()
        self.generate_gray_image()
        self.save()

    def create_image(self):
        # Create a new image
        self._image = Image.new("RGB", (self._size, self._size))
        d = ImageDraw.Draw(self._image)

        # Draw a red square
        d.rectangle(
            [
                (self._step, self._step),
                (self._half - self._step, self._half - self._step),
            ],
            fill="red",
            outline=None,
            width=0,
        )

        # Draw a green circle.  In PIL, green is 00800, lime is 00ff00
        d.ellipse(
            [
                (self._half + self._step, self._step),
                (self._size - self._step, self._half - self._step),
            ],
            fill="lime",
            outline=None,
            width=0,
        )

        # Draw a blue triangle
        d.polygon(
            [
                (self._half / 2, self._half + self._step),
                (self._half - self._step, self._size - self._step),
                (self._step, self._size - self._step),
            ],
            fill="blue",
            outline=None,
        )

        # Creating a pie slice shaped 'mask' ie an alpha channel.
        alpha = Image.new("L", self._image.size, "white")
        d = ImageDraw.Draw(alpha)
        d.pieslice(
            [
                (self._step * 3, self._step * 3),
                (self._size - self._step, self._size - self._step),
            ],
            0,
            90,
            fill="black",
            outline=None,
            width=0,
        )
        self._image.putalpha(alpha)

    def generate_image_types(self):
        for fmt in ("jpeg", "png"):
            i = self._image.copy()
            d = ImageDraw.Draw(i)
            d.text((self._step, self._step), fmt, fill=(0xFF, 0xFF, 0xFF, 0xFF))
            # jpegs dont have alpha channels.
            if fmt == "jpeg":
                i = i.convert("RGB")
            data = io.BytesIO()
            i.save(data, format=fmt.upper())
            self._data["image.%s" % fmt] = data.getvalue()

    def generate_image_channel_data(self):
        # np.array(image) returns the following shape
        #   (width, height, channels)
        # and
        #   transpose((2, 0, 1)) is really
        #   transpose((channels, width, height))
        # So then we get channels, width, height which makes extracting
        # single channels easier.
        array = np.array(self._image).transpose((2, 0, 1))

        for idx, name in zip(range(0, 4), ["red", "green", "blue", "alpha"]):
            data = io.BytesIO()
            img = Image.fromarray(array[idx].astype(np.uint8))
            img.save(data, format="PNG")
            self._data["%s.png" % name] = data.getvalue()

    def generate_bgra_image(self):
        # Split Images and rearrange
        array = np.array(self._image).transpose((2, 0, 1))

        # Recombine image to BGRA
        bgra = (
            np.stack((array[2], array[1], array[0], array[3]))
            .astype(np.uint8)
            .transpose(1, 2, 0)
        )

        data = io.BytesIO()
        Image.fromarray(bgra).save(data, format="PNG")
        self._data["bgra.png"] = data.getvalue()

    def generate_gif(self):
        # Create grayscale image.
        im = Image.new("L", (self._size, self._size), "white")

        images = []

        # Make ten frames with the circle of a random size and location
        random.seed(0)
        for i in range(0, 10):
            frame = im.copy()
            draw = ImageDraw.Draw(frame)
            pos = (random.randrange(0, self._size), random.randrange(0, self._size))
            circle_size = random.randrange(10, self._size / 2)
            draw.ellipse([pos, tuple(p + circle_size for p in pos)], "black")
            images.append(frame.copy())

        # Save the frames as an animated GIF
        data = io.BytesIO()
        images[0].save(
            data,
            format="GIF",
            save_all=True,
            append_images=images[1:],
            duration=100,
            loop=0,
        )

        self._data["circle.gif"] = data.getvalue()

    def generate_pseudorandom_image(self):
        w, h = self._size, self._size
        r = np.array([255 * np.sin(x / w * 2 * np.pi) for x in range(0, w)])
        g = np.array([255 * np.cos(x / w * 2 * np.pi) for x in range(0, w)])
        b = np.array([255 * np.tan(x / w * 2 * np.pi) for x in range(0, w)])

        r = np.tile(r, h).reshape(w, h).astype("uint8")
        g = np.tile(g, h).reshape(w, h).astype("uint8")
        b = np.tile(b, h).reshape(w, h).astype("uint8")

        rgb = np.stack((r, g, b)).transpose(1, 2, 0)

        data = io.BytesIO()
        Image.fromarray(rgb).save(data, format="PNG")
        self._data["pseudorandom.png"] = data.getvalue()

    def generate_gray_image(self):
        gray = (
            np.tile(np.arange(self._size) / self._size * 255, self._size)
            .reshape(self._size, self._size)
            .astype("uint8")
        )

        data = io.BytesIO()
        Image.fromarray(gray).save(data, format="PNG")
        self._data["gray.png"] = data.getvalue()

    def save(self):
        for name, data in self._data.items():
            Image.open(io.BytesIO(data)).save("/tmp/%s" % name)

    def get_images(self):
        return self._data


# Generate some images.
si = StreamlitImages()

# Get a single image of bytes and display
st.header("individual image bytes")
filename = "image.png"
data = si.get_images().get(filename)
st.image(data, caption=filename, output_format="PNG")

# Display a list of images
st.header("list images")
images = []
captions = []
for filename, data in si.get_images().items():
    images.append(data)
    captions.append(filename)
st.image(images, caption=captions, output_format="PNG")

st.header("PIL Image")
data = []

# Get a single image to use for all the numpy stuff
image = Image.open(io.BytesIO(si.get_images()["image.png"]))
data.append((image, "PIL Image.open('image.png')"))
image = Image.open(io.BytesIO(si.get_images()["image.jpeg"]))
data.append((image, "PIL Image.open('image.jpeg')"))
data.append(
    (Image.new("RGB", (200, 200), color="red"), "Image.new('RGB', color='red')")
)

images = []
captions = []
for i, c in data:
    images.append(i)
    captions.append(c)
st.image(images, caption=captions, output_format="PNG")

st.header("Bytes IO Image")
image = io.BytesIO(si.get_images()["image.png"])
st.image(image, caption=str(type(image)), output_format="PNG")

st.header("From a file")
st.image("/tmp/image.png", caption="/tmp/image.png", output_format="PNG")

st.header("From open")
st.image(open("/tmp/image.png", "rb").read(), caption="from read", output_format="PNG")

st.header("Numpy arrays")
image = Image.open(io.BytesIO(si.get_images()["image.png"]))
rgba = np.array(image)

data = []
# Full RGBA image
data.append((rgba, str(rgba.shape)))
# Select second channel
data.append((rgba[:, :, 1], str(rgba[:, :, 1].shape)))
# Make it x, y, 1
data.append(
    (np.expand_dims(rgba[:, :, 2], 2), str(np.expand_dims(rgba[:, :, 2], 2).shape))
)
# Drop alpha channel
data.append((rgba[:, :, :3], str(rgba[:, :, :3].shape)))

images = []
captions = []
for i, c in data:
    images.append(i)
    captions.append(c)
st.image(images, caption=captions, output_format="PNG")

try:
    st.header("opencv")
    import cv2

    image = np.fromstring(si.get_images()["image.png"], np.uint8)

    img = cv2.imdecode(image, cv2.IMREAD_UNCHANGED)
    st.image(img, output_format="PNG")
except Exception:
    pass

st.header("url")
url = "https://farm1.staticflickr.com/9/12668460_3e59ce4e61.jpg"
st.image(url, caption=url, width=200)

st.header("Clipping")
data = []
np.random.seed(0)
g = np.zeros((200, 200))
b = np.zeros((200, 200))

a = (np.random.ranf(size=200)) * 255
r = np.array(np.gradient(a)) / 255.0 + 0.5

a = np.tile(r, 200).reshape((200, 200))
a = a - 0.3
rgb = np.stack((a, g, b)).transpose(1, 2, 0)
data.append((rgb, "clamp: rgb image - 0.3"))

a = np.tile(r, 200).reshape((200, 200))
rgb = np.stack((a, g, b)).transpose(1, 2, 0)
data.append((rgb, "rgb image"))

a = np.tile(r, 200).reshape((200, 200))
a = a + 0.5
rgb = np.stack((a, g, b)).transpose(1, 2, 0)
data.append((rgb, "clamp: rgb image + 0.5"))

images = []
captions = []
for i, c in data:
    images.append(i)
    captions.append(c)
st.image(images, caption=captions, clamp=True, output_format="PNG")
