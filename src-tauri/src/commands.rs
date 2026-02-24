use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

// ─── Data Types ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressEvent {
    pub stage: String,
    pub message: String,
    pub percent: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoInfo {
    pub title: String,
    pub channel: String,
    pub duration: u64,
    pub url: String,
    pub thumbnail: Option<String>,
    pub description: Option<String>,
    pub upload_date: Option<String>, // ISO format: "YYYY-MM-DD"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessResult {
    pub video_info: VideoInfo,
    pub transcript: String,
    pub summary: String,
    pub tokens_used: u32,
    pub audio_duration_seconds: f32,
    pub cost_estimate: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessSettings {
    pub groq_api_key: String,
    pub anthropic_api_key: String,
    pub notion_api_key: Option<String>,
    pub notion_parent_id: Option<String>,
    pub output_dir: Option<String>,
    pub summary_model: String,
    pub custom_prompt: String,
    pub save_locally: bool,
    pub send_to_notion: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UsageEntry {
    pub id: String,
    pub timestamp: String,
    pub video_title: String,
    pub video_url: String,
    pub transcription_provider: String,
    pub summary_provider: String,
    pub audio_duration_seconds: f32,
    pub tokens_used: u32,
    pub cost_usd: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DepsStatus {
    pub ytdlp_version: Option<String>,
    pub ffmpeg_available: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SummaryResult {
    pub summary: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub total_tokens: u32,
    pub cost_usd: f64,
}

// ─── Helper Functions ──────────────────────────────────────────────────────────

fn emit_progress(app: &AppHandle, stage: &str, message: &str, percent: Option<f32>) {
    let event = ProgressEvent {
        stage: stage.to_string(),
        message: message.to_string(),
        percent,
    };
    let _ = app.emit("process-progress", event);
}

fn get_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("No se pudo obtener el directorio de datos: {}", e))
}

fn get_temp_audio_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let mut dir = get_app_data_dir(app)?;
    dir.push("audio_temp");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Error creando directorio temporal: {}", e))?;
    Ok(dir)
}

fn parse_download_percent(line: &str) -> Option<f32> {
    let trimmed = line.trim();
    if let Some(pos) = trimmed.find('%') {
        let before = &trimmed[..pos];
        let start = before.rfind(|c: char| c == ' ' || c == '[').map(|i| i + 1).unwrap_or(0);
        before[start..].parse::<f32>().ok()
    } else {
        None
    }
}

fn format_duration(seconds: u64) -> String {
    let h = seconds / 3600;
    let m = (seconds % 3600) / 60;
    let s = seconds % 60;
    if h > 0 {
        format!("{}h {:02}m {:02}s", h, m, s)
    } else {
        format!("{}m {:02}s", m, s)
    }
}

fn calculate_claude_cost(model: &str, input_tokens: u32, output_tokens: u32) -> f64 {
    let (input_price, output_price) = match model {
        m if m.contains("claude-opus-4") => (15.0, 75.0),
        m if m.contains("claude-sonnet-4") => (3.0, 15.0),
        m if m.contains("claude-haiku-4") => (0.80, 4.0),
        _ => (3.0, 15.0),
    };
    let input_cost = (input_tokens as f64 / 1_000_000.0) * input_price;
    let output_cost = (output_tokens as f64 / 1_000_000.0) * output_price;
    (input_cost + output_cost * 100.0).round() / 100.0
}

/// Extract a section from a markdown-formatted summary by its header keyword.
fn parse_section(text: &str, header_keyword: &str) -> String {
    let mut in_section = false;
    let mut result: Vec<&str> = Vec::new();
    for line in text.lines() {
        if line.starts_with("## ") && line.contains(header_keyword) {
            in_section = true;
            continue;
        }
        if in_section {
            if line.starts_with('#') {
                break;
            }
            result.push(line);
        }
    }
    result.join("\n").trim().to_string()
}

/// Truncate text to fit Notion's 2000-char rich_text limit.
fn truncate_notion(text: &str, max: usize) -> String {
    let chars: Vec<char> = text.chars().collect();
    if chars.len() <= max {
        text.to_string()
    } else {
        chars[..max.saturating_sub(3)].iter().collect::<String>() + "..."
    }
}

fn build_notion_blocks(summary: &str, transcript: &str) -> serde_json::Value {
    // Render summary as proper Notion blocks respecting markdown structure
    let summary_blocks: Vec<serde_json::Value> = summary
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|line| {
            if line.starts_with("## ") {
                let text = line.trim_start_matches('#').trim();
                serde_json::json!({
                    "object": "block",
                    "type": "heading_2",
                    "heading_2": {
                        "rich_text": [{ "type": "text", "text": { "content": text } }]
                    }
                })
            } else if line.starts_with("# ") {
                let text = line.trim_start_matches('#').trim();
                serde_json::json!({
                    "object": "block",
                    "type": "heading_1",
                    "heading_1": {
                        "rich_text": [{ "type": "text", "text": { "content": text } }]
                    }
                })
            } else if line.starts_with("> ") {
                let text = line.trim_start_matches('>').trim();
                serde_json::json!({
                    "object": "block",
                    "type": "quote",
                    "quote": {
                        "rich_text": [{ "type": "text", "text": { "content": text } }]
                    }
                })
            } else if line.starts_with("• ") || line.starts_with("- ") || line.starts_with("* ") {
                let clean = line.trim_start_matches(['•', '-', '*', ' ']).trim();
                serde_json::json!({
                    "object": "block",
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": [{ "type": "text", "text": { "content": clean } }]
                    }
                })
            } else if line.starts_with("---") {
                serde_json::json!({ "object": "block", "type": "divider", "divider": {} })
            } else {
                serde_json::json!({
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{ "type": "text", "text": { "content": line } }]
                    }
                })
            }
        })
        .collect();

    let transcript_chunks: Vec<serde_json::Value> = transcript
        .chars()
        .collect::<Vec<char>>()
        .chunks(2000)
        .map(|chunk| {
            let text: String = chunk.iter().collect();
            serde_json::json!({
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{ "type": "text", "text": { "content": text } }]
                }
            })
        })
        .collect();

    let mut blocks: Vec<serde_json::Value> = Vec::new();
    blocks.extend(summary_blocks);
    blocks.push(serde_json::json!({ "object": "block", "type": "divider", "divider": {} }));
    blocks.push(serde_json::json!({
        "object": "block",
        "type": "toggle",
        "toggle": {
            "rich_text": [{ "type": "text", "text": { "content": "📄 Transcripción completa (click para expandir)" } }],
            "children": transcript_chunks
        }
    }));

    serde_json::Value::Array(blocks)
}

// ─── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_video_info(url: String) -> Result<VideoInfo, String> {
    let output = Command::new("yt-dlp")
        .args(["--dump-json", "--no-playlist", &url])
        .output()
        .await
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "yt-dlp no está instalado. Consulta SETUP.md para instrucciones.".to_string()
            } else {
                format!("Error ejecutando yt-dlp: {}", e)
            }
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp falló: {}", stderr));
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Error parseando metadata: {}", e))?;

    // Convert yt-dlp upload_date "YYYYMMDD" → "YYYY-MM-DD"
    let upload_date = json["upload_date"].as_str().and_then(|d| {
        if d.len() == 8 {
            Some(format!("{}-{}-{}", &d[..4], &d[4..6], &d[6..8]))
        } else {
            None
        }
    });

    Ok(VideoInfo {
        title: json["title"].as_str().unwrap_or("Sin título").to_string(),
        channel: json["uploader"]
            .as_str()
            .or_else(|| json["channel"].as_str())
            .unwrap_or("Desconocido")
            .to_string(),
        duration: json["duration"].as_u64().unwrap_or(0),
        url: url.clone(),
        thumbnail: json["thumbnail"].as_str().map(|s| s.to_string()),
        description: json["description"]
            .as_str()
            .map(|s| s.chars().take(500).collect()),
        upload_date,
    })
}

#[tauri::command]
pub async fn download_audio(app: AppHandle, url: String) -> Result<String, String> {
    let audio_dir = get_temp_audio_dir(&app)?;
    let output_template = audio_dir
        .join("%(id)s.%(ext)s")
        .to_string_lossy()
        .to_string();

    emit_progress(&app, "download", "Iniciando descarga de audio...", Some(0.0));

    let check = Command::new("yt-dlp")
        .arg("--version")
        .output()
        .await
        .map_err(|_| "yt-dlp no está instalado. Consulta SETUP.md para instrucciones.".to_string())?;

    if !check.status.success() {
        return Err("yt-dlp no está disponible.".to_string());
    }

    let mut child = Command::new("yt-dlp")
        .args([
            "--extract-audio",
            "--audio-format",
            "mp3",
            "--audio-quality",
            "0",
            "--no-playlist",
            "--newline",
            "-o",
            &output_template,
            &url,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Error iniciando descarga: {}", e))?;

    if let Some(stdout) = child.stdout.take() {
        let mut reader = BufReader::new(stdout).lines();
        let app_clone = app.clone();

        tokio::spawn(async move {
            while let Ok(Some(line)) = reader.next_line().await {
                if line.contains("[download]") && line.contains('%') {
                    if let Some(pct) = parse_download_percent(&line) {
                        emit_progress(
                            &app_clone,
                            "download",
                            &format!("Descargando audio... {:.0}%", pct),
                            Some(pct),
                        );
                    }
                } else if line.contains("[ExtractAudio]") {
                    emit_progress(&app_clone, "download", "Convirtiendo a MP3...", Some(95.0));
                }
            }
        });
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Error esperando yt-dlp: {}", e))?;

    if !status.success() {
        return Err(
            "La descarga falló. Verifica que la URL sea válida y el video sea público.".to_string(),
        );
    }

    let mp3_file = std::fs::read_dir(&audio_dir)
        .map_err(|e| format!("Error leyendo directorio: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("mp3"))
        .max_by_key(|e| e.metadata().and_then(|m| m.modified()).ok())
        .ok_or("No se encontró el archivo de audio descargado.")?;

    let path = mp3_file.path().to_string_lossy().to_string();
    emit_progress(&app, "download", "Audio descargado correctamente.", Some(100.0));
    Ok(path)
}

#[tauri::command]
pub async fn transcribe_audio(
    app: AppHandle,
    audio_path: String,
    groq_api_key: String,
    language: Option<String>,
) -> Result<String, String> {
    emit_progress(&app, "transcribe", "Enviando audio a Groq Whisper...", None);

    let file_bytes = tokio::fs::read(&audio_path)
        .await
        .map_err(|e| format!("Error leyendo archivo de audio: {}", e))?;

    let file_size_mb = file_bytes.len() as f64 / 1_048_576.0;
    if file_size_mb > 25.0 {
        return Err(format!(
            "El archivo de audio ({:.1} MB) excede el límite de 25 MB de Groq. Prueba con un video más corto.",
            file_size_mb
        ));
    }

    let filename = PathBuf::from(&audio_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("audio.mp3")
        .to_string();

    let file_part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name(filename)
        .mime_str("audio/mpeg")
        .map_err(|e| format!("Error preparando archivo: {}", e))?;

    let mut form = reqwest::multipart::Form::new()
        .part("file", file_part)
        .text("model", "whisper-large-v3")
        .text("response_format", "text");

    if let Some(lang) = language {
        form = form.text("language", lang);
    }

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .bearer_auth(&groq_api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Error conectando con Groq: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let msg = if status.as_u16() == 401 {
            "API key de Groq inválida. Verifica tu configuración en Ajustes.".to_string()
        } else if status.as_u16() == 413 {
            "El archivo de audio es demasiado grande para Groq.".to_string()
        } else {
            format!("Error de Groq ({}): {}", status, body)
        };
        return Err(msg);
    }

    let transcript = response
        .text()
        .await
        .map_err(|e| format!("Error leyendo respuesta de Groq: {}", e))?;

    emit_progress(&app, "transcribe", "Transcripción completada.", Some(100.0));
    Ok(transcript.trim().to_string())
}

#[tauri::command]
pub async fn generate_summary(
    app: AppHandle,
    transcript: String,
    video_info: VideoInfo,
    anthropic_api_key: String,
    model: String,
    custom_prompt: String,
) -> Result<SummaryResult, String> {
    emit_progress(&app, "summarize", "Generando resumen con Claude...", None);

    let system_prompt = custom_prompt
        .replace("{{video_title}}", &video_info.title)
        .replace("{{channel}}", &video_info.channel)
        .replace("{{duration}}", &format_duration(video_info.duration))
        .replace("{{transcript}}", &transcript);

    let request_body = serde_json::json!({
        "model": model,
        "max_tokens": 4096,
        "system": system_prompt,
        "messages": [
            {
                "role": "user",
                "content": format!(
                    "Video: \"{}\"\nCanal: {}\nDuración: {}\n\nTranscripción:\n{}",
                    video_info.title,
                    video_info.channel,
                    format_duration(video_info.duration),
                    transcript
                )
            }
        ]
    });

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &anthropic_api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Error conectando con Anthropic: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let msg = if status.as_u16() == 401 {
            "API key de Anthropic inválida. Verifica tu configuración en Ajustes.".to_string()
        } else {
            format!("Error de Anthropic ({}): {}", status, body)
        };
        return Err(msg);
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Error parseando respuesta de Anthropic: {}", e))?;

    let summary = json["content"][0]["text"]
        .as_str()
        .ok_or("Respuesta inesperada de Anthropic")?
        .to_string();

    let input_tokens = json["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32;
    let output_tokens = json["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32;
    let total_tokens = input_tokens + output_tokens;
    let cost = calculate_claude_cost(&model, input_tokens, output_tokens);

    emit_progress(&app, "summarize", "Resumen generado correctamente.", Some(100.0));

    Ok(SummaryResult {
        summary,
        input_tokens,
        output_tokens,
        total_tokens,
        cost_usd: cost,
    })
}

#[tauri::command]
pub async fn send_to_notion(
    app: AppHandle,
    notion_api_key: String,
    parent_id: String,
    video_info: VideoInfo,
    summary: String,
    transcript: String,
) -> Result<String, String> {
    emit_progress(&app, "notion", "Enviando a Notion...", None);

    // Parse summary sections to map to database columns
    let resumen_text = {
        let puntos = parse_section(&summary, "Puntos Clave");
        let idea = parse_section(&summary, "Idea Central");
        let combined = if !idea.is_empty() && !puntos.is_empty() {
            format!("{}\n\n{}", idea, puntos)
        } else if !idea.is_empty() {
            idea
        } else {
            summary.clone()
        };
        truncate_notion(&combined, 2000)
    };

    let acciones_text = {
        let acciones = parse_section(&summary, "Ideas Accionables");
        truncate_notion(if acciones.is_empty() { &summary } else { &acciones }, 2000)
    };

    let keywords_text = {
        // Try to find a Keywords section; fall back to extracting from title words
        let kw = parse_section(&summary, "Keywords");
        if !kw.is_empty() {
            truncate_notion(&kw, 500)
        } else {
            // Generate basic keywords from video title words (>3 chars)
            let words: Vec<&str> = video_info.title
                .split_whitespace()
                .filter(|w| w.len() > 3)
                .take(6)
                .collect();
            words.join(", ")
        }
    };

    // Determine category: prefer Claude's classification from the summary,
    // fall back to simple keyword matching on title + first 500 chars of summary.
    let categoria = {
        let valid = ["Tutorial", "Entretenimiento", "Educativo", "Música",
                     "Deportes", "Tecnología", "Noticias", "Salud", "Otros"];
        let from_summary = parse_section(&summary, "Categoría");
        let found = valid.iter()
            .find(|&&v| from_summary.contains(v))
            .map(|&v| v.to_string());
        found.unwrap_or_else(|| {
            let text = format!(
                "{} {}",
                video_info.title,
                &summary[..summary.len().min(500)]
            ).to_lowercase();
            if text.contains("tutorial") || text.contains("cómo") || text.contains("paso a paso") || text.contains("aprende a") {
                "Tutorial"
            } else if text.contains("tecnolog") || text.contains("software") || text.contains("programaci") || text.contains("inteligencia artificial") {
                "Tecnología"
            } else if text.contains("música") || text.contains("musica") || text.contains("canción") || text.contains("song") {
                "Música"
            } else if text.contains("deport") || text.contains("fútbol") || text.contains("futbol") || text.contains("fitness") {
                "Deportes"
            } else if text.contains("salud") || text.contains("medicina") || text.contains("nutrici") {
                "Salud"
            } else if text.contains("noticia") || text.contains("política") || text.contains("politica") || text.contains("economía") {
                "Noticias"
            } else if text.contains("educaci") || text.contains("ciencia") || text.contains("historia") || text.contains("universidad") {
                "Educativo"
            } else if text.contains("entreteni") || text.contains("humor") || text.contains("vlog") || text.contains("comedy") {
                "Entretenimiento"
            } else {
                "Otros"
            }.to_string()
        })
    };

    let children = build_notion_blocks(&summary, &transcript);

    let mut properties = serde_json::json!({
        "Title": {
            "title": [{ "text": { "content": video_info.title } }]
        },
        "URL Video": {
            "url": video_info.url
        },
        "Canal YouTube": {
            "rich_text": [{ "text": { "content": video_info.channel } }]
        },
        "Resumen Video": {
            "rich_text": [{ "text": { "content": resumen_text } }]
        },
        "Acciones_Aplicación": {
            "rich_text": [{ "text": { "content": acciones_text } }]
        },
        "Keywords": {
            "rich_text": [{ "text": { "content": keywords_text } }]
        },
        "Categoría": {
            "select": { "name": categoria }
        }
    });

    // Only set date if yt-dlp provided one
    if let Some(date) = &video_info.upload_date {
        properties["Fecha Video"] = serde_json::json!({
            "date": { "start": date }
        });
    }

    let request_body = serde_json::json!({
        "parent": { "database_id": parent_id },
        "icon": { "type": "emoji", "emoji": "🎬" },
        "properties": properties,
        "children": children
    });

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.notion.com/v1/pages")
        .bearer_auth(&notion_api_key)
        .header("Notion-Version", "2022-06-28")
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Error conectando con Notion: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let msg = if status.as_u16() == 401 {
            "API key de Notion inválida.".to_string()
        } else if status.as_u16() == 404 {
            "Database ID no encontrado. Verifica que la base de datos está compartida con tu integración.".to_string()
        } else {
            format!("Error de Notion ({}): {}", status, body)
        };
        return Err(msg);
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Error parseando respuesta de Notion: {}", e))?;

    let page_url = json["url"].as_str().unwrap_or("").to_string();
    emit_progress(&app, "notion", "Entrada creada en Notion.", Some(100.0));
    Ok(page_url)
}

#[tauri::command]
pub async fn save_markdown(
    video_info: VideoInfo,
    summary: String,
    transcript: String,
    output_dir: String,
) -> Result<String, String> {
    let safe_title: String = video_info
        .title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' { c } else { '_' })
        .collect();
    let safe_title = safe_title.trim().replace(' ', "_");

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let filename = format!("{}_{}.md", safe_title, timestamp);

    let path = PathBuf::from(&output_dir).join(&filename);

    let content = format!(
        "# {}\n\n**Canal:** {}  \n**URL:** {}  \n**Duración:** {}  \n**Procesado:** {}\n\n---\n\n## Resumen\n\n{}\n\n---\n\n## Transcripción completa\n\n{}\n",
        video_info.title,
        video_info.channel,
        video_info.url,
        format_duration(video_info.duration),
        chrono::Local::now().format("%d/%m/%Y %H:%M"),
        summary,
        transcript
    );

    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("Error guardando archivo: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Error abriendo carpeta: {}", e))?;

    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Error abriendo carpeta: {}", e))?;

    #[cfg(target_os = "linux")]
    Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Error abriendo carpeta: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn check_dependencies() -> Result<DepsStatus, String> {
    let ytdlp = Command::new("yt-dlp")
        .arg("--version")
        .output()
        .await
        .map(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else {
                None
            }
        })
        .unwrap_or(None);

    let ffmpeg = Command::new("ffmpeg")
        .arg("-version")
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false);

    Ok(DepsStatus {
        ytdlp_version: ytdlp,
        ffmpeg_available: ffmpeg,
    })
}

#[tauri::command]
pub async fn get_default_output_dir() -> Result<String, String> {
    let home = dirs_next::document_dir()
        .or_else(|| dirs_next::home_dir())
        .unwrap_or_else(|| PathBuf::from("."));

    let output_dir = home.join("BiblioSophia");
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Error creando directorio de salida: {}", e))?;

    Ok(output_dir.to_string_lossy().to_string())
}
