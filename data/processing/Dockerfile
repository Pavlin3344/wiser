# One image per worker, selected at build time with --build-arg WORKER=<dir>.
# The four workers share a base and differ only in their requirements.txt and entrypoint.
FROM python:3.12-slim

ARG WORKER
ARG ENTRYPOINT_FILE=worker.py

# config.py resolves the repo root as parents[3] of its own path, so the directory
# depth below /app has to match the repository layout for that lookup to work.
WORKDIR /app/data/processing

# rasterio's bundled GDAL links against system libexpat, which the slim image omits;
# without it `import rasterio` dies with "libexpat.so.1: cannot open shared object file".
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*

COPY ${WORKER}/requirements.txt ./${WORKER}/requirements.txt
RUN pip install --no-cache-dir -r ./${WORKER}/requirements.txt

COPY ${WORKER}/ ./${WORKER}/

# Half the workers do not use the default worker.py - risk_zones has job.py, fuel has
# load_fuel.py, metrics has exporter.py - and every caller has to pass ENTRYPOINT_FILE for
# those. Three times now that was forgotten somewhere: the image built cleanly, was pushed,
# was deployed, and only then died on every start with "can't open file". data-metrics ran
# that way for weeks without anyone noticing, because a container restarting quietly looks
# a lot like a container running. Fail here instead, where the mistake is made.
RUN test -f "./${WORKER}/${ENTRYPOINT_FILE}" || { \
      echo "ENTRYPOINT_FILE=${ENTRYPOINT_FILE} does not exist in ${WORKER}/. Found:"; \
      ls -1 "./${WORKER}/"; \
      exit 1; \
    }

# Shared by every worker, unlike config.py which each one keeps its own copy of. The
# workers run as `python <worker>/<entrypoint>.py`, so sys.path[0] is the worker directory
# and a module one level up is not importable without help - hence PYTHONPATH below.
COPY log_shipper.py ./log_shipper.py

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/data/processing
ENV WORKER_DIR=${WORKER}
ENV WORKER_ENTRYPOINT=${ENTRYPOINT_FILE}

CMD ["sh", "-c", "python ${WORKER_DIR}/${WORKER_ENTRYPOINT}"]
