FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py admin.html ./
# Runs unprivileged. The data directory is a bind mount; the host side is
# chowned to this uid by deploy (see the skill's deploy-container.sh).
RUN useradd -u 10002 -m app && mkdir -p /data && chown -R app:app /data /app
USER app
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
