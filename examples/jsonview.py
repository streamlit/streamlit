"""Example of everything that's possible in streamlet."""

import sys
import numpy as np

from streamlet import Notebook, Chart, LineChart

with Notebook() as write:

    write.header('Json Example')

    write.markdown('Use `write.json(..)` to display JSON objects.')

    write.markdown('This can be either a JSON string, like `\'{"some":"json","string":true}\'`')

    write.json('{"some":"json","string":true}')

    write.markdown("Or a python object, like `{'other': 'json', 'object': True}`")

    write.json({'other': 'json', 'object': True})

    write.markdown("Every node has a button to collapse parts of the tree, and a button to copy parts onto the clipboard.")

    write.markdown("We can also print larger amounts of data:")

    write.json({
      "some": "json",
      "string": True,
      "with": ["a", "lot", "of", "text", "Pellentesque tincidunt varius mauris. Integer dapibus volutpat ligula, et fermentum augue bibendum eu. Nunc lacinia, velit at bibendum feugiat, orci arcu tincidunt velit, et dapibus augue mauris vitae ipsum. Duis consectetur eget velit quis aliquet. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Fusce tempor justo nec pharetra aliquam. Vivamus ullamcorper blandit ex ac suscipit. Proin mattis dolor a nibh feugiat faucibus. Nunc tincidunt, eros eu blandit interdum, lacus turpis aliquet lacus, in imperdiet dui mauris eget justo. Cras eleifend orci libero, vitae faucibus turpis interdum in. Duis volutpat dignissim lobortis. In porttitor libero et felis luctus, nec lacinia urna fermentum. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Nunc hendrerit elit quis lacus scelerisque malesuada. Donec dictum scelerisque turpis, eget egestas eros."],
      "and_data": np.random.rand(10, 10).tolist()
    })

    write.markdown("It also handles malformatted JSON:")

    write.json("""{
  "some": "json",
  "string": true,
  "with": ["a", "lot", "of", "text", "Pellentesque tincidunt varius mauris. Integer dapibus volutpat ligula, et fermentum augue bibendum eu. Nunc lacinia, velit at bibendum feugiat, orci arcu tincidunt velit, et dapibus augue mauris vitae ipsum. Duis consectetur eget velit quis aliquet. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Fusce tempor justo nec pharetra aliquam. Vivamus ullamcorper blandit ex ac suscipit. Proin mattis dolor a nibh feugiat faucibus. Nunc tincidunt, eros eu blandit interdum, lacus turpis aliquet lacus, in imperdiet dui mauris eget justo. Cras eleifend orci libero, vitae faucibus turpis interdum in. Duis volutpat dignissim lobortis. In porttitor libero et felis luctus, nec lacinia urna fermentum. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Nunc hendrerit elit quis lacus scelerisque malesuada. Donec dictum scelerisque turpis, eget egestas eros."],
  "and", bad syntax.
}""")
