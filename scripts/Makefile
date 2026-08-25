PYTHON ?= python3
VENV ?= .venv
ACTIVATE := $(VENV)/bin/activate
PY := $(VENV)/bin/python

REMOTE_USER_ID ?=

.PHONY: install seed-db clone-user-data

install:
	@if [ -d $(VENV) ] && $(PY) -m pip show asyncpg > /dev/null 2>&1; then \
		echo "Virtual environment already set up, skipping install."; \
	else \
		echo "Creating scripts virtual environment..."; \
		test -d $(VENV) || $(PYTHON) -m venv $(VENV); \
		$(PY) -m pip install --quiet --upgrade pip; \
		$(PY) -m pip install --quiet -r requirements.txt; \
	fi

seed-db: install
	@. $(ACTIVATE) && $(PY) seed_db.py $(if $(REMOTE_USER_ID),--remote-user-id "$(REMOTE_USER_ID)",)

clone-user-data: install
	@. $(ACTIVATE) && $(PY) clone_user_data.py $(if $(REMOTE_USER_ID),--remote-user-id "$(REMOTE_USER_ID)",)
