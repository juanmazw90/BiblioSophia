# BiblioSophia — Guía de uso completa

BiblioSophia es una app de escritorio que transcribe y resume videos de YouTube usando IA, y opcionalmente guarda los resultados en Notion.

---

## Índice

1. [Requisitos del sistema](#1-requisitos-del-sistema)
2. [Instalación de dependencias](#2-instalación-de-dependencias)
3. [API Keys necesarias](#3-api-keys-necesarias)
4. [Configuración inicial en la app](#4-configuración-inicial-en-la-app)
5. [Cómo usar la app](#5-cómo-usar-la-app)
6. [Integración con Notion (opcional)](#6-integración-con-notion-opcional)
7. [Costos estimados](#7-costos-estimados)
8. [Solución de problemas](#8-solución-de-problemas)

---

## 1. Requisitos del sistema

| Requisito | Mínimo |
|---|---|
| Sistema operativo | Windows 10 (v1809+) o Windows 11 |
| RAM | 4 GB |
| Espacio en disco | 500 MB libres |
| Conexión a internet | Requerida (para APIs y descarga de audio) |

> **Nota:** La app no procesa nada localmente salvo la descarga del audio. La transcripción y el resumen se envían a servicios externos (Groq y Anthropic).

---

## 2. Instalación de dependencias

La app necesita dos herramientas del sistema: **yt-dlp** (descarga el audio de YouTube) y **FFmpeg** (convierte el audio a MP3).

### Opción A — Automática (recomendada)

1. Ejecutar `instalar-dependencias.bat` con doble clic.
2. Si Windows muestra una advertencia de SmartScreen → clic en **"Más información"** → **"Ejecutar de todas formas"**.
3. Esperar a que el script termine. Muestra `[OK]` junto a cada herramienta instalada.
4. **Reiniciar el PC** al terminar para que los cambios de PATH surtan efecto.

### Opción B — Manual

**yt-dlp:**
```
winget install --id yt-dlp.yt-dlp
```
O descarga el `.exe` desde: https://github.com/yt-dlp/yt-dlp/releases/latest

**FFmpeg:**
```
winget install --id Gyan.FFmpeg
```
O descarga desde: https://ffmpeg.org/download.html (sección Windows → "ffmpeg-release-essentials.zip")

Tras la instalación manual de FFmpeg, agregar la carpeta `bin\` al PATH del sistema:
- Buscar "Variables de entorno" en el menú Inicio
- Editar la variable `Path` del sistema
- Agregar la ruta completa a la carpeta `bin` de FFmpeg (ej: `C:\ffmpeg\bin`)

---

## 3. API Keys necesarias

### 3.1 Groq API Key — Transcripción de audio (GRATIS)

Groq ofrece Whisper como API gratuita con límites generosos.

**Pasos:**
1. Ir a https://console.groq.com
2. Crear una cuenta (puede usarse Google o GitHub para registrarse)
3. En el menú lateral → **"API Keys"**
4. Clic en **"Create API Key"**
5. Darle un nombre (ej: `BiblioSophia`) y copiar la key generada

La key tiene el formato: `gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

> **Límites gratuitos de Groq Whisper:**
> - ~28 horas de audio por día
> - Archivos de hasta 25 MB por petición (≈ videos de hasta ~45 min)

---

### 3.2 Anthropic API Key — Generación de resúmenes (DE PAGO)

Anthropic cobra por tokens procesados. Los costos son bajos para uso personal.

**Pasos:**
1. Ir a https://console.anthropic.com
2. Crear una cuenta
3. En el menú lateral → **"API Keys"**
4. Clic en **"Create Key"**
5. Copiar la key generada

La key tiene el formato: `sk-ant-api03-xxxxxxxxxxxxxxxxxxxx`

**Antes de usar la key:**
- Ir a **"Billing"** en la consola de Anthropic
- Agregar un método de pago
- Se recomienda cargar un mínimo de **$5 USD** para empezar

> Consultar la sección [Costos estimados](#7-costos-estimados) para saber cuánto consume cada video.

---

### 3.3 Notion API Key — Guardar en base de datos (OPCIONAL)

Solo necesaria si se quiere guardar los resultados automáticamente en Notion.

**Pasos para crear la integración:**
1. Ir a https://www.notion.so/my-integrations
2. Clic en **"+ New integration"**
3. Nombre: `BiblioSophia`
4. Permisos necesarios: marcar **"Read content"**, **"Update content"**, **"Insert content"**
5. Clic en **"Submit"**
6. Copiar el **"Internal Integration Secret"**

La key tiene el formato: `secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**Obtener el Database ID de Notion:**
1. Abrir la base de datos en Notion (debe ser tipo `Database`, no una página normal)
2. Copiar la URL del navegador. Tiene este formato:
   ```
   https://www.notion.so/WORKSPACE/DATABASE_ID?v=VIEW_ID
   ```
3. El **Database ID** es el fragmento entre la última `/` y el `?v=`
   - Ejemplo de URL: `https://www.notion.so/miworkspace/1f4248f7ace6800587d8f76c9eef9c43?v=...`
   - Database ID: `1f4248f7ace6800587d8f76c9eef9c43`

**Conectar la integración a la base de datos:**
1. Abrir la base de datos en Notion
2. Clic en los tres puntos `···` (esquina superior derecha)
3. **"Connections"** → buscar y seleccionar `BiblioSophia`
4. Confirmar el acceso

**Columnas requeridas en la base de datos:**

La app escribe en estas columnas específicas. Deben existir con estos nombres y tipos exactos:

| Nombre de columna | Tipo en Notion |
|---|---|
| `Title` | Título (columna principal) |
| `URL Video` | URL |
| `Canal YouTube` | Texto |
| `Fecha Video` | Fecha |
| `Categoría` | Select |
| `Resumen Video` | Texto |
| `Acciones_Aplicación` | Texto |
| `Keywords` | Texto |

Para la columna **Categoría**, agregar estas opciones al campo Select:
`Tutorial`, `Entretenimiento`, `Educativo`, `Música`, `Deportes`, `Tecnología`, `Noticias`, `Salud`, `Otros`

> Las columnas que no existan en la base de datos serán ignoradas sin generar error.

---

## 4. Configuración inicial en la app

1. Abrir `bibliosphia.exe`
2. En la barra lateral izquierda, clic en **"Ajustes"**
3. Completar los campos:

### Sección: API Keys

| Campo | Valor |
|---|---|
| **Groq API Key** | La key obtenida en el paso 3.1 |
| **Anthropic API Key** | La key obtenida en el paso 3.2 |
| **Notion API Key** *(opcional)* | La key obtenida en el paso 3.3 |
| **Database ID** *(opcional)* | El ID de tu base de datos de Notion |

### Sección: Modelo de IA

Seleccionar el modelo de Claude a usar para los resúmenes:

| Modelo | Velocidad | Costo | Recomendado para |
|---|---|---|---|
| **Claude Sonnet 4.6** | Media | Medio | Uso general — mejor equilibrio |
| Claude Haiku 4.5 | Rápido | Bajo | Muchos videos, resúmenes simples |
| Claude Sonnet 4.5 | Media | Medio | Alternativa a Sonnet 4.6 |
| Claude Opus 4.6 | Lento | Alto | Análisis muy detallados |

### Sección: Transcripción

- **Idioma del audio:** Seleccionar el idioma principal del video, o dejar en "Auto-detectar"
- Auto-detectar funciona bien en la mayoría de los casos

### Sección: Destinos de guardado

| Opción | Descripción |
|---|---|
| **Guardar localmente (.md)** | Crea un archivo Markdown por cada video procesado |
| **Carpeta de destino** | Elegir dónde se guardarán los archivos |
| **Enviar a Notion** | Activa el guardado automático en tu base de datos de Notion |

4. Clic en **"Guardar cambios"** (esquina superior derecha de Ajustes)

---

## 5. Cómo usar la app

1. Ir a la pestaña **"Procesar"** (ícono de libro en la barra lateral)
2. Pegar la URL de un video de YouTube en el campo de texto
   - Formatos válidos:
     - `https://www.youtube.com/watch?v=XXXXXXXXXXX`
     - `https://youtu.be/XXXXXXXXXXX`
     - `https://www.youtube.com/shorts/XXXXXXXXXXX`
3. Clic en el botón **"Procesar"**

### Etapas del procesamiento

| Etapa | Qué hace | Duración aprox. |
|---|---|---|
| Obteniendo info | Consulta metadatos del video | 2-5 seg |
| Descargando | Descarga el audio en MP3 | 10-60 seg (según duración) |
| Transcribiendo | Envía el audio a Groq Whisper | 10-30 seg |
| Resumiendo | Genera el resumen con Claude | 10-20 seg |
| Guardando | Guarda localmente y/o en Notion | 2-5 seg |

4. Al terminar, la app cambia automáticamente a la pestaña **"Resultado"**
5. En Resultado se puede:
   - Leer el resumen formateado
   - Ver la transcripción completa
   - Copiar el contenido al portapapeles
   - Abrir la página de Notion (si se guardó)
   - Abrir la carpeta local (si se guardó localmente)

---

## 6. Integración con Notion (opcional)

Una vez configurada, la app crea automáticamente una entrada en tu base de datos con:

- **Título** del video
- **URL** del video
- **Canal de YouTube**
- **Fecha de publicación** del video
- **Categoría** clasificada automáticamente por IA
- **Resumen** (idea central + puntos clave)
- **Acciones aplicables**
- **Keywords**
- **Transcripción completa** (colapsada dentro de la página)

La categoría se asigna automáticamente entre: `Tutorial`, `Entretenimiento`, `Educativo`, `Música`, `Deportes`, `Tecnología`, `Noticias`, `Salud`, `Otros`.

---

## 7. Costos estimados

### Groq (transcripción)
**Gratis** dentro de los límites del plan gratuito (~28 h de audio/día).

### Anthropic (resúmenes con Claude)

El costo depende del modelo y la duración del video (más largo = más tokens en la transcripción):

| Video | Tokens aprox. | Sonnet 4.6 | Haiku 4.5 |
|---|---|---|---|
| 10 min | ~8.000 | ~$0.02 | ~$0.007 |
| 30 min | ~20.000 | ~$0.05 | ~$0.016 |
| 60 min | ~40.000 | ~$0.10 | ~$0.032 |

> Con $5 USD en Anthropic se pueden procesar aproximadamente:
> - ~250 videos de 30 min con Sonnet 4.6
> - ~800 videos de 30 min con Haiku 4.5

El Dashboard de la app muestra el consumo total acumulado.

---

## 8. Solución de problemas

### "yt-dlp no encontrado" al abrir la app
- Ejecutar `instalar-dependencias.bat` y reiniciar el PC
- Verificar en una terminal: `yt-dlp --version`

### "FFmpeg no encontrado"
- Ejecutar `instalar-dependencias.bat` y reiniciar el PC
- Verificar en una terminal: `ffmpeg -version`

### Error en transcripción: "API key de Groq inválida"
- Verificar que la Groq API Key esté copiada correctamente en Ajustes
- Asegurarse de que la key empieza con `gsk_`
- Comprobar que la cuenta de Groq está activa en console.groq.com

### Error en resumen: "Error de Anthropic (401)"
- La API key de Anthropic es inválida o expiró
- Generar una nueva key en console.anthropic.com

### Error en resumen: "Error de Anthropic (402 / 529)"
- Saldo insuficiente en la cuenta de Anthropic
- Agregar crédito en console.anthropic.com → Billing

### "El archivo de audio excede el límite de 25 MB"
- El video es demasiado largo (más de ~45 min en MP3)
- Groq Whisper tiene un límite de 25 MB por archivo
- Procesar videos de menos de 45 minutos de duración

### Notion: "Database ID no encontrado"
- Verificar que la integración está conectada a la base de datos (paso 3.3)
- Comprobar que el Database ID es correcto (solo el ID, no la URL completa)
- El ID debe tener 32 caracteres hexadecimales (sin guiones)

### Notion: error en propiedades
- Verificar que los nombres de las columnas coinciden exactamente con los de la tabla del paso 3.3
- Los nombres son sensibles a mayúsculas y tildes

### La app no abre / se cierra inmediatamente
- Verificar que el PC tiene conexión a internet
- En algunos PCs con antivirus agresivo, agregar `bibliosphia.exe` a la lista de excepciones

---

*BiblioSophia v0.1.0*
