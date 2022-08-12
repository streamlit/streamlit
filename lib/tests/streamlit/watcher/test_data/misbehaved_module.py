import types


class _MisbehavedModule(types.ModuleType):
    @property
    def __spec__(self):
        raise Exception("Oh noes!")


MisbehavedModule = _MisbehavedModule("MisbehavedModule")
