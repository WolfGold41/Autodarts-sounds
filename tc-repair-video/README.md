# TC Service & Repair – Motion-Graphics-Video

Fertiges Video: `output/tc-service-repair.mp4` (1920×1080, 30 fps, 2:52 min, deutsche Sprecherstimme, Untertitel eingebrannt) und `output/untertitel.srt`.

## Inhalt
Alle Texte und Fakten stammen von tc-repair.de. Die Zahlen sind ausgezählt:
- **13 Hersteller**, auf der Website namentlich genannt: Apple, Samsung, Xiaomi, Google, Huawei, Sony, Lenovo, HP, Dell, Acer, Asus, MSI, Medion
- **6 Gerätekategorien**: Smartphones, Tablets, Smartwatches, Notebooks, PCs, Konsolen

## Anpassen und neu rendern
1. Texte und Szenen in `content.json` ändern. `sub` ist der Untertitel, `say` die optionale Sprechfassung, `lexicon` regelt die Aussprache.
2. Logo und Porträt: `assets/logo.svg` (weiße Fassung für Navy) und `assets/portrait.png` (freigestellt). Fehlen die Dateien, nutzt der Player einen Text-Fallback bzw. eine Kennzahlen-Spalte.
3. Stimme: `voice/de-thorsten-low.onnx` von https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-de-thorsten-low.tar.gz, dazu `pip install piper-tts`.
4. `python3 build_audio.py` erzeugt Sprecherspur, Timing und SRT.
5. `node render.mjs` erzeugt das MP4 (Playwright/Chromium + ffmpeg). Standbilder zum Prüfen: `node render.mjs --still 5,30`.

Untertitel: Inter SemiBold, weiß auf Navy (#0A1524) mit blauem Rand (#2E7FD1), unterer Bildrand. Für die hellblaue Variante `"subtitleStyle": "light"` setzen (Navy-Schrift auf #5AA9F0).
