# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
The main purpose of this module (right now at least) is to avoid a dependency
cycle between streamlit.delta_generator and some elements.
"""

from __future__ import annotations

from contextvars import ContextVar, Token
from typing import TYPE_CHECKING, Callable, Generic, TypeVar

from streamlit.proto.RootContainer_pb2 import RootContainer as _RootContainer

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.dialog import Dialog
    from streamlit.elements.lib.mutable_status_container import StatusContainer


class DeltaGeneratorSingleton:
    """Used to initialize the DeltaGenerator classes and store them as singletons.
    This module allows us to avoid circular imports between DeltaGenerator and elements,
    because elements can import this singleton module instead of DeltaGenerator directly.
    """

    _instance: DeltaGeneratorSingleton | None = None

    @classmethod
    def instance(cls) -> DeltaGeneratorSingleton:
        """Return the singleton DeltaGeneratorSingleton instance. Raise an Error if the
        DeltaGeneratorSingleton hasn't been created yet.
        """
        if cls._instance is None:
            raise RuntimeError("DeltaGeneratorSingleton hasn't been created!")
        return cls._instance

    def __init__(
        self,
        delta_generator_cls: type[DeltaGenerator],
        status_container_cls: type[StatusContainer],
        dialog_container_cls: type[Dialog],
    ) -> None:
        """Registers and initializes all delta-generator classes.

        Parameters
        ----------
        delta_generator_cls : type[DeltaGenerator]
            The main DeltaGenerator class.
        status_container_cls : type[StatusContainer]
            The delta-generator class that is used as return value for `st.status`.
        dialog_container_cls : type[Dialog]
            The delta-generator class used is used as return value for `st.dialog`.

        Raises
        ------
        RuntimeError
            If the DeltaGeneratorSingleton instance already exists.
        """
        if DeltaGeneratorSingleton._instance is not None:
            raise RuntimeError("DeltaGeneratorSingleton instance already exists!")
        DeltaGeneratorSingleton._instance = self

        self._main_dg = delta_generator_cls(root_container=_RootContainer.MAIN)
        self._sidebar_dg = delta_generator_cls(
            root_container=_RootContainer.SIDEBAR, parent=self._main_dg
        )
        self._event_dg = delta_generator_cls(
            root_container=_RootContainer.EVENT, parent=self._main_dg
        )
        self._bottom_dg = delta_generator_cls(
            root_container=_RootContainer.BOTTOM, parent=self._main_dg
        )
        self._status_container_cls = status_container_cls
        self._dialog_container_cls = dialog_container_cls

    @property
    def main_dg(self) -> DeltaGenerator:
        return self._main_dg

    @property
    def sidebar_dg(self) -> DeltaGenerator:
        return self._sidebar_dg

    @property
    def event_dg(self) -> DeltaGenerator:
        return self._event_dg

    @property
    def bottom_dg(self) -> DeltaGenerator:
        return self._bottom_dg

    @property
    def status_container_cls(
        self,
    ) -> type[StatusContainer]:
        """Stub for StatusContainer. Since StatusContainer inherits from DeltaGenerator,
        this is used to avoid circular imports.
        """
        return self._status_container_cls

    @property
    def dialog_container_cls(self) -> type[Dialog]:
        """Stub for Dialog. Since Dialog inherits from DeltaGenerator,
        this is used to avoid circular imports.
        """
        return self._dialog_container_cls


def get_dg_singleton_instance() -> DeltaGeneratorSingleton:
    """Return the DeltaGeneratorSingleton instance. Raise an Error if the
    DeltaGeneratorSingleton hasn't been created yet.
    """
    return DeltaGeneratorSingleton.instance()


_T = TypeVar("_T")


class ContextVarWithLazyDefault(Generic[_T]):
    """The dg_stack tracks the currently active DeltaGenerator, and is pushed to when
    a DeltaGenerator is entered via a `with` block. This is implemented as a ContextVar
    so that different threads or async tasks can have their own stacks.

    We have a wrapper around it because ContextVar default cannot be a function, but
    the default dg (main_dg) might not exist yet when this module is imported.
    """

    def __init__(self, name: str, *, default: Callable[[], _T]) -> None:
        self._name = name
        self._default = default
        self._context_var: ContextVar[_T] | None = None

    def _init_context_var(self) -> None:
        self._context_var = ContextVar(self._name, default=self._default())  # noqa: B039

    def get(self) -> _T:
        if self._context_var is None:
            self._init_context_var()
        return self._context_var.get()  # type: ignore[union-attr]

    def set(self, value: _T) -> Token[_T]:
        if self._context_var is None:
            self._init_context_var()
        return self._context_var.set(value)  # type: ignore[union-attr]

    def reset(self, token: Token[_T]) -> None:
        if self._context_var is None:
            self._init_context_var()
        self._context_var.reset(token)  # type: ignore[union-attr]

    def __hash__(self) -> int:
        if self._context_var is None:
            self._init_context_var()
        return self._context_var.__hash__()


# we don't use the default factory here because `main_dg` is not initialized when this
# module is imported. This is why we have our own ContextVar wrapper.
context_dg_stack: ContextVarWithLazyDefault[tuple[DeltaGenerator, ...]] = (
    ContextVarWithLazyDefault(
        "context_dg_stack", default=lambda: (get_dg_singleton_instance().main_dg,)
    )
)


def get_default_dg_stack_value() -> tuple[DeltaGenerator, ...]:
    """Get the default dg_stack value with which the dg_stack should
    be initialized and reset if needed.
    """
    instance = get_dg_singleton_instance()
    if instance._main_dg is None:
        raise RuntimeError("main_dg is not set")

    return (instance._main_dg,)


def get_last_dg_added_to_context_stack() -> DeltaGenerator | None:
    """Get the last added DeltaGenerator of the stack in the current context.

    Returns None if the stack has only one element or is empty for whatever reason.
    """
    current_stack = context_dg_stack.get()
    # If set to "> 0" and thus return the only delta generator in the stack -
    # which logically makes more sense -, some unit tests fail.
    # It looks like the reason is that they create their own main delta generator
    # but do not populate the dg_stack correctly. However, to be on the safe-side,
    # we keep the logic but leave the comment as shared knowledge for whoever will look
    # into this in the future.
    if len(current_stack) > 1:
        return current_stack[-1]
    return None
