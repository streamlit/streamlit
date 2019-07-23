from random import random
import os
import platform
import streamlit as st
import time

st.title('Test of run-on-save')
secs_to_wait = 5

st.write('''
How to test this:

1. If run-on-save is on, make sure the page changes every few seconds. Then
   turn run-on-save off in the settigns menu and check (2).
2. If run-on-save is off, make sure "Rerun"/"Always rerun" buttons appear in
   the status area. Click "Always rerun" and check (1).
''')

st.write('This should change every ', secs_to_wait, ' seconds: ', random())

# Sleep for 5s (rather than, say, 1s) because on the first run we need to make
# sure Streamlit is fully initialized before the timer below expires. This can
# take several seconds.
status = st.empty()
for i in range(secs_to_wait, 0, -1):
    time.sleep(1)
    status.text('Sleeping %ss...' % i)

status.text('Touching %s' % __file__)

platform_system = platform.system()

if platform_system == 'Linux':
    cmd = (
        'sed -i '
        "'s/^# MODIFIED AT:.*/# MODIFIED AT: %(time)s/' %(file)s"
        ' && touch %(file)s' %  # sed on Linux modifies a different file.
        {'time': time.time(), 'file': __file__})

elif platform_system == 'Darwin':
    cmd = (
        'sed -i bak '
        "'s/^# MODIFIED AT:.*/# MODIFIED AT: %s/' %s" %
        (time.time(), __file__))

elif platform_system == 'Windows':
    raise Error('Windows not supported')

else:
    raise Error('Unknown platform')

os.system(cmd)

status.text('Touched %s' % __file__)

# MODIFIED AT: 1553887865.5356503
