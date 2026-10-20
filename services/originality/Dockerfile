FROM python:3.12-slim
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY originality ./originality
ENV PORT=8080
CMD ["sh", "-c", "uvicorn originality.app:app --host 0.0.0.0 --port ${PORT}"]
