# Само стандартната библиотека - никакъв requirements.txt. Azure SDK-тата теглят
# десетина пакета, за да направят два HTTP-а: един token endpoint и един query endpoint.
FROM python:3.12-slim

WORKDIR /app
COPY bridge.py /app/bridge.py

# Маркерът (докъде е стигнал преносът) живее тук и е на volume. Без него всеки
# рестарт започва от студен старт и препраща същия половин час наново.
RUN mkdir -p /state

# Небуфериран stdout: иначе редовете на самия мост седят в буфера и filebeat ги вижда
# на порции от 8 KB - тоест диагностиката на моста е последното, което би стигнало
# навреме до ELK, ако нещо не е наред точно с него.
ENV PYTHONUNBUFFERED=1

ENTRYPOINT ["python", "/app/bridge.py"]
