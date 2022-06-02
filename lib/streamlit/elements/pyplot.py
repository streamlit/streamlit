# Copyright 2018-2022 Streamlit Inc.
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

"""Streamlit support for Matplotlib PyPlot charts."""

import io
from pprint import PrettyPrinter
from typing import cast
import hashlib
import string
import random

import streamlit
import streamlit.elements.image as image_utils
from streamlit import config
from streamlit.errors import StreamlitDeprecationWarning
from streamlit.logger import get_logger
from streamlit.proto.Image_pb2 import ImageList as ImageListProto
from streamlit.proto.Pyplot_pb2 import Pyplot as PyplotProto
from streamlit.elements.iframe import marshall
from streamlit.proto.IFrame_pb2 import IFrame as IFrameProto

LOGGER = get_logger(__name__)


class PyplotMixin:
    def pyplot(self, fig=None, clear_figure=None, interactive=True, points=None, **kwargs):
        """Display a matplotlib.pyplot figure.

        Parameters
        ----------
        fig : Matplotlib Figure
            The figure to plot. When this argument isn't specified, this
            function will render the global figure (but this is deprecated,
            as described below)

        clear_figure : bool
            If True, the figure will be cleared after being rendered.
            If False, the figure will not be cleared after being rendered.
            If left unspecified, we pick a default based on the value of `fig`.

            * If `fig` is set, defaults to `False`.

            * If `fig` is not set, defaults to `True`. This simulates Jupyter's
              approach to matplotlib rendering.

        **kwargs : any
            Arguments to pass to Matplotlib's savefig function.

        Example
        -------
        >>> import matplotlib.pyplot as plt
        >>> import numpy as np
        >>>
        >>> arr = np.random.normal(1, 1, size=100)
        >>> fig, ax = plt.subplots()
        >>> ax.hist(arr, bins=20)
        >>>
        >>> st.pyplot(fig)

        .. output::
           https://share.streamlit.io/streamlit/docs/main/python/api-examples-source/charts.pyplot.py
           height: 630px

        Notes
        -----
        .. note::
           Deprecation warning. After December 1st, 2020, we will remove the ability
           to specify no arguments in `st.pyplot()`, as that requires the use of
           Matplotlib's global figure object, which is not thread-safe. So
           please always pass a figure object as shown in the example section
           above.

        Matplotlib support several different types of "backends". If you're
        getting an error using Matplotlib with Streamlit, try setting your
        backend to "TkAgg"::

            echo "backend: TkAgg" >> ~/.matplotlib/matplotlibrc

        For more information, see https://matplotlib.org/faq/usage_faq.html.

        """

        if not fig and config.get_option("deprecation.showPyplotGlobalUse"):
            self.dg.exception(PyplotGlobalUseWarning())
        if not interactive:
            image_list_proto = ImageListProto()
            marshall_image(
                self.dg._get_delta_path_str(), image_list_proto, fig, clear_figure, interactive, **kwargs
            )
            try:
                import matplotlib
                import matplotlib.pyplot as plt

                plt.ioff()
            except ImportError:
                raise ImportError("pyplot() command requires matplotlib")
            return self.dg._enqueue("imgs", image_list_proto)
        # print(f"TYPE OF FIG: {type(fig)}")
        # print(fig._localaxes)
        # labels = ["Point {0}".format(i) for i in range(40)]
        # css = """
        #     table
        #     {
        #     border-collapse: collapse;
        #     }
        #     th
        #     {
        #     color: #ffffff;
        #     background-color: #000000;
        #     }
        #     td
        #     {
        #     background-color: #cccccc;
        #     }
        #     table, th, td
        #     {
        #     font-family:Arial, Helvetica, sans-serif;
        #     border: 1px solid black;
        #     text-align: right;
        #     }
        #     """
        # plugins.clear(fig)
        # print(type(fig))
        # print(f"TYPE OF FIG.AXES {type(fig.axes[0].get_lines())}")
        # print(f"LINES: {fig.axes[0].get_lines()}")
        # xy_data = fig.axes[0].get_lines()[0].get_xydata()
        # labels=[]
        # for i in range(len(xy_data)):
        #     label = xy_data[i]
        #     label_string = f'<table border="1" class="dataframe"> <thead> <tr style="text-align: right;"> <th></th> <th>Row {i}</th> </tr> </thead> <tbody> <tr> <th>x</th> <td>{label[0]}</td> </tr> <tr> <th>y</th> <td>{label[1]}</td> </tr> </tbody> </table>'
        #     labels.append(label_string)
            # print(labels)
            # .to_html() is unicode; so make leading 'u' go away with str()
            # labels.append(str(label.to_html()))
        

        # tooltip = plugins.PointHTMLTooltip(points=fig.axes[0].get_lines()[0], labels=labels, css=css)
        # plugins.connect(fig, tooltip)
        # plugins.connect(fig, plugins.BoxZoom(button=True, enabled=True))
        # plugins.connect(fig, plugins.Reset())
        # plugins.connect(fig, plugins.Zoom(button=True, enabled=True))

        else: 
            try:
                import json
                import matplotlib
                import matplotlib.pyplot as plt, mpld3
                # from mpld3 import plugins

                plt.ioff()
            except ImportError:
                raise ImportError("pyplot() command requires matplotlib")
            h = hashlib.new("md5")
            if fig.dpi < 200:
                fig.dpi = 200
            fig_json = mpld3.fig_to_dict(fig)
            pyplot_proto = PyplotProto()

            json_dump = json.dumps(fig_json)
            encoded = json_dump.encode()
            h.update(encoded)
            pyplot_proto.json = json_dump
            width, _ = fig.get_size_inches() * fig.dpi
            pyplot_proto.width = width
            # ensure that we have the first character as a letter 
            # since css ids need to have a letter first
            pyplot_proto.id = random.choice(string.ascii_letters) + h.hexdigest()[1:]
            
            return self.dg._enqueue("pyplot", pyplot_proto)
            # html_string = mpld3.fig_to_html(fig)
            # # print(fig.axes[0])
            # # print(html_string)
            # iframe_proto = IFrameProto()
            # width, height = fig.get_size_inches() * fig.dpi
            # marshall(iframe_proto, srcdoc=html_string, height=height +10, width=width)
            # return self.dg._enqueue("iframe", iframe_proto)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)


def marshall_image(coordinates, image_list_proto, fig=None, clear_figure=True, interactive=None, **kwargs):
    try:
        import matplotlib
        import matplotlib.pyplot as plt

        plt.ioff()
    except ImportError:
        raise ImportError("pyplot() command requires matplotlib")
    
    # You can call .savefig() on a Figure object or directly on the pyplot
    # module, in which case you're doing it to the latest Figure.
    if not fig:
        if clear_figure is None:
            clear_figure = True

        fig = plt

    # Normally, dpi is set to 'figure', and the figure's dpi is set to 100.
    # So here we pick double of that to make things look good in a high
    # DPI display.
    options = {"bbox_inches": "tight", "dpi": 200, "format": "png"}

    # If some of the options are passed in from kwargs then replace
    # the values in options with the ones from kwargs
    options = {a: kwargs.get(a, b) for a, b in options.items()}
    # Merge options back into kwargs.
    kwargs.update(options)

    image = io.BytesIO()
    fig.savefig(image, **kwargs)
    image_utils.marshall_images(
        coordinates,
        image,
        None,
        -2,
        image_list_proto,
        False,
        channels="RGB",
        output_format="PNG",
    )

    # Clear the figure after rendering it. This means that subsequent
    # plt calls will be starting fresh.
    if clear_figure:
        fig.clf()


class PyplotGlobalUseWarning(StreamlitDeprecationWarning):
    def __init__(self):
        super(PyplotGlobalUseWarning, self).__init__(
            msg=self._get_message(), config_option="deprecation.showPyplotGlobalUse"
        )

    def _get_message(self):
        return """
You are calling `st.pyplot()` without any arguments. After December 1st, 2020,
we will remove the ability to do this as it requires the use of Matplotlib's global
figure object, which is not thread-safe.

To future-proof this code, you should pass in a figure as shown below:

```python
>>> fig, ax = plt.subplots()
>>> ax.scatter([1, 2, 3], [1, 2, 3])
>>>    ... other plotting actions ...
>>> st.pyplot(fig)
```
"""
