r"""
Маршрутизатор мультимодельных запросов к LLM (backend/llm_router.py)
Разработано для платформы «Сферум» в рамках хакатона «Идея фикс» (ООО «МАХ»).

Поддерживаемые провайдеры:
1. Sber GigaChat (GIGACHAT_CREDENTIALS, verify=False для обхода корпоративных SSL-сертификатов Сбера)
2. DeepSeek API (DEEPSEEK_API_KEY)
3. YandexGPT (Алиса / Yandex Cloud: YANDEX_API_KEY, YANDEX_FOLDER_ID)
4. Встроенная Сократовская RAG-модель ФГОС РФ (Автономный локальный режим)
"""

import os
import uuid
from pathlib import Path
from typing import Dict, Any, Optional

import urllib3
import requests

# Отключаем предупреждения об InsecureRequestWarning при verify=False для GigaChat
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Загрузка переменных окружения из .env
def load_env_file():
    """Считывает файл .env в корень проекта, если он существует."""
    current = Path(__file__).resolve().parent
    env_paths = [
        current.parent / ".env",
        Path.cwd() / ".env",
        current / ".env"
    ]
    for env_path in env_paths:
        if env_path.exists():
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            key, val = line.split("=", 1)
                            key = key.strip()
                            val = val.strip().strip('"').strip("'")
                            if key and key not in os.environ:
                                os.environ[key] = val
            except Exception:
                pass
            break

load_env_file()

MODELS_INFO = {
    "gigachat": {
        "id": "gigachat",
        "name": "Sber GigaChat",
        "env_key": "GIGACHAT_CREDENTIALS",
        "description": "Нейросеть Сбера, адаптированная для российских образовательных задач."
    },
    "deepseek": {
        "id": "deepseek",
        "name": "DeepSeek API",
        "env_key": "DEEPSEEK_API_KEY",
        "description": "Передовая рассуждающая модель для решения сложных научных и математических задач."
    },
    "yandex": {
        "id": "yandex",
        "name": "YandexGPT (Алиса)",
        "env_key": "YANDEX_API_KEY",
        "description": "Языковая модель Яндекса для генерации связных и понятных учебных объяснений."
    },
    "socratic": {
        "id": "socratic",
        "name": "Встроенная ФГОС (Локальная)",
        "env_key": None,
        "description": "Автономная диалоговая база знаний по стандартам ФГОС РФ (работает без интернета)."
    }
}


def query_gigachat(prompt: str, credentials: Optional[str] = None) -> Dict[str, Any]:
    """
    Отправляет запрос к Sber GigaChat API.
    Обязательно использует verify=False для обхода валидации SSL-сертификатов Минцифры РФ.
    """
    creds = credentials or os.getenv("GIGACHAT_CREDENTIALS", "").strip()
    if not creds:
        return {
            "success": False,
            "error": "GIGACHAT_CREDENTIALS не указан в файле .env"
        }

    # 1. Получение OAuth-токена доступа
    auth_url = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    rq_uid = str(uuid.uuid4())
    headers = {
        "Authorization": f"Basic {creds}",
        "RqUID": rq_uid,
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {"scope": "GIGACHAT_API_PERS"}

    try:
        auth_resp = requests.post(auth_url, headers=headers, data=data, verify=False, timeout=10)
        if auth_resp.status_code != 200:
            return {
                "success": False,
                "error": f"Ошибка авторизации GigaChat (HTTP {auth_resp.status_code}): {auth_resp.text[:200]}"
            }
        access_token = auth_resp.json().get("access_token")
    except Exception as exc:
        return {"success": False, "error": f"Сетевая ошибка GigaChat OAuth: {str(exc)}"}

    # 2. Запрос завершения чата
    chat_url = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"
    chat_headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    system_prompt = (
        "Ты — школьный образовательный наставник «Навигатор Знаний» на платформе Сферум. "
        "Обучай строго по стандартам ФГОС РФ методом Сократа: не выдавай готовых решений задач, "
        "а помогай ученику прийти к ответу через наводящие вопросы и понятные физические аналогии."
    )
    payload = {
        "model": "GigaChat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7
    }

    try:
        resp = requests.post(chat_url, headers=chat_headers, json=payload, verify=False, timeout=20)
        if resp.status_code != 200:
            return {
                "success": False,
                "error": f"Ошибка генерации GigaChat (HTTP {resp.status_code}): {resp.text[:200]}"
            }
        content = resp.json()["choices"][0]["message"]["content"]
        return {
            "success": True,
            "message": content,
            "source": "Sber GigaChat • ФГОС Сферум",
            "model": "gigachat"
        }
    except Exception as exc:
        return {"success": False, "error": f"Сетевая ошибка GigaChat API: {str(exc)}"}


def query_deepseek(prompt: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    """Отправляет запрос к DeepSeek API (deepseek-chat)."""
    key = api_key or os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not key:
        return {
            "success": False,
            "error": "DEEPSEEK_API_KEY не указан в файле .env"
        }

    url = "https://api.deepseek.com/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    system_prompt = (
        "Ты — школьный наставник «Навигатор Знаний» платформы Сферум. "
        "Обучай строго по стандартам ФГОС РФ методом Сократа: не давай готовых решений, "
        "задавай наводящие вопросы и разбирай задачи по шагам."
    )
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=20)
        if resp.status_code != 200:
            return {
                "success": False,
                "error": f"Ошибка DeepSeek API (HTTP {resp.status_code}): {resp.text[:200]}"
            }
        content = resp.json()["choices"][0]["message"]["content"]
        return {
            "success": True,
            "message": content,
            "source": "DeepSeek API • ФГОС Сферум",
            "model": "deepseek"
        }
    except Exception as exc:
        return {"success": False, "error": f"Сетевая ошибка DeepSeek API: {str(exc)}"}


def query_yandex(prompt: str, api_key: Optional[str] = None, folder_id: Optional[str] = None) -> Dict[str, Any]:
    """Отправляет запрос к YandexGPT API (Алиса / Yandex Cloud)."""
    key = api_key or os.getenv("YANDEX_API_KEY", "").strip()
    f_id = folder_id or os.getenv("YANDEX_FOLDER_ID", "").strip()
    if not key:
        return {
            "success": False,
            "error": "YANDEX_API_KEY не указан в файле .env"
        }

    model_uri = f"gpt://{f_id}/yandexgpt/latest" if f_id else "gpt://b1g00000000000000000/yandexgpt-lite/latest"
    url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
    headers = {
        "Authorization": f"Api-Key {key}",
        "Content-Type": "application/json"
    }
    system_prompt = (
        "Ты — школьный наставник «Навигатор Знаний» платформы Сферум. "
        "Обучай строго по стандартам ФГОС РФ методом Сократа: задавай наводящие вопросы и объясняй суть через аналогии."
    )
    payload = {
        "modelUri": model_uri,
        "completionOptions": {
            "stream": False,
            "temperature": 0.6,
            "maxTokens": "2000"
        },
        "messages": [
            {"role": "system", "text": system_prompt},
            {"role": "user", "text": prompt}
        ]
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=20)
        if resp.status_code != 200:
            return {
                "success": False,
                "error": f"Ошибка YandexGPT (HTTP {resp.status_code}): {resp.text[:200]}"
            }
        result = resp.json()
        alternatives = result.get("result", {}).get("alternatives", [])
        if alternatives:
            content = alternatives[0].get("message", {}).get("text", "")
            return {
                "success": True,
                "message": content,
                "source": "YandexGPT (Алиса) • ФГОС Сферум",
                "model": "yandex"
            }
        return {"success": False, "error": "Пустой ответ от YandexGPT"}
    except Exception as exc:
        return {"success": False, "error": f"Сетевая ошибка YandexGPT: {str(exc)}"}


def route_llm_request(user_text: str, model_name: str = "gigachat", username: str = "Ученик") -> Dict[str, Any]:
    """
    Маршрутизирует запрос пользователя к выбранному LLM API:
    - При наличии токенов в .env выполняет реальный сетевой запрос к API.
    - При отсутствии токенов или сетевом сбое плавно переключается на автономную
      сократовскую базу знаний ФГОС РФ (backend.llm_engine).
    """
    load_env_file()
    model = (model_name or "gigachat").lower().strip()

    # Если выбрана локальная встроенная модель ФГОС
    if model == "socratic":
        from backend.llm_engine import generate_llm_response
        return generate_llm_response(user_text, username=username)

    result: Optional[Dict[str, Any]] = None

    if model == "gigachat":
        result = query_gigachat(user_text)
    elif model == "deepseek":
        result = query_deepseek(user_text)
    elif model == "yandex":
        result = query_yandex(user_text)
    else:
        # Неизвестная модель — fallback
        from backend.llm_engine import generate_llm_response
        return generate_llm_response(user_text, username=username)

    # Если вызов API прошел успешно
    if result and result.get("success"):
        return {
            "type": "llm_reply",
            "title": f"Ответ {MODELS_INFO.get(model, {}).get('name', model)}",
            "message": result["message"],
            "source": result.get("source", "Нейросеть • Сферум"),
            "model": model,
            "suggestions": [
                "Объясни подробнее",
                "Приведи пример из жизни",
                "Задай наводящий вопрос",
                "Помоги с формулой"
            ]
        }

    # Если токен не задан или возникла ошибка сети — fallback на локальный Сократовский движок ФГОС
    from backend.llm_engine import generate_llm_response
    fallback_response = generate_llm_response(user_text, username=username)

    err_msg = result.get("error", "API ключ не настроен") if result else "API недоступен"
    model_display = MODELS_INFO.get(model, {}).get("name", model)
    fallback_response["source"] = f"{model_display} (Резервный режим ФГОС)"
    fallback_response["api_notice"] = f"⚠️ Запрос к {model_display} перенаправлен во встроенную базу ФГОС: {err_msg}"

    return fallback_response
