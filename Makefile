# Linux/macOS/CI. No Windows usar .\tasks.ps1
API := cd apps/api &&

.PHONY: setup up up-docker test lint migrate gen-client
setup:
	python3 -m venv apps/api/.venv
	$(API) .venv/bin/pip install -r requirements-dev.txt && .venv/bin/python manage.py migrate
	npm install
up:
	$(API) .venv/bin/python manage.py migrate
	$(API) .venv/bin/python manage.py runserver 8000 & npm run dev:web
up-docker:
	docker compose -f infra/docker-compose.yml up --build
test:
	$(API) .venv/bin/python -m pytest -q
lint:
	$(API) .venv/bin/ruff check . && .venv/bin/ruff format --check .
	npm run lint:web && npm run typecheck -w apps/web
migrate:
	$(API) .venv/bin/python manage.py migrate
gen-client:
	$(API) .venv/bin/python manage.py spectacular --file ../../packages/api-client/openapi.yaml
	npm run gen:client
