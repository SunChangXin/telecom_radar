FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY telecom_radar ./telecom_radar
COPY config ./config
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .

CMD ["telecom-radar", "daemon", "--interval", "21600"]
