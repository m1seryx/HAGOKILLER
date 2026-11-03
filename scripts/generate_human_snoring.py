"""
Generate 220+ varied human-like snoring WAV clips for ML training.

These are synthesized from snore acoustics (periodic inhale bursts,
flutter, breath noise, formants). They are not live person recordings.
Saved as mono 16-bit PCM at 16 kHz to match the pillow mic / Edge Impulse rate.
"""

from __future__ import annotations

import math
import wave
from pathlib import Path

import numpy as np

SAMPLE_RATE = 16000
COUNT = 220
OUT_DIR = Path(__file__).resolve().parents[1] / "dataset" / "human_snoring"


def write_wav(path: Path, samples: np.ndarray) -> None:
    clipped = np.clip(samples, -1.0, 1.0)
    pcm = (clipped * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm.tobytes())


def soft_noise(n: int, rng: np.random.Generator, scale: float) -> np.ndarray:
    return rng.normal(0.0, scale, n).astype(np.float64)


def band_noise(n: int, rng: np.random.Generator, low_hz: float, high_hz: float, scale: float) -> np.ndarray:
    noise = soft_noise(n, rng, 1.0)
    spectrum = np.fft.rfft(noise)
    freqs = np.fft.rfftfreq(n, 1.0 / SAMPLE_RATE)
    mask = (freqs >= low_hz) & (freqs <= high_hz)
    spectrum[~mask] *= 0.05
    filtered = np.fft.irfft(spectrum, n=n)
    peak = np.max(np.abs(filtered)) + 1e-9
    return (filtered / peak) * scale


def formant_filter(signal: np.ndarray, formants: list[tuple[float, float]]) -> np.ndarray:
    spectrum = np.fft.rfft(signal)
    freqs = np.fft.rfftfreq(len(signal), 1.0 / SAMPLE_RATE)
    gain = np.ones_like(freqs)
    for center, width in formants:
        gain += 2.4 * np.exp(-0.5 * ((freqs - center) / max(width, 1.0)) ** 2)
    shaped = np.fft.irfft(spectrum * gain, n=len(signal))
    peak = np.max(np.abs(shaped)) + 1e-9
    return shaped / peak


def snore_burst(
    duration_s: float,
    rng: np.random.Generator,
    pitch_hz: float,
    flutter_hz: float,
    loudness: float,
    harshness: float,
) -> np.ndarray:
    n = max(1, int(duration_s * SAMPLE_RATE))
    t = np.arange(n) / SAMPLE_RATE

    # Glottal-ish pulse train with uneven duty (inhale snore).
    phase = 2.0 * math.pi * pitch_hz * t
    pulse = 0.55 * np.sin(phase) + 0.28 * np.sin(2.0 * phase + 0.4) + 0.12 * np.sin(3.0 * phase)
    pulse = np.tanh(pulse * (1.4 + harshness * 1.8))

    # Soft-palate flutter / vibration.
    flutter = 0.35 + 0.65 * (0.5 + 0.5 * np.sin(2.0 * math.pi * flutter_hz * t + rng.uniform(0, math.pi)))
    breath = band_noise(n, rng, 80.0, 1800.0 + harshness * 2200.0, 0.22 + harshness * 0.35)
    rasp = band_noise(n, rng, 1500.0, 5000.0, harshness * 0.18)

    # Attack / decay envelope for one inhale.
    attack = max(0.02, duration_s * 0.12)
    release = max(0.04, duration_s * 0.28)
    env = np.ones(n)
    a = int(attack * SAMPLE_RATE)
    r = int(release * SAMPLE_RATE)
    if a > 0:
        env[:a] = np.linspace(0.0, 1.0, a)
    if r > 0:
        env[-r:] = np.linspace(1.0, 0.0, r) * env[-r:]
    # Slight mid swell.
    env *= 0.75 + 0.25 * np.sin(math.pi * np.clip(t / max(duration_s, 1e-6), 0.0, 1.0))

    mixed = (pulse * flutter + breath + rasp) * env * loudness
    formants = [
        (120.0 + pitch_hz * 0.4, 40.0),
        (420.0 + harshness * 180.0, 80.0),
        (1100.0 + harshness * 400.0, 160.0),
    ]
    shaped = formant_filter(mixed, formants)
    return shaped * loudness


def synthesize_clip(index: int, rng: np.random.Generator) -> np.ndarray:
    # Varied “people” and sleep styles.
    style = index % 11
    if style in (0, 1, 2):
        # Deeper male-ish
        pitch = rng.uniform(55.0, 95.0)
        flutter = rng.uniform(18.0, 35.0)
        harshness = rng.uniform(0.15, 0.55)
        loudness = rng.uniform(0.35, 0.85)
    elif style in (3, 4, 5):
        # Higher / lighter
        pitch = rng.uniform(95.0, 160.0)
        flutter = rng.uniform(25.0, 48.0)
        harshness = rng.uniform(0.05, 0.4)
        loudness = rng.uniform(0.25, 0.7)
    elif style in (6, 7):
        # Heavy / obstructive
        pitch = rng.uniform(45.0, 80.0)
        flutter = rng.uniform(12.0, 28.0)
        harshness = rng.uniform(0.55, 0.95)
        loudness = rng.uniform(0.55, 0.95)
    else:
        # Irregular light snores
        pitch = rng.uniform(70.0, 140.0)
        flutter = rng.uniform(20.0, 55.0)
        harshness = rng.uniform(0.1, 0.65)
        loudness = rng.uniform(0.2, 0.75)

    duration = rng.uniform(2.8, 6.5)
    n = int(duration * SAMPLE_RATE)
    out = soft_noise(n, rng, rng.uniform(0.004, 0.02))

    # Breathing cycle: inhale snore + quiet gap.
    cycle = rng.uniform(2.2, 4.8)
    burst_len = rng.uniform(0.45, 1.35)
    t = 0.15 + rng.uniform(0.0, 0.35)
    while t + burst_len < duration - 0.1:
        local_pitch = pitch * rng.uniform(0.92, 1.08)
        local_flutter = flutter * rng.uniform(0.9, 1.12)
        local_loud = loudness * rng.uniform(0.7, 1.15)
        local_harsh = clamp(harshness * rng.uniform(0.85, 1.15), 0.0, 1.0)
        burst = snore_burst(burst_len, rng, local_pitch, local_flutter, local_loud, local_harsh)
        start = int(t * SAMPLE_RATE)
        end = min(n, start + len(burst))
        out[start:end] += burst[: end - start]
        # Occasional double snore / catch breath.
        if rng.random() < 0.18:
            gap = rng.uniform(0.08, 0.22)
            second = snore_burst(
                burst_len * rng.uniform(0.35, 0.7),
                rng,
                local_pitch * rng.uniform(0.95, 1.1),
                local_flutter,
                local_loud * 0.7,
                local_harsh,
            )
            s2 = int((t + burst_len + gap) * SAMPLE_RATE)
            e2 = min(n, s2 + len(second))
            if s2 < n:
                out[s2:e2] += second[: e2 - s2]
        t += cycle * rng.uniform(0.85, 1.2)
        burst_len = clamp(burst_len * rng.uniform(0.9, 1.1), 0.4, 1.5)

    # Soft room tone and tiny DC-free normalize.
    out += band_noise(n, rng, 20.0, 200.0, rng.uniform(0.01, 0.04))
    peak = np.max(np.abs(out)) + 1e-9
    target = rng.uniform(0.55, 0.92)
    out = out / peak * target
    return out.astype(np.float64)


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("snore_*.wav"):
        old.unlink()

    manifest = OUT_DIR / "README.txt"
    manifest.write_text(
        "Synthesized human-like snoring WAVs for HAGOKILLER training.\n"
        f"Count: {COUNT}\n"
        f"Format: mono 16-bit PCM, {SAMPLE_RATE} Hz\n"
        "These are generated acoustic approximations (pitch, flutter, breath noise),\n"
        "not recordings of named people. Use as extra positive-class diversity.\n",
        encoding="utf-8",
    )

    for index in range(1, COUNT + 1):
        rng = np.random.default_rng(10_000 + index * 97)
        samples = synthesize_clip(index, rng)
        path = OUT_DIR / f"snore_{index:03d}.wav"
        write_wav(path, samples)
        if index % 20 == 0 or index == COUNT:
            print(f"wrote {index}/{COUNT}: {path.name}")

    print(f"Done. Saved {COUNT} files to {OUT_DIR}")


if __name__ == "__main__":
    main()
