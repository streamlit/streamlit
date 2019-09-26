"""File docstring. Should not be printed."""

import asyncio
import contextlib

async_loop = asyncio.new_event_loop()

# Standalone statements should be printed
"no block"

a = "printed"
"This should be", a

# Standalone statements within blocks should be printed

if True:
    "IF"

if False:
    pass
elif True:
    "ELIF"

if False:
    pass
else:
    "ELSE"


for ii in range(1):
    "FOR"

while True:
    "WHILE"
    break


@contextlib.contextmanager
def context_mgr():
    try:
        yield
    finally:
        pass


with context_mgr():
    "WITH"

try:
    "TRY"
except:
    raise

try:
    raise RuntimeError("shenanigans!")
except RuntimeError:
    "EXCEPT"

try:
    pass
finally:
    "FINALLY"


def func(value):
    value


func("FUNCTION")


async def async_func(value):
    value


async_loop.run_until_complete(async_func("ASYNC FUNCTION"))


async def async_for():
    async def async_iter():
        yield

    async for _ in async_iter():
        "ASYNC FOR"


async_loop.run_until_complete(async_for())


async def async_with():
    @contextlib.asynccontextmanager
    async def async_context_mgr():
        try:
            yield
        finally:
            pass

    async with async_context_mgr():
        "ASYNC WITH"


async_loop.run_until_complete(async_with())

# Docstrings should never be printed


def docstrings():
    """Docstring. Should not be printed."""

    def nested():
        """Multiline docstring.
        Should not be printed."""
        pass

    class Foo(object):
        """Class docstring. Should not be printed."""

        pass

    nested()


docstrings()
