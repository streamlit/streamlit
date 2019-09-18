import asyncio
from contextlib import contextmanager

import streamlit as st

@contextmanager
def noop_context_mgr():
    yield


magic = None
def prep_magic(name):
    global magic
    magic = name
    st.code('Should print "%s":' % magic)


prep_magic("no block")
magic

prep_magic("IF block")
if True:
    magic

prep_magic("ELIF block")
if False:
    pass
elif True:
    magic

prep_magic("ELSE block")
if False:
    pass
else:
    magic


prep_magic("FOR block")
for ii in range(1):
    magic

prep_magic("WHILE block")
ii = 0
while ii < 1:
    magic
    ii += 1

prep_magic("WITH block")
with noop_context_mgr():
    magic

prep_magic("TRY block")
try:
    magic
except:
    raise

prep_magic("SYNC func")
def noop_func():
    magic

noop_func()

prep_magic("ASYNC func")
async def noop_async_func():
    magic

loop = asyncio.new_event_loop()
loop.run_until_complete(noop_async_func())

st.info('done')
