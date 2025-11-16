import streamlit as st
import numpy as np
import matplotlib.pyplot as plt
from math import pi
import time

# Classifier logic
def normalize_phase(phi):
    return phi % (2 * np.pi)

REFERENCE_PHASES = {
    'ψ₀ (0)': 0,
    'ψ₁ (π/2)': np.pi / 2,
    'ψ₂ (π)': np.pi,
    'ψ₃ (3π/2)': 3 * np.pi / 2
}

def classify_qudit_phase(phase_value):
    phi = normalize_phase(phase_value)
    min_delta = float('inf')
    best_label = None
    for label, ref in REFERENCE_PHASES.items():
        delta = min(abs(phi - ref), 2 * np.pi - abs(phi - ref))
        if delta < min_delta:
            min_delta = delta
            best_label = label
    return best_label, min_delta

# Simulate biometric signal
def simulate_biometric_signal(true_phase_rad, noise_std=0.02, freq=72e9, fs=1e12, duration_ns=1.0):
    T = duration_ns * 1e-9
    N = int(fs * T)
    t = np.linspace(0, T, N, endpoint=False)
    clean = np.cos(2 * np.pi * freq * t + true_phase_rad)
    noise = np.random.normal(0, noise_std, N)
    return t, clean + noise

# FFT phase extraction
def extract_phase(signal, fs, target_freq=72e9, span=5e9):
    N = len(signal)
    window = np.hanning(N)
    fft_vals = np.fft.fft(signal * window)
    freqs = np.fft.fftfreq(N, 1/fs)
    freqs, fft_vals = freqs[:N//2], fft_vals[:N//2]
    mask = (freqs >= target_freq - span) & (freqs <= target_freq + span)
    peak_idx = np.argmax(np.abs(fft_vals[mask]))
    phase = np.angle(fft_vals[mask][peak_idx])
    return phase

# Streamlit UI
st.set_page_config(page_title="EntangleBeat™ Live Stream", layout="centered")
st.title("🛩️ EntangleBeat™ Live Cockpit Monitor")
st.subheader("Live Quantum Biometric Authentication Stream")

interval = st.slider("Update Interval (seconds)", 0.5, 5.0, 1.0, 0.1)
run_stream = st.checkbox("Start Live Stream")

placeholder = st.empty()

while run_stream:
    simulated_phase = np.random.uniform(0, 2 * np.pi)
    t, signal = simulate_biometric_signal(simulated_phase)
    extracted_phase = extract_phase(signal, fs=1e12)
    label, delta = classify_qudit_phase(extracted_phase)

    with placeholder.container():
        st.markdown(f"**Simulated Phase Input:** {simulated_phase:.4f} rad")
        st.markdown(f"**Extracted Phase:** {extracted_phase:.4f} rad")
        st.markdown(f"**Classified as:** {label}")
        st.markdown(f"**Δ = {delta:.4f} rad**")

        if delta < 0.3:
            st.success("✅ Phase authenticated: cockpit system stable.")
        elif delta < 0.7:
            st.warning("⚠️ Phase deviation detected: monitoring pilot state.")
        else:
            st.error("🟥 Phase anomaly! Triggering EntangleBeat™ Panic Lock Override.")

        # Plot signal
        fig, ax = plt.subplots()
        ax.plot(t[:2000]*1e9, signal[:2000])
        ax.set_title("Simulated Biometric Pulse")
        ax.set_xlabel("Time (ns)")
        ax.set_ylabel("Amplitude")
        st.pyplot(fig)

    time.sleep(interval)
