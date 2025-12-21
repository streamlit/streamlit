import time
import psutil
import os
import threading
from contextlib import contextmanager

class MemoryProfiler:
    def __init__(self, interval=0.1):
        self.interval = interval
        self.running = False
        self.thread = None
        self.peak_memory = 0
        self.memory_history = []

    def _monitor(self):
        process = psutil.Process(os.getpid())
        while self.running:
            mem_info = process.memory_info()
            rss = mem_info.rss / 1024 / 1024  # MB
            self.memory_history.append(rss)
            self.peak_memory = max(self.peak_memory, rss)
            time.sleep(self.interval)

    @contextmanager
    def watch(self):
        self.running = True
        self.thread = threading.Thread(target=self._monitor, daemon=True)
        self.thread.start()
        try:
            yield self
        finally:
            self.running = False
            self.thread.join()

if __name__ == "__main__":
    # Smoke test the profiler
    print("Starting Memory Profiler Smoke Test...")
    with MemoryProfiler().watch() as prof:
        # Simulate load
        large_list = [i for i in range(1000000)]
        time.sleep(1)

    print(f"Peak Memory: {prof.peak_memory:.2f} MB")
