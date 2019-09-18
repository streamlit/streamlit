import asyncio
import contextlib

import streamlit as st

async_loop = asyncio.new_event_loop()


magic = None


def prep_magic(name):
    global magic
    magic = "_%s_" % name
    st.markdown("**%s** expected:" % name)


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


@contextlib.contextmanager
def context_mgr():
    try:
        yield
    finally:
        pass


with context_mgr():
    magic

prep_magic("TRY block")
try:
    magic
except:
    raise

prep_magic("EXCEPT block")
try:
    raise RuntimeError("shenanigans!")
except RuntimeError:
    magic

prep_magic("FINALLY block")
try:
    pass
finally:
    magic

prep_magic("FUNCTION block")


def func():
    magic


func()

prep_magic("ASYNC FUNCTION block")


async def async_func():
    magic


async_loop.run_until_complete(async_func())

prep_magic("ASYNC FOR block")


async def async_for():
    async def async_iter():
        yield

    async for _ in async_iter():
        magic


async_loop.run_until_complete(async_for())

prep_magic("ASYNC WITH block")


async def async_with():
    @contextlib.asynccontextmanager
    async def async_context_mgr():
        try:
            yield
        finally:
            pass

    async with async_context_mgr():
        magic


async_loop.run_until_complete(async_with())

st.info("done")
