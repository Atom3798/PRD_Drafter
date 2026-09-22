# Convenience targets. Windows users without `make` can use ./dev.ps1 instead.
.PHONY: help setup dev dev-backend dev-frontend test lint check clean

PY := $(shell [ -x backend/.venv/Scripts/python.exe ] && echo backend/.venv/Scripts/python.exe || echo backend/.venv/bin/python)

help:
	@echo "setup         Install backend venv + frontend node_modules"
	@echo "dev           Run backend and frontend together"
	@echo "dev-backend   Run FastAPI only  (http://localhost:8000)"
	@echo "dev-frontend  Run Vite only     (http://localhost:5173)"
	@echo "test          Run pytest + vitest"
	@echo "lint          Run ruff + eslint + tsc"
	@echo "check         lint + test"

setup:
	cd backend && python -m venv .venv
	$(PY) -m pip install --upgrade pip
	$(PY) -m pip install -r backend/requirements.txt
	cd frontend && npm install
	@echo ""
	@echo "Next: copy backend/.env.example to backend/.env and"
	@echo "      frontend/.env.example to frontend/.env, then fill them in."

dev:
	@echo "Backend -> http://localhost:8000   Frontend -> http://localhost:5173"
	@trap 'kill 0' EXIT; \
	 (cd backend && ../$(PY) -m uvicorn app.main:app --reload --port 8000) & \
	 (cd frontend && npm run dev) & \
	 wait

dev-backend:
	cd backend && ../$(PY) -m uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

test:
	cd backend && ../$(PY) -m pytest
	cd frontend && npm run test

lint:
	$(PY) -m ruff check backend
	cd frontend && npm run lint && npm run type-check

check: lint test

clean:
	rm -rf backend/.venv frontend/node_modules frontend/dist
