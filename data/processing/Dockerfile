# One image per worker, selected at build time with --build-arg WORKER=<dir>.
# The four workers share a base and differ only in their requirements.txt and entrypoint.
FROM python:3.12-slim

ARG WORKER
ARG ENTRYPOINT_FILE=worker.py

# config.py resolves the repo root as parents[3] of its own path, so the directory
# depth below /app has to match the repository layout for that lookup to work.
WORKDIR /app/data/processing

COPY ${WORKER}/requirements.txt ./${WORKER}/requirements.txt
RUN pip install --no-cache-dir -r ./${WORKER}/requirements.txt

COPY ${WORKER}/ ./${WORKER}/

ENV PYTHONUNBUFFERED=1
ENV WORKER_DIR=${WORKER}
ENV WORKER_ENTRYPOINT=${ENTRYPOINT_FILE}

CMD ["sh", "-c", "python ${WORKER_DIR}/${WORKER_ENTRYPOINT}"]
