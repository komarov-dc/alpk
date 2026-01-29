# Alpaka Backend - PsyPro System

## Overview

Alpaka is the backend processing system for PsyPro - a psychological diagnostics and career guidance platform with AI-powered report generation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Alpaka Backend (:3000)                      │
├─────────────────────────────────────────────────────────────────┤
│  Admin Panel (/admin)                                           │
│  ├── Воркеры    - Worker status and management                  │
│  ├── Batch      - Batch upload for mass text processing         │
│  ├── Настройки  - System settings (secrets, API URLs)           │
│  └── Логи       - Execution logs viewer                         │
├─────────────────────────────────────────────────────────────────┤
│  API Endpoints                                                  │
│  ├── /api/admin/*        - Admin operations                     │
│  ├── /api/external/jobs  - Job queue (polled by workers)        │
│  ├── /api/internal/*     - Pipeline execution                   │
│  └── /api/projects/*     - Project/canvas management            │
├─────────────────────────────────────────────────────────────────┤
│  Workers (PM2)                                                  │
│  ├── Психодиагностика  - BigFive personality analysis           │
│  └── Профориентация    - Career guidance assessment             │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### Projects (Pipelines)

Each project contains a **canvas** with nodes that define the processing flow:
- **Trigger** - Entry point, receives questionnaire data
- **ModelProvider** - Configures LLM (Ollama, Yandex, OpenAI)
- **LLMChain** - Sends prompts to LLM, generates outputs
- **OutputSender** - Sends results back or saves to files

### Workers

Workers poll for jobs and execute pipelines:
- Poll `/api/external/jobs?status=queued` (frontend) every 10 seconds
- Also check local database for batch jobs
- Execute pipeline via `/api/internal/execute-flow`
- Support up to 5 concurrent jobs per worker

### Batch Processing (NEW - January 2026)

Headless mode for mass text processing without frontend:

```
/admin/batch
├── Upload .md files
├── Select project/pipeline
├── View preview of output structure
└── Start processing

Output structure:
/output/batch_2026-01-22_14-30_abc1/
├── respondent_001/
│   ├── adapted.md
│   ├── professional.md
│   └── scores.md
├── respondent_002/
│   └── ...
└── ...
```

## Database Schema

Key models:
- **Project** - Pipeline definition with canvasData (nodes/edges)
- **ProcessingJob** - Job queue entry
- **BatchUpload** - Batch upload metadata
- **ExecutionInstance** - Pipeline execution record
- **ExecutionLog** - Individual node execution logs

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Secrets (for API authentication)
ALPAKA_SHARED_SECRET=...
ALPAKA_INTERNAL_SECRET=...

# API URLs
EXTERNAL_API_BASE_URL=http://localhost:4000  # Frontend
INTERNAL_API_BASE_URL=http://localhost:3000  # Backend

# Worker Config (in ecosystem.config.js)
PROJECT_ID=cmivy6xz50140vtb10mfgqpdq
PROJECT_NAME=Психодиагностика
MODE_FILTER=PSYCHODIAGNOSTICS
POLL_INTERVAL=10000
MAX_CONCURRENT_JOBS=5
```

## Running the System

### Development (Mac)
```bash
# Start database
docker-compose up -d

# Start backend
npm run dev  # or npm run start

# Start workers
npx pm2 start ecosystem.config.js
```

### Production (Windows MGIMO)
```batch
START.bat
```

## Common Operations

### Check worker status
```bash
npx pm2 status
npx pm2 logs
```

### Restart workers
```bash
npx pm2 restart all
```

### View batch output
```bash
ls -la output/
```

## API Authentication

All admin APIs require `X-Alpaka-Internal-Secret` header.
External job APIs require `X-Backend-Secret` header.

## LLM Integration

Currently using **Ollama** on NVIDIA H200 GPU at MGIMO.
Supports: Ollama, LMStudio, OpenAI, Yandex Cloud.

Model is configured in the **ModelProvider** node on the canvas.
