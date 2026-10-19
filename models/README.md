# Local model files

Large model files are never committed. They live here or in Ollama's own cache:

| What | Where | Size | How it gets here |
|---|---|---|---|
| Gemma 4 (teacher, plans, artwork feedback) | Ollama cache (`%USERPROFILE%\.ollama\models` on Windows) | e2b ≈ 7 GB · e4b ≈ 10 GB · 12b ≈ 8 GB download | `start-backend.bat` runs `ollama pull` |
| Piper voice `en_US-ljspeech-medium` | `models/piper/` | ≈ 60 MB | `start-backend.bat` downloads it once |
| Stable Diffusion checkpoint (optional) | inside your Stable Diffusion WebUI / Forge install | 2–7 GB | you install it yourself |
