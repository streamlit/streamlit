# -*- coding: future_fstrings -*-

#!./streamlit_run

"""Running this creates a "development environment" in the background
which runs the node development server and ensures that all files in shared/
are automatically compiled."""

import hashlib
import os
import re
# import threading
import time
import subprocess

# print()
# import sys
# sys.exit(-1)

# from streamlit import io

dev_server = subprocess.Popen(['npm', 'start'],
    cwd=os.path.join(os.getcwd(), 'local/client'))

print('Sleeping for 3 seconds.')
time.sleep(5)
with open('temp.txt', 'w') as output:
    output.write('parent: %s\n' % dev_server.pid)


print('About to kill the dev server.')
import signal
dev_server.send_signal(signal.SIGHUP)
# os.killpg(dev_server.pid, signal.SIGTERM)
print('Killed the dev server.')

# src_paths = ['shared/client/src', 'shared/protobuf']
# path_filter = re.compile(r'.*\.(proto|css|js)')
#
# hasher = hashlib.new('md5')
# for src_path in src_paths:
#     for dir_path, _, filenames in os.walk(src_path):
#         for filename in filenames:
#             filename = os.path.join(dir_path, filename)
#             if path_filter.match(filename):
#                 io.text(hasher.hexdigest())
#                 with open(filename) as input:
#                     hasher.update(input.read().encode('utf-8'))
#                 io.text('%s : %s' % (hasher.hexdigest(), filename))
# io.write('All done:', hasher.hexdigest())
#
# io.help(os.walk)
