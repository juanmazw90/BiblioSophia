# YouTube Insight — Guía de Instalación

## Requisitos del Sistema

| Herramienta | Versión mínima | Notas |
|---|---|---|
| Windows 10/11 | 10.0.19041+ | Necesario para WebView2 |
| Rust | 1.77+ | Instalar via rustup |
| Node.js | 18+ | Para el frontend |
| yt-dlp | Última | Descarga de audio |
| FFmpeg | 6+ | Conversión de audio |

---

## Paso 1: Instalar Rust

Abre PowerShell y ejecuta:

```powershell
winget install Rustlang.Rustup
```

O descarga desde: https://rustup.rs

Reinicia tu terminal. Verifica:

```bash
rustc --version
cargo --version
```

---

## Paso 2: Instalar WebView2 (Windows)

Tauri necesita WebView2 para renderizar la UI. En Windows 11 ya viene instalado.
Si no lo tienes:

```powershell
winget install Microsoft.EdgeWebView2Runtime
```

---

## Paso 3: Instalar Node.js

```powershell
winget install OpenJS.NodeJS.LTS
```

Verifica: `node --version` y `npm --version`

---

## Paso 4: Instalar yt-dlp

```powershell
winget install yt-dlp.yt-dlp
```

O manualmente:
```powershell
# Descargar el ejecutable
Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile "C:\Windows\System32\yt-dlp.exe"
```

Verifica: `yt-dlp --version`

---

## Paso 5: Instalar FFmpeg

```powershell
winget install Gyan.FFmpeg
```

O con Chocolatey:
```powershell
choco install ffmpeg
```

Verifica: `ffmpeg -version`

> **Nota Windows:** Si FFmpeg está en `C:\ffmpeg\bin\`, agrégalo al PATH:
> Sistema → Variables de entorno → PATH → Agregar `C:\ffmpeg\bin`

---

## Paso 6: Instalar dependencias del proyecto

En la carpeta del proyecto:

```bash
npm install
```

---

## Paso 7: Obtener API Keys

### Groq (transcripción — gratis hasta cierto límite)
1. Ve a https://console.groq.com
2. Crea una cuenta gratuita
3. API Keys → Create API Key
4. Copia la key (empieza con `gsk_`)

### Anthropic (resúmenes — de pago)
1. Ve a https://console.anthropic.com
2. Settings → API Keys → Create Key
3. Copia la key (empieza con `sk-ant-`)

### Notion (opcional — para guardar en Notion)
1. Ve a https://www.notion.so/my-integrations
2. New Integration → dale nombre → Submit
3. Copia el "Internal Integration Secret" (empieza con `secret_`)
4. En tu página de Notion: Share → Invite → selecciona tu integración
5. Copia el ID de la página desde la URL (los 32 caracteres después del último `/`)

---

## Paso 8: Correr en modo desarrollo

```bash
npm run tauri dev
```

La primera vez tarda 5-10 minutos porque compila el backend en Rust.

---

## Paso 9: Compilar para distribución

```bash
npm run tauri build
```

Genera el instalador en `src-tauri/target/release/bundle/`.

---

## Solución de problemas comunes

### Error: "yt-dlp no encontrado"
- Verifica que yt-dlp esté en el PATH: `where yt-dlp`
- Reinicia la terminal/app después de instalarlo

### Error: "FFmpeg no encontrado"
- Verifica: `where ffmpeg`
- Asegúrate de que `C:\ffmpeg\bin` esté en el PATH del sistema

### Error "API key inválida (401)"
- Verifica que la key esté correctamente copiada en Ajustes
- Asegúrate de no tener espacios al inicio/final

### Error de compilación Rust: "linker not found"
- Instala Build Tools para Visual Studio:
  ```
  winget install Microsoft.VisualStudio.2022.BuildTools
  ```
- Reinicia y vuelve a intentar

### El video falla con "Private video" o "Sign in"
- yt-dlp no puede descargar videos privados o con restricción de edad
- Solo funciona con videos públicos

---

## Estructura del proyecto

```
youtube-insight/
├── src/                  # Frontend React + TypeScript
│   ├── components/       # UI Components
│   ├── services/         # Capa de comunicación con Tauri
│   ├── store/            # Estado global (Zustand)
│   └── types/            # TypeScript types
├── src-tauri/            # Backend Rust
│   ├── src/
│   │   └── lib.rs        # Comandos Tauri (download, transcribe, etc.)
│   ├── Cargo.toml        # Dependencias Rust
│   └── tauri.conf.json   # Config de la app
└── SETUP.md              # Esta guía
```

## Arquitectura de datos

```
Usuario pega URL
    ↓
[Rust] get_video_info()  → yt-dlp --dump-json
    ↓
[Rust] download_audio()  → yt-dlp → MP3 en /AppData/audio_temp/
    ↓
[Rust] transcribe_audio() → Groq API (Whisper-large-v3)
    ↓
[Rust] generate_summary() → Anthropic API (Claude)
    ↓
[Rust] save_markdown()    → Archivo .md local
[Rust] send_to_notion()   → Notion API
    ↓
[Frontend] Muestra resultado
```
