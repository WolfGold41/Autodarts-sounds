#!/usr/bin/env python3
"""Erzeugt Sprecherspur, Zeitplan und Untertitel aus content.json.

Jeder Satz wird einzeln mit Piper (deutsche Stimme) synthetisiert. Dadurch sind Szenenwechsel,
Einblendungen und Untertitel exakt auf die gesprochenen Sätze getimt.

Ausgabe (build/):
  narration.wav   – fertige Sprecherspur (48 kHz, lautheitsnormalisiert)
  timeline.json   – Szenen- und Satz-Zeitpunkte für player.js
  untertitel.srt  – Untertitel als Datei (zusätzlich zur eingebrannten Fassung)
"""
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BUILD = ROOT / "build"
VOICE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "voice" / "de-thorsten-low.onnx"

LEAD_IN = 0.8        # Stille vor dem ersten Satz
SENTENCE_GAP = 0.35  # Pause zwischen Sätzen
SCENE_GAP = 0.9      # Pause zwischen Szenen
TAIL = 2.5           # Stille nach dem letzten Satz
MAX_CUE_CHARS = 74   # max. Zeichen pro Untertitel-Einblendung (2 Zeilen)


def synth(text, out, length_scale):
    cmd = [sys.executable, "-m", "piper", "-m", str(VOICE), "-f", str(out), "--length-scale", str(length_scale)]
    subprocess.run(cmd, input=text.encode("utf-8"), check=True, capture_output=True)


def read_wav(path):
    with wave.open(str(path), "rb") as w:
        return w.getframerate(), w.getnchannels(), w.getsampwidth(), w.readframes(w.getnframes())


def split_cue(text):
    """Teilt einen Satz in lesbare Untertitel-Häppchen (an Satzzeichen, sonst an Wortgrenzen)."""
    if len(text) <= MAX_CUE_CHARS:
        return [text]
    parts = re.split(r"(?<=[,;:–—])\s+", text)
    chunks, cur = [], ""
    for p in parts:
        if cur and len(cur) + 1 + len(p) > MAX_CUE_CHARS:
            chunks.append(cur)
            cur = p
        else:
            cur = f"{cur} {p}".strip()
    if cur:
        chunks.append(cur)
    out = []
    for c in chunks:
        while len(c) > MAX_CUE_CHARS:
            cut = c.rfind(" ", 0, MAX_CUE_CHARS)
            out.append(c[:cut])
            c = c[cut + 1:]
        out.append(c)
    return out


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def main():
    content = json.loads((ROOT / "content.json").read_text(encoding="utf-8"))
    length_scale = content.get("voice", {}).get("lengthScale", 1.0)
    BUILD.mkdir(exist_ok=True)
    tmp = BUILD / "tts"
    tmp.mkdir(exist_ok=True)

    rate = ch = sw = None
    pcm = bytearray()

    def silence(sec):
        pcm.extend(b"\x00" * (int(rate * sec) * ch * sw))

    def now():
        return len(pcm) / (rate * ch * sw)

    scenes, subtitles = [], []
    first = True
    for si, scene in enumerate(content["scenes"]):
        lines = []
        for li, line in enumerate(scene["lines"]):
            wav = tmp / f"{si:02d}_{li:02d}.wav"
            synth(line.get("say", line["sub"]), wav, line.get("lengthScale", length_scale))
            r, c, s, frames = read_wav(wav)
            if rate is None:
                rate, ch, sw = r, c, s
                silence(LEAD_IN)
            elif first is False and li == 0:
                silence(SCENE_GAP)
            elif li > 0:
                silence(SENTENCE_GAP)
            first = False
            if li == 0:
                scene_start = max(0.0, now() - (LEAD_IN if si == 0 else 0.35))
            start = now()
            pcm.extend(frames)
            end = now()
            lines.append({"start": round(start, 3), "end": round(end, 3)})
            chunks = split_cue(line["sub"])
            total = sum(len(x) for x in chunks)
            t = start
            for k, chunk in enumerate(chunks):
                d = (end - start) * len(chunk) / total
                subtitles.append({"start": round(t, 3), "end": round(t + d if k < len(chunks) - 1 else end + 0.25, 3), "text": chunk})
                t += d
        hold = scene.get("hold", 0.0)
        if hold:
            silence(hold)
        scenes.append({"id": scene["id"], "start": round(scene_start, 3), "lines": lines})

    silence(TAIL)
    duration = now()
    for i, sc in enumerate(scenes):
        sc["end"] = round(scenes[i + 1]["start"] + 0.35, 3) if i + 1 < len(scenes) else round(duration, 3)

    raw = BUILD / "narration_raw.wav"
    with wave.open(str(raw), "wb") as w:
        w.setnchannels(ch)
        w.setsampwidth(sw)
        w.setframerate(rate)
        w.writeframes(bytes(pcm))
    # Klang: Tiefen entrümpeln, leicht anwärmen, auf -16 LUFS normalisieren, 48 kHz Stereo
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
        "-af", "highpass=f=70,equalizer=f=180:t=q:w=1.2:g=2,equalizer=f=3500:t=q:w=1.5:g=1.5,"
               "acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,loudnorm=I=-16:TP=-1.5:LRA=7,"
               "aresample=48000",
        "-ac", "2", str(BUILD / "narration.wav"),
    ], check=True)

    (BUILD / "timeline.json").write_text(json.dumps({"duration": round(duration, 3), "scenes": scenes, "subtitles": subtitles}, ensure_ascii=False, indent=1), encoding="utf-8")
    with open(BUILD / "untertitel.srt", "w", encoding="utf-8") as f:
        for i, c in enumerate(subtitles, 1):
            f.write(f"{i}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{c['text']}\n\n")
    print(f"Dauer {duration:.1f}s, {len(scenes)} Szenen, {len(subtitles)} Untertitel")


if __name__ == "__main__":
    main()
