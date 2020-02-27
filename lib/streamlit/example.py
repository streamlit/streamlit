class Cache(object):
  def __init__(self):
    # Mapping of hash -> Entry (Object with .refcount .data)
    self._file_cache = {}

    # XXX New
    # Mapping of session ID -> set of hash
    self._session_id_to_files = collections.defaultdict(set)

  def add(self, obj):
    obj_hash =  ...

    if obj_hash in self._file_cache:
      entry = self._file_cache[obj_hash]
      entry.refcount += 1
    else:
      self._file_cache[obj_hash] = Entry(data)

    # XXX New
    session_id = get_report_ctx().session_id
    self._session_id_to_files[session_id].add(obj_hash)

  # XXX New
  def reset_files_for_session(self):
    session_id = get_report_ctx().session_id

    for obj_hash in self._session_id_to_files[session_id]:
      entry = self._file_cache[obj_hash]
      entry.refcount -= 1

      if entry.refount == 0:
        self._remove(self, obj_hash)

    del self._session_id_to_files[session_id]

