# Redis Job Queue

A distributed background job processing system built with **TypeScript, Node.js, Express, Redis, Docker, AWS EC2, Nginx, and GitHub Actions**.

The project demonstrates how asynchronous background jobs can be submitted through a REST API, prioritized in Redis, processed by workers, retried after failures, and moved to a Dead Letter Queue (DLQ) when all retry attempts are exhausted.

---

## Overview

The system separates **job submission** from **job execution**.

Instead of making an API request perform a potentially slow task directly, the API places the task into a Redis-backed queue. Background workers then consume and process those jobs asynchronously.

### Main capabilities

- Priority-based job scheduling
- Atomic job enqueueing using Redis Lua scripts
- Atomic worker job claiming
- Duplicate job prevention
- Multiple worker support
- Job state tracking
- Delayed jobs
- Automatic retries
- Exponential backoff
- Dead Letter Queue (DLQ)
- DLQ inspection and replay
- Graceful worker shutdown
- REST API for job management
- Dockerized services
- AWS EC2 deployment
- Nginx reverse proxy
- GitHub Actions CI/CD
- Persistent self-hosted GitHub Actions runner

---

# Architecture

```text
                         Internet
                            │
                            ▼
                    AWS Security Group
                         Port 80
                            │
                            ▼
                         Nginx
                    Reverse Proxy
                            │
                            ▼
                    Express REST API
                       Port 3000
                            │
                            ▼
                         Redis
                    ┌───────┴────────┐
                    │                │
                    ▼                ▼
             Priority Queue      Delayed Queue
             jobs:priority       jobs:delayed
                    │                │
                    └───────┬────────┘
                            │
                            ▼
                         Workers
                       Worker-A
                            │
                            ▼
                    Job State / DLQ

## License

This project is intended for educational and portfolio purposes.