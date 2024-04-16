import numpy as np

from streamlit import source_util
from streamlit.hello import Hello

# Set random seed to always get the same results in the plotting demo
np.random.seed(0)

# This is a trick to setup the MPA hello app programmatically

source_util._cached_pages = None
source_util._cached_pages = source_util.get_pages(Hello.__file__)
source_util._on_pages_changed.send()

# TODO(lukasmasuch): Once we migrate the hello app to the new programmatic
# MPA API, we can remove this workaround.

Hello.run()
