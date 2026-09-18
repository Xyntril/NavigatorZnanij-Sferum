# ==============================================================================
# Dockerfile — Образ сервиса «Навигатор Знаний»
# Хакатон «Идея фикс» платформы Сферум (Направление: «Продвинутая разработка»)
# ==============================================================================

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:99 \
    QT_QPA_PLATFORM=offscreen

WORKDIR /app

# Установка системных библиотек для поддержки GUI, Qt и виртуального дисплея Xvfb
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    x11-utils \
    libgl1 \
    libegl1 \
    libglib2.0-0 \
    libdbus-1-3 \
    libxkbcommon-x11-0 \
    libfontconfig1 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Копирование и установка Python-зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Копирование кодовой базы проекта
COPY backend/ ./backend/
COPY web/ ./web/
COPY main.py .
COPY linux/ ./linux/

# Верификация синтаксиса модулей
RUN python3 -m py_compile main.py backend/api.py backend/llm_engine.py backend/llm_router.py

# Запуск приложения через виртуальный X-сервер Xvfb
CMD ["xvfb-run", "-a", "python3", "main.py"]
