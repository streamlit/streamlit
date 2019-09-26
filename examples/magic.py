# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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
