# Qwen 2.5 7B local AI release report

Release candidate date: 2026-07-20  
Branch: `feature/p2-qwen-7b-production`

## Target machine

| Resource | Detected capacity |
| --- | --- |
| CPU | Intel Core i5-12400F, 6 cores / 12 threads |
| Host memory | 32 GB |
| Docker memory | approximately 16 GB |
| GPU | NVIDIA GeForce RTX 3060, 12 GB VRAM |

## Runtime configuration

- Model: Qwen2.5 7B Instruct, GGUF Q4_K_M (approximately 4.7 GB).
- Runtime: llama.cpp CUDA server with the model fully offloaded (`--n-gpu-layers 99`).
- Context: 4096 tokens; batch: 512; CPU threads: 6; flash attention enabled.
- Local endpoint is bound to `127.0.0.1:8081`; the Cloudflare relay forwards directly to it.
- API and worker identify the deployed model as `qwen2.5:7b`.
- Observed GPU memory while serving: approximately 6.1 GB, leaving headroom on the 12 GB card.
- Ollama is not started alongside this server, avoiding duplicate model residency in VRAM.

## Measured result

| Gate | Result |
| --- | --- |
| llama.cpp generation throughput | approximately 55.9–58 tokens/second |
| Previous 3B CPU throughput | approximately 12–15 tokens/second |
| Backend unit/integration tests | 474/474 passed across 65 files |
| Backend statement coverage | 87.05% |
| Full Chromium E2E | 57/57 passed in 7 minutes 30 seconds |
| Backend/frontend/infra production build | passed |
| Runtime dependency audit | 0 known vulnerabilities in all three packages |
| Infrastructure tests | 2/2 passed, including Lambda bundling |

The browser suite covers authentication and session handling, profile management,
PDF upload/list/search/delete, RAG chat and citations, multi-turn history, full and
chapter summaries, quiz generation, exam generation and automatic grading, Tutor,
cross-user isolation, safe rendering of AI output, and responsive layouts.

## Release safeguards

Promotion must follow `feature → develop → staging → main`. Production deployment
must use the exact merged `main` commit. After deployment, verify the Lambda model
environment, relay health, authenticated AI flows, CloudWatch errors, and DLQ depth.
