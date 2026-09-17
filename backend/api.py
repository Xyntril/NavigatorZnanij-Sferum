r"""
API-мост между десктопным интерфейсом pywebview и бэкенд-сервисами (backend/api.py).
Реализует:
- Корпоративную валидацию имени sanitize_name(name):
  * Поддержка кириллицы и дефисов (например, «Анна-Мария», «Мамин-Сибиряк»):
    регулярное выражение ^[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*$
  * Защита от эффекта Сканторпа с точным сопоставлением границ слов (\b)
  * Изоляция данных: загрузка черного списка из конфигурации blacklist.json без открытого хардкода
  * Нейтральный корпоративный Tone of Voice без упоминания ФГОС и шуток в системных ошибках
- Обработка приветствий и сессий диалога
- Вызовы системных диалогов выбора файлов (скрепка / фото) через webview.windows[0]
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import webview

from backend.llm_engine import generate_llm_response

# Путь к конфигурационному файлу черного списка
BLACKLIST_FILE = Path(__file__).resolve().parent / "blacklist.json"

# Корпоративные константы валидации
NAME_REGEX = re.compile(r"^[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*$")
VALIDATION_ERROR_MESSAGE = "Поле содержит недопустимые символы. Пожалуйста, используйте стандартный формат имени."
DEFAULT_USERNAME = "Пользователь"

_CACHED_BLACKLIST: Optional[List[str]] = None


def load_blacklist(file_path: Optional[Path] = None) -> List[str]:
    """
    Загружает конфигурационный список запрещенных слов из отдельного JSON-файла.
    Изолирует словарь фильтрации от программного кода.
    """
    global _CACHED_BLACKLIST
    path = file_path or BLACKLIST_FILE
    if not path.exists():
        _CACHED_BLACKLIST = []
        return []

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                _CACHED_BLACKLIST = [str(w).strip().lower() for w in data if str(w).strip()]
            elif isinstance(data, dict):
                words = data.get("forbidden_words") or data.get("blacklist") or []
                _CACHED_BLACKLIST = [str(w).strip().lower() for w in words if str(w).strip()]
            else:
                _CACHED_BLACKLIST = []
    except Exception:
        _CACHED_BLACKLIST = []

    return list(_CACHED_BLACKLIST)


def sanitize_name(name: str, blacklist: Optional[List[str]] = None) -> Tuple[str, Optional[str]]:
    """
    Валидация и санитизация имени пользователя по строгим корпоративным стандартам:
    1. Регулярное выражение: разрешена только кириллица и дефисы (^[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*$).
       Поддерживаются одиночные и составные имена (Анна-Мария, Мамин-Сибиряк).
    2. Защита от эффекта Сканторпа: проверка черного списка строго по границам слов (\b).
       Корень «база» не блокирует «Базаров», а корень «пон» не ломает «Пономарев».
    3. Изоляция данных: отсутствие грязных данных в открытом виде в коде.
    4. Нейтральный Tone of Voice: при ошибке возвращается нейтральное системное уведомление.
    """
    if not name or not isinstance(name, str):
        return DEFAULT_USERNAME, VALIDATION_ERROR_MESSAGE

    cleaned = name.strip()
    if not cleaned:
        return DEFAULT_USERNAME, VALIDATION_ERROR_MESSAGE

    # Проверка формата: кириллица и дефисы
    if not NAME_REGEX.match(cleaned):
        return DEFAULT_USERNAME, VALIDATION_ERROR_MESSAGE

    # Получение черного списка
    words_to_check = blacklist if blacklist is not None else load_blacklist()

    # Точный поиск запрещенных слов с учетом границ слов (\b)
    if words_to_check:
        boundary_pattern = re.compile(
            r"\b(?:" + "|".join(map(re.escape, words_to_check)) + r")\b",
            re.IGNORECASE
        )
        if boundary_pattern.search(cleaned):
            return DEFAULT_USERNAME, VALIDATION_ERROR_MESSAGE

    # Форматирование регистра (каждая часть составного имени с заглавной буквы)
    formatted = "-".join(part.capitalize() for part in cleaned.split("-"))
    return formatted, None


class AppApi:
    """Класс API, методы которого доступны в JavaScript через window.pywebview.api."""

    def __init__(self):
        self.username: str = DEFAULT_USERNAME
        self.blacklist: List[str] = load_blacklist()

    def set_user_name(self, name: str) -> Dict[str, Any]:
        """
        Устанавливает имя пользователя с предварительной валидацией по корпоративному стандарту.
        При нарушении возвращает сухое системное уведомление.
        """
        sanitized_name, warning = sanitize_name(name, blacklist=self.blacklist)
        self.username = sanitized_name

        greeting = self.get_initial_greeting(self.username)
        greeting["username"] = self.username
        greeting["warning"] = warning

        if warning:
            greeting["message"] = f"⚠️ {warning}\n\n" + greeting["message"]

        return greeting

    def get_initial_greeting(self, username: Optional[str] = None) -> Dict[str, Any]:
        """Формирует персонализированное приветствие."""
        name = username or self.username or DEFAULT_USERNAME
        return {
            "type": "greeting",
            "title": "Навигатор Знаний",
            "username": name,
            "message": (
                f"Привет, **{name}**! Я твой Навигатор Знаний.\n\n"
                "Мои знания **абсолютно свободны**, и эта программа полностью "
                "уважает твои **цифровые права и свободы** (GNU GPLv3).\n\n"
                "Что будем изучать по программе ФГОС?"
            ),
            "steps": [
                {"step": 1, "title": "Свобода темы", "description": "Спроси формулу или явление (например, **I = U / R** или **a² + b² = c²**)."},
                {"step": 2, "title": "Физический смысл", "description": "Разберём процесс через понятную модель (давление воды в трубе)."},
                {"step": 3, "title": "Метод Сократа", "description": "Сделай самостоятельный вывод и закрепи понимание."}
            ],
            "analogy": {
                "title": "Метод Сократа",
                "narrative": "Мы не решаем задачи вслепую, а учим понимать фундаментальные законы природы через логику и наводящие вопросы!"
            },
            "socratic_question": "Хочешь разобрать, как Закон Ома ($I = U / R$) работает на аналогии с водой в трубе?",
            "source": "ФГОС РФ • GNU GPLv3",
            "suggestions": []
        }

    def send_message(self, user_text: str, username: Optional[str] = None) -> Dict[str, Any]:
        """
        Принимает текст от пользователя из JS,
        пропускает через LLM-движок и возвращает ответ.
        """
        if not user_text or not isinstance(user_text, str):
            return {
                "message": "Пожалуйста, введи вопрос по школьной программе.",
                "source": "Системное уведомление"
            }

        name = username or self.username
        try:
            return generate_llm_response(user_text, username=name)
        except Exception as exc:
            return {
                "message": f"Произошла ошибка при обработке запроса: {str(exc)}",
                "source": "Системная ошибка"
            }

    def attach_document(self) -> Dict[str, Any]:
        """
        Открывает нативное системное окно выбора документа через webview.windows[0].create_file_dialog.
        """
        try:
            if not webview.windows:
                return {"success": False, "cancelled": True, "error": "Окно webview недоступно"}

            window = webview.windows[0]
            file_types = (
                'Документы (*.pdf;*.docx;*.doc;*.txt;*.rtf;*.odt;*.epub)',
                'Все файлы (*.*)'
            )
            result = window.create_file_dialog(
                dialog_type=webview.OPEN_DIALOG,
                allow_multiple=False,
                file_types=file_types
            )

            if not result:
                return {"success": False, "cancelled": True}

            file_path = result[0] if isinstance(result, (list, tuple)) else result
            file_name = os.path.basename(file_path)
            file_size_kb = round(os.path.getsize(file_path) / 1024, 1) if os.path.exists(file_path) else 0

            return {
                "success": True,
                "cancelled": False,
                "type": "document",
                "filename": file_name,
                "filepath": file_path,
                "filesize": f"{file_size_kb} КБ",
                "bot_reply": f"Файл **{file_name}** успешно загружен в мою свободную память.\n\nКакую задачу или формулу из этого документа разберём по методу Сократа?"
            }
        except Exception as exc:
            return {"success": False, "cancelled": True, "error": str(exc)}

    def attach_photo(self) -> Dict[str, Any]:
        """
        Открывает нативное системное окно выбора фото/изображения через webview.windows[0].create_file_dialog.
        """
        try:
            if not webview.windows:
                return {"success": False, "cancelled": True, "error": "Окно webview недоступно"}

            window = webview.windows[0]
            file_types = (
                'Изображения (*.png;*.jpg;*.jpeg;*.webp;*.bmp;*.gif)',
                'Все файлы (*.*)'
            )
            result = window.create_file_dialog(
                dialog_type=webview.OPEN_DIALOG,
                allow_multiple=False,
                file_types=file_types
            )

            if not result:
                return {"success": False, "cancelled": True}

            file_path = result[0] if isinstance(result, (list, tuple)) else result
            file_name = os.path.basename(file_path)
            file_size_kb = round(os.path.getsize(file_path) / 1024, 1) if os.path.exists(file_path) else 0

            return {
                "success": True,
                "cancelled": False,
                "type": "photo",
                "filename": file_name,
                "filepath": file_path,
                "filesize": f"{file_size_kb} КБ",
                "bot_reply": f"Файл **{file_name}** успешно загружен в мою свободную память.\n\nЯ вижу снимок условия задачи или схемы цепи. Какую величину требуется определить?"
            }
        except Exception as exc:
            return {"success": False, "cancelled": True, "error": str(exc)}
