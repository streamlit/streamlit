#!./streamlit_run

from streamlit import io
import pandas as pd
import string, random
import sys

io.write('Hello world')

# import os, datetime
# def time_command(cmd):
#     print(cmd)
#     # return 1.2
#     start_time = datetime.datetime.now()
#     os.system(cmd)
#     end_time = datetime.datetime.now()
#     delta = end_time - start_time
#     return delta.total_seconds()
#
# #
# #
# # data = []
# # for i in range(100):
# #     index = ''.join(random.choice(string.ascii_lowercase) for i in range(50))
# #     value = random.gauss(0, 1)
# #     data.append((index, value))
# # data = pd.DataFrame(data).set_index(0)
# # io.write(data)
#
# print('starting..')
# # time_command(f'./streamlit_run report.py 10')
# data = []
# for indices in range(10, 5100, 100):
#     data.append((indices, time_command(f'./streamlit_run report.py {indices}')))
# import time
# time.sleep(5)
# data = pd.DataFrame(data, columns=['indices', 'seconds']).set_index('indices')
# io.title('How long does it take to send data?')
# io.write(time_command('sleep 1'))
# io.write(data)
# io.line_chart(data)
#
# data = [ ]
