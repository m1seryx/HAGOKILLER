"""
Add 500 stronger synthesized snoring WAVs into dataset/001_Snore.

Biased toward loud / harsh / obstructive inhale bursts (mono 16-bit PCM, 16 kHz, 3s).
"""

from __future__ import annotations

import hashlib
import math
import re
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SNORE_DIR = ROOT / "dataset" / "001_Snore"
SAMPLE_RATE = 16000
CLIP_SEC = 3.0
CLIP_N = int(SAMPLE_RATE * CLIP_SEC)
COUNT = 500
PREFIX = "1_strong_"


def write_wav(path: Path, samples: np.ndarray) -> None:
    peak = float(np.max(np.abs(samples))) + 1e-9
    pcm = np.clip(samples / peak * 0.95 * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm.tobytes())


def fingerprint(samples: np.ndarray) -> str:
    step = max(1, SAMPLE_RATE // 20)
    quantized = np.clip((samples[::step] * 64).astype(np.int8), -64, 63).tobytes()
    return hashlib.sha1(quantized).hexdigest()


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
        gain += 2.8 * np.exp(-0.5 * ((freqs - center) / max(width, 1.0)) ** 2)
    shaped = np.fft.irfft(spectrum * gain, n=len(signal))
    peak = np.max(np.abs(shaped)) + 1e-9
    return shaped / peak


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


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

    phase = 2.0 * math.pi * pitch_hz * t
    pulse = 0.6 * np.sin(phase) + 0.32 * np.sin(2.0 * phase + 0.35) + 0.16 * np.sin(3.0 * phase)
    pulse = np.tanh(pulse * (1.8 + harshness * 2.4))

    flutter = 0.3 + 0.7 * (0.5 + 0.5 * np.sin(2.0 * math.pi * flutter_hz * t + rng.uniform(0, math.pi)))
    breath = band_noise(n, rng, 70.0, 2000.0 + harshness * 2800.0, 0.28 + harshness * 0.45)
    rasp = band_noise(n, rng, 1400.0, 6500.0, 0.12 + harshness * 0.35)
    rumble = band_noise(n, rng, 30.0, 160.0, 0.18 + harshness * 0.2)

    attack = max(0.015, duration_s * 0.1)
    release = max(0.05, duration_s * 0.25)
    env = np.ones(n)
    a = int(attack * SAMPLE_RATE)
    r = int(release * SAMPLE_RATE)
    if a > 0:
        env[:a] = np.linspace(0.0, 1.0, a)
    if r > 0:
        env[-r:] = np.linspace(1.0, 0.0, r) * env[-r:]
    env *= 0.8 + 0.2 * np.sin(math.pi * np.clip(t / max(duration_s, 1e-6), 0.0, 1.0))

    mixed = (pulse * flutter + breath + rasp + rumble) * env * loudness
    formants = [
        (100.0 + pitch_hz * 0.35, 35.0),
        (380.0 + harshness * 220.0, 90.0),
        (1050.0 + harshness * 500.0, 180.0),
        (2400.0 + harshness * 600.0, 250.0),
    ]
    return formant_filter(mixed, formants) * loudness


def synthesize_strong(index: int, rng: np.random.Generator) -> np.ndarray:
    style = index % 5
    if style == 0:
        # Deep obstructive roar
        pitch = rng.uniform(42.0, 78.0)
        flutter = rng.uniform(10.0, 24.0)
        harshness = rng.uniform(0.75, 1.0)
        loudness = rng.uniform(0.85, 1.15)
    elif style == 1:
        # Heavy male rasp
        pitch = rng.uniform(55.0, 95.0)
        flutter = rng.uniform(16.0, 32.0)
        harshness = rng.uniform(0.65, 0.95)
        loudness = rng.uniform(0.8, 1.1)
    elif style == 2:
        # Wet / congested
        pitch = rng.uniform(60.0, 110.0)
        flutter = rng.uniform(20.0, 40.0)
        harshness = rng.uniform(0.7, 1.0)
        loudness = rng.uniform(0.78, 1.05)
    elif style == 3:
        # High harsh whistle-snore
        pitch = rng.uniform(100.0, 165.0)
        flutter = rng.uniform(28.0, 52.0)
        harshness = rng.uniform(0.6, 0.92)
        loudness = rng.uniform(0.75, 1.05)
    else:
        # Irregular loud bursts
        pitch = rng.uniform(50.0, 130.0)
        flutter = rng.uniform(14.0, 45.0)
        harshness = rng.uniform(0.7, 1.0)
        loudness = rng.uniform(0.82, 1.2)

    # Build a slightly longer take, then crop a loud 3s window.
    duration = rng.uniform(3.4, 5.5)
    n = int(duration * SAMPLE_RATE)
    out = soft_noise(n, rng, rng.uniform(0.003, 0.012))

    cycle = rng.uniform(1.6, 3.2)
    burst_len = rng.uniform(0.55, 1.55)
    t = 0.05 + rng.uniform(0.0, 0.2)
    while t + burst_len < duration - 0.05:
        local_pitch = pitch * rng.uniform(0.9, 1.12)
        local_flutter = flutter * rng.uniform(0.88, 1.15)
        local_loud = loudness * rng.uniform(0.9, 1.25)
        local_harsh = clamp(harshness * rng.uniform(0.9, 1.1), 0.55, 1.0)
        burst = snore_burst(burst_len, rng, local_pitch, local_flutter, local_loud, local_harsh)
        start = int(t * SAMPLE_RATE)
        end = min(n, start + len(burst))
        out[start:end] += burst[: end - start]
        if rng.random() < 0.28:
            gap = rng.uniform(0.05, 0.18)
            second = snore_burst(
                burst_len * rng.uniform(0.4, 0.85),
                rng,
                local_pitch * rng.uniform(0.95, 1.12),
                local_flutter,
                local_loud * rng.uniform(0.75, 1.05),
                local_harsh,
            )
            s2 = int((t + burst_len + gap) * SAMPLE_RATE)
            e2 = min(n, s2 + len(second))
            if s2 < n:
                out[s2:e2] += second[: e2 - s2]
        t += cycle * rng.uniform(0.75, 1.1)
        burst_len = clamp(burst_len * rng.uniform(0.88, 1.15), 0.45, 1.7)

    out += band_noise(n, rng, 20.0, 180.0, rng.uniform(0.02, 0.06))

    # Pick the loudest 3s window so the clip is punchy.
    if n <= CLIP_N:
        clip = out
        if n < CLIP_N:
            pad = np.zeros(CLIP_N, dtype=np.float64)
            pad[:n] = out
            clip = pad
    else:
        hop = SAMPLE_RATE // 8
        best_i = 0
        best_e = -1.0
        for i in range(0, n - CLIP_N + 1, hop):
            window = out[i : i + CLIP_N]
            energy = float(np.sqrt(np.mean(window ** 2)))
            if energy > best_e:
                best_e = energy
                best_i = i
        clip = out[best_i : best_i + CLIP_N]

    peak = np.max(np.abs(clip)) + 1e-9
    # Stronger peak target than the older generator (0.55–0.92).
    target = rng.uniform(0.88, 0.98)
    clip = clip / peak * target
    return clip.astype(np.float32)


def next_index() -> int:
    highest = 0
    pat = re.compile(rf"^{re.escape(PREFIX)}(\d+)\.wav$", re.I)
    for path in SNORE_DIR.iterdir():
        m = pat.match(path.name)
        if m:
            highest = max(highest, int(m.group(1)))
    return highest + 1


def main() -> None:
    SNORE_DIR.mkdir(parents=True, exist_ok=True)
    before = sum(1 for p in SNORE_DIR.iterdir() if p.is_file())
    start = next_index()
    print(f"before 001_Snore={before}; writing {COUNT} strong snores from {PREFIX}{start:05d}")

    avoid: set[str] = set()
    written = 0
    i = 0
    while written < COUNT:
        i += 1
        rng = np.random.default_rng(90_000 + i * 131)
        clip = synthesize_strong(i, rng)
        fp = fingerprint(clip)
        if fp in avoid:
            continue
        avoid.add(fp)
        out = SNORE_DIR / f"{PREFIX}{start + written:05d}.wav"
        write_wav(out, clip)
        written += 1
        if written % 50 == 0 or written == COUNT:
            print(f"  strong snore {written}/{COUNT}")

    after = sum(1 for p in SNORE_DIR.iterdir() if p.is_file())
    print(f"after 001_Snore={after} (+{after - before})")


if __name__ == "__main__":
    main()
