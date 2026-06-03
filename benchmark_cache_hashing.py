"""Benchmark: sampled vs. full-object hashing for Streamlit's cache layer.

Measures wall-clock time (median of 5 runs) for hashing pandas DataFrames/Series,
polars DataFrames/Series, and numpy arrays at various sizes, comparing the current
sampling approach against hashing the full object.

Run from the repo root with the Streamlit dev environment active:
    python benchmark_cache_hashing.py
"""

from __future__ import annotations

import hashlib
import statistics
import sys
import time
from typing import Any

import numpy as np
import pandas as pd
import polars as pl
from pandas.util import hash_pandas_object

_PANDAS_ROWS_LARGE = 50_000
_PANDAS_SAMPLE_SIZE = 10_000
_NP_SIZE_LARGE = 500_000
_NP_SAMPLE_SIZE = 100_000
_NUM_RUNS = 5


def _time_fn(fn: Any, num_runs: int = _NUM_RUNS) -> float:
    """Return the median wall-clock time (seconds) of calling fn() over num_runs."""
    times = []
    for _ in range(num_runs):
        start = time.perf_counter()
        fn()
        end = time.perf_counter()
        times.append(end - start)
    return statistics.median(times)


def _memory_mb(obj: Any) -> float:
    """Rough memory estimate in MB."""
    if isinstance(obj, np.ndarray):
        return obj.nbytes / (1024 * 1024)
    elif isinstance(obj, pd.DataFrame):
        return obj.memory_usage(deep=True).sum() / (1024 * 1024)
    elif isinstance(obj, pd.Series):
        return obj.memory_usage(deep=True) / (1024 * 1024)
    elif isinstance(obj, pl.DataFrame):
        return obj.estimated_size("mb")
    elif isinstance(obj, pl.Series):
        return obj.estimated_size("mb")
    return 0.0


# --- Pandas DataFrame hashing ---


def _hash_pandas_df_sampled(df: pd.DataFrame) -> bytes:
    """Replicate the current Streamlit sampling logic for pandas DataFrames."""
    h = hashlib.blake2b(digest_size=16, usedforsecurity=False)
    h.update(str(df.shape).encode())
    work_df = df
    if len(work_df) >= _PANDAS_ROWS_LARGE:
        work_df = work_df.sample(n=_PANDAS_SAMPLE_SIZE, random_state=0)
    h.update(hash_pandas_object(work_df.dtypes).to_numpy().tobytes())
    h.update(hash_pandas_object(work_df).to_numpy().tobytes())
    return h.digest()


def _hash_pandas_df_full(df: pd.DataFrame) -> bytes:
    """Hash the entire pandas DataFrame without sampling."""
    h = hashlib.blake2b(digest_size=16, usedforsecurity=False)
    h.update(str(df.shape).encode())
    h.update(hash_pandas_object(df.dtypes).to_numpy().tobytes())
    h.update(hash_pandas_object(df).to_numpy().tobytes())
    return h.digest()


# --- Pandas Series hashing ---


def _hash_pandas_series_sampled(s: pd.Series) -> bytes:
    """Replicate the current Streamlit sampling logic for pandas Series."""
    h = hashlib.blake2b(digest_size=16, usedforsecurity=False)
    h.update(str(s.size).encode())
    h.update(s.dtype.name.encode())
    work_s = s
    if len(work_s) >= _PANDAS_ROWS_LARGE:
        work_s = work_s.sample(n=_PANDAS_SAMPLE_SIZE, random_state=0)
    h.update(hash_pandas_object(work_s).to_numpy().tobytes())
    return h.digest()


def _hash_pandas_series_full(s: pd.Series) -> bytes:
    """Hash the entire pandas Series without sampling."""
    h = hashlib.blake2b(digest_size=16, usedforsecurity=False)
    h.update(str(s.size).encode())
    h.update(s.dtype.name.encode())
    h.update(hash_pandas_object(s).to_numpy().tobytes())
    return h.digest()


# --- NumPy array hashing ---


def _hash_numpy_sampled(arr: np.ndarray) -> bytes:
    """Replicate the current Streamlit sampling logic for numpy arrays."""
    h = hashlib.blake2b(digest_size=16, usedforsecurity=False)
    h.update(str(arr.shape).encode())
    h.update(str(arr.dtype).encode())
    work_arr = arr
    if arr.size >= _NP_SIZE_LARGE:
        state = np.random.RandomState(0)
        work_arr = state.choice(arr.flat, size=_NP_SAMPLE_SIZE)
    h.update(work_arr.tobytes())
    return h.digest()


def _hash_numpy_full(arr: np.ndarray) -> bytes:
    """Hash the entire numpy array without sampling."""
    h = hashlib.blake2b(digest_size=16, usedforsecurity=False)
    h.update(str(arr.shape).encode())
    h.update(str(arr.dtype).encode())
    h.update(arr.tobytes())
    return h.digest()


# --- Polars DataFrame hashing ---


def _hash_polars_df_sampled(df: pl.DataFrame) -> bytes:
    """Replicate the current Streamlit sampling logic for polars DataFrames."""
    h = hashlib.blake2b(digest_size=16, usedforsecurity=False)
    h.update(str(df.shape).encode())
    work_df = df
    if len(work_df) >= _PANDAS_ROWS_LARGE:
        work_df = work_df.sample(n=_PANDAS_SAMPLE_SIZE, seed=0)
    for c, t in work_df.schema.items():
        h.update(c.encode())
        h.update(str(t).encode())
    values_hash = work_df.hash_rows(seed=0).hash(seed=0).to_arrow().to_string().encode()
    h.update(values_hash)
    return h.digest()


def _hash_polars_df_full(df: pl.DataFrame) -> bytes:
    """Hash the entire polars DataFrame without sampling."""
    h = hashlib.blake2b(digest_size=16, usedforsecurity=False)
    h.update(str(df.shape).encode())
    for c, t in df.schema.items():
        h.update(c.encode())
        h.update(str(t).encode())
    values_hash = df.hash_rows(seed=0).hash(seed=0).to_arrow().to_string().encode()
    h.update(values_hash)
    return h.digest()


# --- Polars Series hashing ---


def _hash_polars_series_sampled(s: pl.Series) -> bytes:
    """Replicate the current Streamlit sampling logic for polars Series."""
    h = hashlib.blake2b(digest_size=16, usedforsecurity=False)
    h.update(str(s.dtype).encode())
    h.update(str(s.shape).encode())
    work_s = s
    if len(work_s) >= _PANDAS_ROWS_LARGE:
        work_s = work_s.sample(n=_PANDAS_SAMPLE_SIZE, seed=0)
    h.update(work_s.hash(seed=0).to_arrow().to_string().encode())
    return h.digest()


def _hash_polars_series_full(s: pl.Series) -> bytes:
    """Hash the entire polars Series without sampling."""
    h = hashlib.blake2b(digest_size=16, usedforsecurity=False)
    h.update(str(s.dtype).encode())
    h.update(str(s.shape).encode())
    h.update(s.hash(seed=0).to_arrow().to_string().encode())
    return h.digest()


# --- Benchmark runner ---


def _run_benchmark(
    label: str,
    sizes: list[int],
    create_fn: Any,
    hash_sampled_fn: Any,
    hash_full_fn: Any,
) -> list[dict[str, Any]]:
    """Run benchmarks for a data type across multiple sizes."""
    results = []
    for size in sizes:
        obj = create_fn(size)
        mem_mb = _memory_mb(obj)

        t_sampled = _time_fn(lambda o=obj: hash_sampled_fn(o))
        t_full = _time_fn(lambda o=obj: hash_full_fn(o))
        ratio = t_full / t_sampled if t_sampled > 0 else float("inf")

        result = {
            "type": label,
            "size": size,
            "memory_mb": mem_mb,
            "sampled_ms": t_sampled * 1000,
            "full_ms": t_full * 1000,
            "ratio": ratio,
        }
        results.append(result)
        print(
            f"  {label:25s} | size={size:>12,} | mem={mem_mb:>8.1f} MB | "
            f"sampled={t_sampled * 1000:>8.2f} ms | full={t_full * 1000:>8.2f} ms | "
            f"ratio={ratio:>6.2f}x"
        )
    return results


def _format_size(n: int) -> str:
    if n >= 1_000_000:
        return f"{n // 1_000_000}M"
    elif n >= 1_000:
        return f"{n // 1_000}k"
    return str(n)


def main() -> None:
    print("=" * 100)
    print("Streamlit Cache Hashing Benchmark: Sampled vs. Full-Object Hashing")
    print("=" * 100)
    print(f"Runs per measurement: {_NUM_RUNS} (reporting median)")
    print(f"Pandas sampling threshold: {_PANDAS_ROWS_LARGE:,} rows, sample size: {_PANDAS_SAMPLE_SIZE:,}")
    print(f"NumPy sampling threshold: {_NP_SIZE_LARGE:,} elements, sample size: {_NP_SAMPLE_SIZE:,}")
    print()

    all_results: list[dict[str, Any]] = []

    pandas_df_sizes = [50_000, 100_000, 500_000, 1_000_000, 5_000_000]
    pandas_series_sizes = [50_000, 100_000, 500_000, 1_000_000, 5_000_000]
    numpy_sizes = [500_000, 1_000_000, 5_000_000, 10_000_000, 50_000_000]
    polars_df_sizes = [50_000, 100_000, 500_000, 1_000_000, 5_000_000]
    polars_series_sizes = [50_000, 100_000, 500_000, 1_000_000, 5_000_000]

    # --- Pandas DataFrame ---
    print("--- Pandas DataFrame (4 float64 columns) ---")
    all_results.extend(
        _run_benchmark(
            "pandas DataFrame",
            pandas_df_sizes,
            lambda n: pd.DataFrame(np.random.randn(n, 4), columns=["a", "b", "c", "d"]),
            _hash_pandas_df_sampled,
            _hash_pandas_df_full,
        )
    )
    print()

    # --- Pandas Series ---
    print("--- Pandas Series (float64) ---")
    all_results.extend(
        _run_benchmark(
            "pandas Series",
            pandas_series_sizes,
            lambda n: pd.Series(np.random.randn(n)),
            _hash_pandas_series_sampled,
            _hash_pandas_series_full,
        )
    )
    print()

    # --- NumPy ndarray ---
    print("--- NumPy ndarray (float64) ---")
    all_results.extend(
        _run_benchmark(
            "numpy ndarray",
            numpy_sizes,
            lambda n: np.random.randn(n),
            _hash_numpy_sampled,
            _hash_numpy_full,
        )
    )
    print()

    # --- Polars DataFrame ---
    print("--- Polars DataFrame (4 float64 columns) ---")
    all_results.extend(
        _run_benchmark(
            "polars DataFrame",
            polars_df_sizes,
            lambda n: pl.DataFrame(
                {"a": np.random.randn(n), "b": np.random.randn(n), "c": np.random.randn(n), "d": np.random.randn(n)}
            ),
            _hash_polars_df_sampled,
            _hash_polars_df_full,
        )
    )
    print()

    # --- Polars Series ---
    print("--- Polars Series (float64) ---")
    all_results.extend(
        _run_benchmark(
            "polars Series",
            polars_series_sizes,
            lambda n: pl.Series("values", np.random.randn(n)),
            _hash_polars_series_sampled,
            _hash_polars_series_full,
        )
    )
    print()

    # --- Summary Table ---
    print("=" * 100)
    print("SUMMARY TABLE")
    print("=" * 100)
    print(
        f"{'Type':<25} | {'Size':>12} | {'Memory':>10} | "
        f"{'Sampled':>12} | {'Full':>12} | {'Slowdown':>10}"
    )
    print("-" * 100)
    for r in all_results:
        size_str = _format_size(r["size"])
        print(
            f"{r['type']:<25} | {size_str:>12} | {r['memory_mb']:>8.1f} MB | "
            f"{r['sampled_ms']:>9.2f} ms | {r['full_ms']:>9.2f} ms | "
            f"{r['ratio']:>8.2f}x"
        )

    print()
    print("=" * 100)
    print("KEY OBSERVATIONS")
    print("=" * 100)

    below_threshold = [r for r in all_results if r["ratio"] <= 1.5]
    above_10x = [r for r in all_results if r["ratio"] > 10]

    print(f"\n  Configurations where full hash is <=1.5x slower: {len(below_threshold)}")
    print(f"  Configurations where full hash is >10x slower: {len(above_10x)}")

    largest_results = [r for r in all_results if r["size"] == max(s for s2 in [pandas_df_sizes] for s in s2)]
    if largest_results:
        max_full_ms = max(r["full_ms"] for r in all_results)
        max_entry = next(r for r in all_results if r["full_ms"] == max_full_ms)
        print(
            f"\n  Worst-case full hash time: {max_full_ms:.2f} ms "
            f"({max_entry['type']}, size={_format_size(max_entry['size'])})"
        )

    pandas_5m = next((r for r in all_results if r["type"] == "pandas DataFrame" and r["size"] == 5_000_000), None)
    numpy_50m = next((r for r in all_results if r["type"] == "numpy ndarray" and r["size"] == 50_000_000), None)

    if pandas_5m:
        print(f"\n  pandas DataFrame (5M rows, 4 cols): sampled={pandas_5m['sampled_ms']:.2f} ms, full={pandas_5m['full_ms']:.2f} ms, ratio={pandas_5m['ratio']:.2f}x")
    if numpy_50m:
        print(f"  numpy ndarray (50M elements): sampled={numpy_50m['sampled_ms']:.2f} ms, full={numpy_50m['full_ms']:.2f} ms, ratio={numpy_50m['ratio']:.2f}x")

    print()


if __name__ == "__main__":
    main()
