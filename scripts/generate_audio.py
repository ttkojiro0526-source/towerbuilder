"""Generate the game's original, exaggerated scream voices with formant synthesis."""
from math import cos, exp, pi, sin
from pathlib import Path
from random import Random
from subprocess import run
from tempfile import TemporaryDirectory
import array
import sys
import wave

RATE = 24000
ROOT = Path(__file__).resolve().parents[1] / "src" / "assets"

# duration, starting pitch, peak pitch, final pitch, starting vowel, ending vowel
VOICES = {
    "hya": (0.28, 305, 583, 423, (340, 2280, 3070), (960, 1580, 3030)),
    "wa": (0.31, 254, 495, 329, (430, 1050, 2680), (940, 1540, 2980)),
    "uwa": (0.32, 282, 552, 361, (390, 950, 2600), (900, 1690, 2920)),
    "gyaa": (1.51, 230, 638, 272, (345, 2170, 3000), (960, 1580, 3020)),
}


def synthesize(name, settings, target):
    duration, start, peak, end, vowel_from, vowel_to = settings
    rng = Random(322 + len(name))
    phase = 0
    last_noise = 0
    resonators = [[0, 0] for _ in range(3)]
    samples = []
    for i in range(int(duration * RATE)):
        t = i / RATE
        u = t / duration
        rise = min(1, u / 0.23)
        descent = max(0, (u - 0.23) / 0.77)
        pitch = start + (peak - start) * sin(rise * pi / 2) + (end - peak) * descent ** 1.25
        pitch *= 1 + 0.042 * sin(2 * pi * 9 * t) + 0.016 * sin(2 * pi * 23 * t) + rng.uniform(-0.013, 0.013)
        phase += pitch / RATE
        pulse = (max(0, sin(phase * 2 * pi)) ** 3 - 0.20)
        noise = rng.uniform(-1, 1)
        breath = noise - 0.78 * last_noise
        last_noise = noise
        voicing = min(1, max(0, (t - 0.016) * 47))
        source = pulse * voicing + breath * (0.12 + 0.47 * exp(-t * 56))
        vowel = min(1, u * 7)
        out = source * 0.035
        for index, (first, last, bandwidth, strength) in enumerate(zip(vowel_from, vowel_to, (176, 236, 312), (0.88, 0.42, 0.28))):
            frequency = first + (last - first) * vowel + 37 * sin(2 * pi * (6.2 + index) * t)
            radius = exp(-pi * bandwidth / RATE)
            y1, y2 = resonators[index]
            resonance = (1 - radius) * source + 2 * radius * cos(2 * pi * frequency / RATE) * y1 - radius ** 2 * y2
            resonators[index] = [resonance, y1]
            out += strength * resonance
        envelope = min(1, t / 0.059) * (1 - u) ** (0.52 if name == "gyaa" else 0.77)
        envelope *= 0.84 + 0.16 * sin(2 * pi * 12 * t)
        samples.append(out * envelope)

    normalize = (0.61 if name == "gyaa" else 0.51) * 32767 / max(map(abs, samples))
    pcm = array.array("h", (round(value * normalize) for value in samples))
    if sys.byteorder != "little":
        pcm.byteswap()
    with wave.open(str(target), "wb") as sound:
        sound.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        sound.writeframes(pcm.tobytes())


if __name__ == "__main__":
    ROOT.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory() as tmp:
        for name, settings in VOICES.items():
            wav = Path(tmp) / (name + ".wav")
            synthesize(name, settings, wav)
            run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "48k", str(ROOT / (name + ".mp3"))], check=True)
