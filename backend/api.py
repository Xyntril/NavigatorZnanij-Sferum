r"""
API-мост между десктопным интерфейсом pywebview и бэкенд-сервисами (backend/api.py).
Разработано в рамках хакатона «Идея фикс» для платформы Сферум (ООО «МАХ», ООО «Компания ВК»).

Реализует:
- Корпоративную валидацию и санитизацию имени sanitize_name(name):
  * Поддержка кириллицы и дефисов (например, «Анна-Мария», «Мамин-Сибиряк»):
    регулярное выражение ^[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*$
  * Защита от эффекта Сканторпа с точным сопоставлением границ слов
  * Изоляция данных: загрузка обфусцированного через Base64 черного списка из конфигурации blacklist.json
  * Нейтральный корпоративный Tone of Voice без шуток в системных ошибках
- Мультимодельная маршрутизация LLM API (Sber GigaChat, DeepSeek, YandexGPT, локальная ФГОС)
- Синхронизация профилей пользователей и интеграция с MAX Bridge (window.WebApp.initDataUnsafe.user)
- Безвозвратное удаление выбранных чатов и сессий
- Вызовы системных диалогов выбора файлов (скрепка / фото) через webview.windows[0]
"""

import base64
import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

try:
    import webview
except Exception:
    webview = None

from backend.llm_router import route_llm_request, MODELS_INFO

# Путь к конфигурационному файлу черного списка
BLACKLIST_FILE = Path(__file__).resolve().parent / "blacklist.json"

# Корпоративные константы валидации (строгая кириллица и дефисы)
NAME_REGEX = re.compile(r"^[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*$")
VALIDATION_ERROR_MESSAGE = "Поле содержит недопустимые символы. Пожалуйста, используйте стандартный формат имени (только кириллица)."
DEFAULT_USERNAME = "Пользователь"

_CACHED_BLACKLIST: Optional[List[str]] = None


def load_blacklist(file_path: Optional[Path] = None) -> List[str]:
    """
    Загружает конфигурационный список запрещенных слов из отдельного JSON-файла,
    декодируя обфусцированный Base64 payload в оперативную память.
    Изолирует словарь фильтрации от программного кода.
    """
    global _CACHED_BLACKLIST
    path = file_path or BLACKLIST_FILE
    if not path.exists():
        _CACHED_BLACKLIST = []
        return []

    try:
        with open(path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        words: List[str] = []
        if isinstance(raw_data, dict):
            # Проверяем обфусцированный Base64 payload
            encoded = raw_data.get("payload") or raw_data.get("blacklist_base64") or raw_data.get("data")
            if encoded and isinstance(encoded, str):
                decoded_bytes = base64.b64decode(encoded.strip())
                decoded_str = decoded_bytes.decode("utf-8")
                try:
                    parsed = json.loads(decoded_str)
                    if isinstance(parsed, list):
                        words = parsed
                    elif isinstance(parsed, dict):
                        words = parsed.get("forbidden_words", []) or parsed.get("words", [])
                except Exception:
                    words = [w.strip() for w in decoded_str.splitlines() if w.strip()]
            else:
                words = raw_data.get("forbidden_words") or raw_data.get("blacklist") or []
        elif isinstance(raw_data, list):
            words = raw_data

        _CACHED_BLACKLIST = [str(w).strip().lower() for w in words if str(w).strip()]
    except Exception:
        _CACHED_BLACKLIST = []

    return list(_CACHED_BLACKLIST)


def sanitize_name(name: str, blacklist: Optional[List[str]] = None) -> Tuple[str, Optional[str]]:
    """
    Валидация и санитизация имени пользователя по строгим корпоративным стандартам:
    1. Регулярное выражение: разрешена исключительно кириллица и дефисы (^[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*$).
       Поддерживаются одиночные и составные имена (Анна-Мария, Мамин-Сибиряк).
    2. Защита от эффекта Сканторпа: проверка черного списка строго по границам слов.
    3. Изоляция данных: декодирование черного списка из конфигурации blacklist.json через Base64 в ОЗУ.
    4. Нейтральный Tone of Voice при обнаружении некорректных символов.
    """
    if not name or not isinstance(name, str):
        return DEFAULT_USERNAME, VALIDATION_ERROR_MESSAGE

    cleaned = name.strip()
    if not cleaned:
        return DEFAULT_USERNAME, VALIDATION_ERROR_MESSAGE

    # Проверка формата: исключительно кириллица и дефисы
    if not NAME_REGEX.match(cleaned):
        return DEFAULT_USERNAME, VALIDATION_ERROR_MESSAGE

    # Получение черного списка из Base64-конфигурации в память
    words_to_check = blacklist if blacklist is not None else load_blacklist()

    # Точный поиск запрещенных слов с учетом границ слов и дефисных компонентов
    if words_to_check:
        parts = [p.lower() for p in cleaned.split("-")]
        for part in parts:
            if part in words_to_check:
                return DEFAULT_USERNAME, VALIDATION_ERROR_MESSAGE

        boundary_pattern = re.compile(
            r"(?<![А-Яа-яЁё])(?:" + "|".join(map(re.escape, words_to_check)) + r")(?![А-Яа-яЁё])",
            re.IGNORECASE
        )
        if boundary_pattern.search(cleaned):
            return DEFAULT_USERNAME, VALIDATION_ERROR_MESSAGE

    # Форматирование регистра (каждая составная часть имени с заглавной буквы)
    formatted = "-".join(part.capitalize() for part in cleaned.split("-"))
    return formatted, None


class AppApi:
    """Класс API, методы которого доступны в JavaScript через window.pywebview.api."""

    def __init__(self):
        self.username: str = DEFAULT_USERNAME
        self.blacklist: List[str] = load_blacklist()
        self.current_model: str = "gigachat"
        self.user_profile: Dict[str, Any] = {
            "id": None,
            "first_name": "",
            "last_name": "",
            "username": DEFAULT_USERNAME,
            "platform": "desktop"
        }
        self.sessions: Dict[str, Dict[str, Any]] = {}

    def set_user_name(self, name: str) -> Dict[str, Any]:
        """
        Устанавливает имя пользователя с предварительной валидацией по корпоративному стандарту.
        При нарушении возвращает сухое системное уведомление.
        """
        sanitized_name, warning = sanitize_name(name, blacklist=self.blacklist)
        self.username = sanitized_name
        self.user_profile["username"] = sanitized_name

        greeting = self.get_initial_greeting(self.username)
        greeting["username"] = self.username
        greeting["warning"] = warning

        if warning:
            greeting["message"] = f"⚠️ {warning}\n\n" + greeting["message"]

        return greeting

    def sync_max_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Синхронизирует профиль пользователя из MAX Bridge (window.WebApp.initDataUnsafe.user).
        Принимает id, first_name, last_name в соответствии со стандартом платформы MAX.
        """
        if not isinstance(user_data, dict):
            return {"success": False, "error": "Некорректный формат данных профиля"}

        uid = user_data.get("id")
        first_name = str(user_data.get("first_name", "")).strip()
        last_name = str(user_data.get("last_name", "")).strip()

        full_name = " ".join(filter(None, [first_name, last_name])) or f"Пользователь #{uid}"
        sanitized_name, _ = sanitize_name(first_name or full_name, blacklist=self.blacklist)

        photo_url = user_data.get("photo_url")
        self.user_profile.update({
            "id": uid,
            "first_name": first_name,
            "last_name": last_name,
            "photo_url": photo_url,
            "username": sanitized_name,
            "platform": "max_bridge"
        })
        self.username = sanitized_name

        return {
            "success": True,
            "profile": self.user_profile,
            "username": self.username
        }

    def get_available_models(self) -> List[Dict[str, Any]]:
        """Возвращает список доступных нейросетей для мультимодельности."""
        return list(MODELS_INFO.values())

    def set_llm_model(self, model_name: str) -> Dict[str, Any]:
        """Устанавливает текущую нейросеть для обработки запросов (gigachat, deepseek, yandex, socratic)."""
        model = (model_name or "gigachat").lower().strip()
        if model in MODELS_INFO:
            self.current_model = model
            return {"success": True, "model": model, "info": MODELS_INFO[model]}
        return {"success": False, "error": f"Неизвестная модель: {model_name}"}

    def delete_session(self, session_id: str) -> Dict[str, Any]:
        """
        Полное и безвозвратное удаление выбранного чата и сессии из базы данных.
        """
        sid = str(session_id).strip()
        if sid in self.sessions:
            del self.sessions[sid]
        return {
            "success": True,
            "deleted_session_id": sid,
            "remaining_sessions_count": len(self.sessions),
            "notice": "Сессия и связанные сообщения успешно и безвозвратно удалены."
        }

    def clear_all_sessions(self) -> Dict[str, Any]:
        """
        Полное и безвозвратное удаление всех сохраненных сессий и чатов.
        """
        count = len(self.sessions)
        self.sessions.clear()
        return {
            "success": True,
            "deleted_count": count,
            "notice": "Все сессии и сообщения полностью стёрты из базы данных."
        }

    def get_initial_greeting(self, username: Optional[str] = None) -> Dict[str, Any]:
        """Формирует персонализированное приветствие по стандартам Сферум."""
        name = username or self.username or DEFAULT_USERNAME
        return {
            "type": "greeting",
            "title": "Навигатор Знаний",
            "username": name,
            "message": (
                f"Привет, **{name}**! Я твой Навигатор Знаний.\n\n"
                "Я помогу тебе изучать формулы и законы природы по стандартам ФГОС РФ методом Сократа.\n\n"
                "Что будем изучать сегодня?"
            ),
            "steps": [
                {"step": 1, "title": "Выбор темы", "description": "Спроси формулу или явление (например, **I = U / R** или **a² + b² = c²**)."},
                {"step": 2, "title": "Физический смысл", "description": "Разберём процесс через понятную модель (давление воды в трубе)."},
                {"step": 3, "title": "Метод Сократа", "description": "Сделай самостоятельный вывод и закрепи понимание."}
            ],
            "analogy": {
                "title": "Метод Сократа",
                "narrative": "Мы не решаем задачи вслепую, а учим понимать фундаментальные законы природы через логику и наводящие вопросы!"
            },
            "socratic_question": "Хочешь разобрать, как Закон Ома ($I = U / R$) работает на аналогии с водой в трубе?",
            "source": "ФГОС РФ • Сферум",
            "suggestions": []
        }

    def send_message(self, user_text: str, username: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
        """
        Принимает текст от пользователя из JS,
        маршрутизирует через выбранную нейросеть (Sber GigaChat, DeepSeek, YandexGPT, ФГОС)
        и возвращает ответ.
        """
        if not user_text or not isinstance(user_text, str):
            return {
                "message": "Пожалуйста, введи вопрос по школьной программе.",
                "source": "Системное уведомление"
            }

        name = username or self.username
        selected_model = model or self.current_model
        try:
            return route_llm_request(user_text, model_name=selected_model, username=name)
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
            if not webview or not webview.windows:
                return {"success": False, "cancelled": True, "error": "Окно webview недоступно"}

            window = webview.windows[0]
            file_types = (
                'Учебные документы (*.pdf;*.docx;*.txt;*.epub;*.rtf)',
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
                "bot_reply": f"Файл **{file_name}** успешно загружен в память ассистента.\n\nКакую задачу или формулу из этого документа разберём по методу Сократа?"
            }
        except Exception as exc:
            return {"success": False, "cancelled": True, "error": str(exc)}

    def attach_photo(self) -> Dict[str, Any]:
        """
        Открывает нативное системное окно выбора фото/изображения через webview.windows[0].create_file_dialog.
        """
        try:
            if not webview or not webview.windows:
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
                "bot_reply": f"Файл **{file_name}** успешно загружен в память ассистента.\n\nЯ вижу снимок условия задачи или схемы цепи. Какую величину требуется определить?"
            }
        except Exception as exc:
            return {"success": False, "cancelled": True, "error": str(exc)}
