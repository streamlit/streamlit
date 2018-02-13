import pandas as pd
import numpy as np
from PIL import Image
import urllib, io
import sys
import time
import random

sys.path.append('local/server')
from streamlet import Notebook, Chart

with Notebook() as write:
    write.header('Bethurum Awesome Program', level=1)
    write("I'm starting my code here!")
    write('Progress:')
    my_progress_bar = write.progress(0)
    write('Loss:')
    loss_table = pd.DataFrame(columns=['loss'])
    loss_table = write.dataframe(loss_table)
    for i in range(100):
        my_progress_bar.progress(i)
        loss = random.randint(0, 100)
        loss_table.add_rows([loss])
        # write(f"The loss is {loss}.")
        time.sleep(0.1)
    write.alert("Finished my code.", type='success')
    
# with Notebook() as write:
#     # Title.
#     write('hello world')
#
#     my_bar = write.progress(0)
#     for i in range(100):
#         my_bar.progress(i)
#         time.sleep(0.1)
#
#     # write('This notebook shows some of the awesome elements of printf.')
#     #
#     # # Arrays
#
#     #
