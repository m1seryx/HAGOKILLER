"""
Remove jOUp2ODyfns*.wav clips from dataset/000_NonSnore and replace them with
clapping, electric-fan, and partying sounds (3s @ 16 kHz), keeping count stable.
"""

from __future__ import annotations

import hashlib
import re
import wave
from pathlib import Path

import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
NON_DIR = ROOT / "dataset" / "000_NonSnore"
SAMPLE_RATE = 16000
CLIP_SEC = 3.0
CLIP_N = int(SAMPLE_RATE * CLIP_SEC)
JOUP_PREFIX = "joup2odyfns"


def write_wav(path: Path, samples: np.ndarray) -> None:
    peak = float(np.max(np.abs(samples))) + 1e-9
    pcm = np.clip(samples / peak * 0.9 * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm.tobytes())


def fingerprint(samples: np.ndarray) -> str:
    step = max(1, SAMPLE_RATE // 20)
    quantized = np.clip((samples[::step] * 64).astype(np.int8), -64, 63).tobytes()
    return hashlib.sha1(quantized).hexdigest()


def band_noise(n: int, rng: np.random.Generator, lo: float, hi: float, amp: float) -> np.ndarray:
    noise = rng.normal(0.0, 1.0, size=n).astype(np.float32)
    spectrum = np.fft.rfft(noise)
    freqs = np.fft.rfftfreq(n, d=1.0 / SAMPLE_RATE)
    mask = (freqs >= lo) & (freqs <= hi)
    filtered = np.zeros_like(spectrum)
    filtered[mask] = spectrum[mask]
    out = np.fft.irfft(filtered, n=n).astype(np.float32)
    peak = float(np.max(np.abs(out))) + 1e-9
    return out / peak * amp


def load_mono16(path: Path) -> np.ndarray | None:
    try:
        rate, data = wavfile.read(path)
    except Exception:
        return None
    if data.ndim > 1:
        data = data.mean(axis=1)
    if data.dtype == np.int16:
        samples = data.astype(np.float32) / 32768.0
    elif data.dtype == np.int32:
        samples = data.astype(np.float32) / 2147483648.0
    else:
        samples = data.astype(np.float32)
        peak = float(np.max(np.abs(samples))) + 1e-9
        samples = samples / peak
    if rate == SAMPLE_RATE:
        return samples
    duration = len(samples) / float(rate)
    target_n = max(1, int(round(duration * SAMPLE_RATE)))
    x_old = np.linspace(0.0, 1.0, num=len(samples), endpoint=False)
    x_new = np.linspace(0.0, 1.0, num=target_n, endpoint=False)
    return np.interp(x_new, x_old, samples).astype(np.float32)


def make_clap(rng: np.random.Generator) -> np.ndarray:
    out = np.zeros(CLIP_N, dtype=np.float32)
    n_claps = int(rng.integers(4, 10))
    t = 0
    for _ in range(n_claps):
        gap = int(rng.integers(SAMPLE_RATE // 8, SAMPLE_RATE // 2))
        t = min(CLIP_N - 1, t + gap)
        burst_n = int(rng.integers(SAMPLE_RATE // 120, SAMPLE_RATE // 40))
        end = min(CLIP_N, t + burst_n)
        env = np.exp(-np.linspace(0.0, 8.0, end - t)).astype(np.float32)
        click = rng.normal(0.0, 1.0, size=end - t).astype(np.float32)
        # Bright transient + soft body.
        body = band_noise(end - t, rng, 200.0, 2500.0, 0.55)
        bright = band_noise(end - t, rng, 2500.0, 8000.0, 0.85)
        out[t:end] += (click * 0.15 + body + bright) * env * float(rng.uniform(0.55, 1.0))
        t = end
    # Room tail
    out += band_noise(CLIP_N, rng, 100.0, 600.0, 0.04)
    return out


def make_fan(rng: np.random.Generator) -> np.ndarray:
    n = CLIP_N
    t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
    # Mains hum + blade whoosh
    hum_hz = float(rng.choice([50.0, 60.0]))
    blade_hz = float(rng.uniform(18.0, 42.0))
    hum = 0.18 * np.sin(2 * np.pi * hum_hz * t)
    hum += 0.08 * np.sin(2 * np.pi * (2 * hum_hz) * t)
    whoosh = band_noise(n, rng, 80.0, 900.0, 0.55)
    flutter = 0.65 + 0.35 * np.sin(2 * np.pi * blade_hz * t + float(rng.uniform(0, 6)))
    hiss = band_noise(n, rng, 1200.0, 5000.0, 0.12)
    motor = band_noise(n, rng, 40.0, 180.0, 0.22)
    out = (whoosh * flutter + hiss + motor + hum).astype(np.float32)
    # Slow amplitude drift
    drift = 0.85 + 0.15 * np.sin(2 * np.pi * float(rng.uniform(0.15, 0.45)) * t)
    return out * drift.astype(np.float32)


def make_party(rng: np.random.Generator, laugh_bank: list[np.ndarray]) -> np.ndarray:
    n = CLIP_N
    t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
    # Crowd bed
    crowd = band_noise(n, rng, 200.0, 3500.0, 0.35)
    crowd += band_noise(n, rng, 80.0, 250.0, 0.18)
    # Kick / bass thumps
    bpm = float(rng.uniform(100.0, 128.0))
    beat = np.zeros(n, dtype=np.float32)
    period = int(SAMPLE_RATE * 60.0 / bpm)
    for i in range(0, n, period):
        end = min(n, i + int(SAMPLE_RATE * 0.08))
        env = np.exp(-np.linspace(0.0, 12.0, end - i)).astype(np.float32)
        f0 = float(rng.uniform(45.0, 70.0))
        thump = np.sin(2 * np.pi * f0 * np.arange(end - i) / SAMPLE_RATE).astype(np.float32)
        beat[i:end] += thump * env * 0.7
    # Clap-ish snare on offbeats
    snares = np.zeros(n, dtype=np.float32)
    for i in range(period // 2, n, period):
        end = min(n, i + int(SAMPLE_RATE * 0.04))
        env = np.exp(-np.linspace(0.0, 10.0, end - i)).astype(np.float32)
        snares[i:end] += band_noise(end - i, rng, 1500.0, 7000.0, 0.55) * env
    # Optional laughter sprinkle
    laugh = np.zeros(n, dtype=np.float32)
    if laugh_bank:
        src = laugh_bank[int(rng.integers(0, len(laugh_bank)))]
        if len(src) >= 1:
            start = int(rng.integers(0, max(1, n // 3)))
            take = min(len(src), n - start, int(SAMPLE_RATE * float(rng.uniform(0.6, 1.4))))
            laugh[start : start + take] += src[:take] * float(rng.uniform(0.25, 0.55))
    # Light synth stab
    stab_f = float(rng.uniform(220.0, 440.0))
    stab = 0.08 * np.sin(2 * np.pi * stab_f * t) * (0.5 + 0.5 * np.sin(2 * np.pi * (bpm / 60.0) * t))
    out = (crowd + beat + snares + laugh + stab.astype(np.float32)).astype(np.float32)
    return out


def collect_remove_targets() -> list[Path]:
    return sorted(
        p for p in NON_DIR.iterdir()
        if p.is_file() and p.name.lower().startswith(JOUP_PREFIX)
    )


def next_index(prefix: str) -> int:
    highest = 0
    pat = re.compile(rf"^{re.escape(prefix)}_(\d+)\.wav$", re.I)
    for path in NON_DIR.iterdir():
        m = pat.match(path.name)
        if m:
            highest = max(highest, int(m.group(1)))
    return highest + 1


def load_laugh_bank(rng: np.random.Generator, limit: int = 40) -> list[np.ndarray]:
    bank: list[np.ndarray] = []
    laughs = [p for p in NON_DIR.iterdir() if p.is_file() and "laugh" in p.name.lower()]
    if not laughs:
        return bank
    rng.shuffle(laughs)
    for path in laughs[:limit]:
        samples = load_mono16(path)
        if samples is None or len(samples) < SAMPLE_RATE // 2:
            continue
        bank.append(samples)
    return bank


def main() -> None:
    if not NON_DIR.exists():
        raise SystemExit(f"missing {NON_DIR}")

    before = sum(1 for p in NON_DIR.iterdir() if p.is_file())
    targets = collect_remove_targets()
    print(f"before count: {before}")
    print(f"jOUp2ODyfns to remove: {len(targets)}")

    for path in targets:
        path.unlink(missing_ok=True)

    mid = sum(1 for p in NON_DIR.iterdir() if p.is_file())
    need = before - mid
    print(f"after delete: {mid}; need replacements: {need}")
    if need <= 0:
        print("nothing to replace")
        return

    rng = np.random.default_rng(20261102)
    laugh_bank = load_laugh_bank(rng)
    avoid: set[str] = set()

    # Roughly equal clap / fan / party
    kinds = (["clap"] * ((need + 2) // 3)
             + ["fan"] * ((need + 1) // 3)
             + ["party"] * (need // 3))
    kinds = kinds[:need]
    rng.shuffle(kinds)

    idx = {
        "clap": next_index("0_clap"),
        "fan": next_index("0_fan"),
        "party": next_index("0_party"),
    }
    counts = {"clap": 0, "fan": 0, "party": 0}

    for kind in kinds:
        for _attempt in range(25):
            if kind == "clap":
                clip = make_clap(rng)
            elif kind == "fan":
                clip = make_fan(rng)
            else:
                clip = make_party(rng, laugh_bank)
            fp = fingerprint(clip)
            if fp in avoid:
                continue
            avoid.add(fp)
            out = NON_DIR / f"0_{kind}_{idx[kind] + counts[kind]:05d}.wav"
            write_wav(out, clip)
            counts[kind] += 1
            break
        else:
            # Last-resort unique noise pad so count still matches.
            clip = band_noise(CLIP_N, rng, 100.0, 4000.0, 0.4)
            out = NON_DIR / f"0_{kind}_{idx[kind] + counts[kind]:05d}.wav"
            write_wav(out, clip)
            counts[kind] += 1

    after = sum(1 for p in NON_DIR.iterdir() if p.is_file())
    left = sum(1 for p in NON_DIR.iterdir() if p.is_file() and p.name.lower().startswith(JOUP_PREFIX))
    print(f"added clap={counts['clap']} fan={counts['fan']} party={counts['party']}")
    print(f"after count: {after}")
    print(f"remaining jOUp2ODyfns={left}")
    if after != before:
        print(f"WARNING: count drift {before} -> {after}")


if __name__ == "__main__":
    main()
