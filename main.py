"""
Навигатор Знаний — Главная точка входа (Entry Point).
Инициализирует десктопное окно с использованием pywebview,
монтирует изолированное фронтенд-ядро (web/index.html) и
биндит Python-API для взаимодействия с LLM Engine, FGOS RAG и системными диалогами файлов.
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any

# Добавляем корневую директорию проекта в sys.path для корректных импортов
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import webview
from backend.api import AppApi

# Сохраняем псевдоним Api для обратной совместимости
Api = AppApi


def run_app():
    """Запуск оконного приложения pywebview."""
    html_file = (BASE_DIR / "web" / "index.html").resolve()
    if not html_file.exists():
        raise FileNotFoundError(f"Файл разметки не найден по пути: {html_file}")

    api = AppApi()
    debug_mode = os.environ.get("NAVIGATOR_DEBUG", "0").lower() in ("1", "true", "yes")

    # Создание нативного десктопного окна
    window = webview.create_window(
        title="Навигатор Знаний — Образовательный ИИ-помощник (ФГОС)",
        url=html_file.as_uri(),
        js_api=api,
        width=1080,
        height=760,
        min_size=(780, 560),
        background_color="#0F172A",
        text_select=True
    )

    # Старт цикла событий pywebview
    webview.start(debug=debug_mode)


if __name__ == "__main__":
    run_app()
