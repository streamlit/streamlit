from random import random
import os
import streamlit as st
import time

st.title('Test of run-on-save')
secs_to_wait = 10

st.write('This should change every ', secs_to_wait, ' seconds: ', random())

# Sleep for 10s (rather than, say, 1s) because on the first run we need to
# make sure Streamlit and its proxy are fully initialized before the timer
# below expires. This can take several seconds.
status = st.empty()
for i in range(secs_to_wait, 0, -1):
    time.sleep(1)
    status.text('Sleeping %ss...' % i)

status.text('Touching %s' % __file__)

cmd = (
    'sed -i '
    "'s/^# MODIFIED AT:.*/# MODIFIED AT: %s/' %s" % (time.time(), __file__))

os.system(cmd)

status.text('Touched %s' % __file__)

# MODIFIED AT: 1539388206.99
