# 🧭 Навигатор Знаний (Navigator Znanij)

<p align="center">
  <img src="linux/navigator.png" alt="Логотип Навигатора Знаний" width="128" height="128">
</p>

<p align="center">
  <strong>Свободный образовательный ИИ-наставник по школьным стандартам ФГОС РФ на основе метода Сократа.</strong>
</p>

<p align="center">
  <a href="#-лицензия"><img src="https://img.shields.io/badge/License-GNU_GPLv3-0055aa.svg?style=for-the-badge&logo=gnu" alt="GPLv3 License"></a>
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.10+-3776AB.svg?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.10+"></a>
  <a href="https://pywebview.flowrl.com/"><img src="https://img.shields.io/badge/GUI-pywebview-FF6F00.svg?style=for-the-badge" alt="pywebview"></a>
  <a href="https://www.riverbankcomputing.com/software/pyqt/"><img src="https://img.shields.io/badge/Engine-PyQt6_WebEngine-41CD52.svg?style=for-the-badge&logo=qt&logoColor=white" alt="PyQt6 WebEngine"></a>
  <a href="https://develop.kde.org/frameworks/kirigami/"><img src="https://img.shields.io/badge/Design-KDE_Kirigami-1D99F3.svg?style=for-the-badge&logo=kde&logoColor=white" alt="KDE Kirigami"></a>
  <a href="https://appimage.org/"><img src="https://img.shields.io/badge/Package-AppImage_x86__64-BC1142.svg?style=for-the-badge&logo=linux&logoColor=white" alt="AppImage"></a>
  <img src="https://img.shields.io/badge/FSF-Stallman_Approved-green.svg?style=for-the-badge" alt="FSF Stallman Approved">
</p>

---

## 🏛️ Философия проекта

> *«В каждом человеке есть солнце. Только дайте ему светить».* — **Сократ**

Большинство современных образовательных нейросетей превратились в генераторы слепых списываний, атрофирующие аналитическое мышление. **«Навигатор Знаний»** построен на принципиально иной парадигме:

1. **Метод Сократа (Майевтика):** Ассистент **никогда не выдает готовых шаблонных решений**. Вместо этого он декомпозирует задачу на физические и логические шаги, задает наводящие вопросы и подталкивает ученика сделать открытие самостоятельно.
2. **Живые аналогии:** Сложные формулы объясняются через понятные механические и бытовые образы. Так, закон Ома ($I = \frac{U}{R}$) визуализируется через садовый шланг: напряжение ($U$) — давление водяного насоса, сопротивление ($R$) — пережимание шланга, сила тока ($I$) — объём вытекающей воды.
3. **Верификация по ФГОС РФ:** Каждая формула, термин и определение строго привязаны к верифицированным школьным учебникам РФ (Пёрышкин 8 класс, Атанасян 8 класс и др.).
4. **Свободное ПО (FOSS) и защита цифровых прав:** Код лицензирован под **GNU GPLv3**. Мы свято соблюдаем [4 свободы программного обеспечения](https://www.gnu.org/philosophy/free-sw.html), сформулированные Ричардом Столлманом: свобода запускать, изучать, модифицировать и распространять софт. Приложение не собирает персональные данные и работает полностью локально.

---

## ✨ Ключевые возможности

* 📱 **Адаптивный интерфейс в духе KDE Kirigami:**
  * **Desktop:** Эргономичный сайдбар с быстрым доступом к темам ФГОС, настройкам и переключению тем, совмещённый с широкой рабочей областью чата.
  * **Mobile (`max-width: 768px`):** Полноэкранные баблы на 100% ширины, скрываемый сайдбар и нижний эргономичный Navigation Bar.
  * **Fluid-дизайн:** Плавное масштабирование шрифтов и отступов через CSS `clamp()`.
* 🎨 **Двухрежимная система стилей:**
  * **KDE Kirigami Modern:** Анимированный переливающийся градиент в тонах Neon Dark, глубокий Glassmorphism с `backdrop-filter`, мягкие неоновые тени.
  * **Windows 98 Retro:** Аутентичный ретро-стиль на основе спецификации **98.css** (рельефные скошенные рамки окон, заголовок с градиентом и системными кнопками, утопленные панели `.sunken-panel`, 3D-кнопки и классический статус-бар).
  * Мгновенное переключение темы «на лету» без перезапуска приложения.
* 📎 **Нативная работа с файлами (Скрепка и Камера):**
  * Вызов системных диалогов Linux (`webview.windows[0].create_file_dialog()`) для выбора документов (PDF, DOCX, TXT) и снимков домашних заданий (PNG, JPG).
  * Загрузка в изолированную свободную память наставника с подтверждением в чате.
* 🐧 **Гик-пасхалки:**
  * `show me tux` / `тукс`: Вызов талисмана Linux — пингвина Тукса в ASCII-арте с манифестом свободного ПО.
  * `Linux`: Вежливая, но настойчивая интервенция пастой Ричарда Столлмана о **GNU/Linux**.
  * `сделай бочку` / `do a barrel roll`: Полный 360-градусный кувырок интерфейса на CSS-анимациях.

---

## 🏗️ Архитектура репозитория

```plaintext
NavigatorZnanij/
├── .github/workflows/
│   └── build.yml             # CI/CD: Автоматическая сборка AppImage на GitHub Actions
├── linux/                    # Ресурсы интеграции с Linux Desktop
│   ├── AppRun                # Точка входа для запуска внутри контейнера AppImage
│   ├── navigator.desktop     # XDG Desktop-файл с метаданными и категориями
│   └── navigator.png         # Векторная/растровая иконка приложения
├── backend/                  # Серверное/локальное Python-ядро
│   ├── api.py                # Мост JS API (pywebview.api), нативные диалоги файлов
│   ├── llm_engine.py         # Интеллектуальный анализатор интентов, метод Сократа, FOSS пасхалки
│   ├── llm_socrates.py       # Движок педагогической майевтики
│   └── fgos_rag.py           # База знаний школьной программы ФГОС РФ
├── web/                      # Изолированное фронтенд-ядро (HTML5/CSS3/ES6)
│   ├── index.html            # Двухэкранная разметка (Онбординг + Адаптивный Чат Kirigami)
│   ├── style-modern.css      # Адаптивный KDE Kirigami + Glassmorphism + clamp()
│   ├── style-win98.css       # Аутентичный ретро-стиль Windows 98 (98.css)
│   ├── style-dark.css        # Точка расширения современной темы
│   └── app.js                # Клиентская логика, роутинг экранов, рендеринг и пасхалки
├── build_appimage.sh         # Скрипт сборки автономного AppImage-пакета
├── requirements.txt          # Зависимости проекта (pywebview, PyQt6, PyQt6-WebEngine, qtpy)
├── main.py                   # Точка входа приложения на pywebview
├── LICENSE                   # Официальный полный текст GNU General Public License v3.0
└── README.md                 # Документация проекта
```

---

## 🚀 Быстрый старт

### Требования к системе
* **ОС:** GNU/Linux (Arch Linux, Ubuntu 22.04+, Debian 12+, Fedora 38+, Manjaro)
* **Python:** 3.10 или новее
* **Движок рендеринга:** WebKitGTK или Qt6 (PyQt6-WebEngine)

### 1. Локальный запуск из исходного кода

Клонируйте репозиторий и настройте виртуальное окружение:

```bash
# Клонирование
git clone https://github.com/your-username/NavigatorZnanij.git
cd NavigatorZnanij

# Создание и активация виртуального окружения
python3 -m venv .venv
source .venv/bin/activate

# Установка зависимостей
pip install --upgrade pip
pip install -r requirements.txt

# Запуск приложения
python3 main.py
```

---

## 📦 Сборка автономного AppImage

Приложение комплектуется production-скриптом `build_appimage.sh`, который:
1. Формирует структуру каталогов спецификации `AppDir`.
2. Копирует desktop-файл, иконки и скрипт `AppRun`.
3. Создаёт изолированное Python-окружение и бандлит все необходимые зависимости (`PyQt6`, `PyQt6-WebEngine`, `pywebview`).
4. Автоматически скачивает и запускает актуальный `appimagetool`.
5. Генерирует готовый бинарный пакет `NavigatorZnanij-x86_64.AppImage`.

### Запуск сборки:

```bash
chmod +x build_appimage.sh
./build_appimage.sh
```

### Запуск полученного AppImage:

```bash
chmod +x NavigatorZnanij-x86_64.AppImage
./NavigatorZnanij-x86_64.AppImage
```

---

## 🧪 Интерактивные пасхалки в чате

| Команда / Фраза | Описание реакции |
| :--- | :--- |
| `show me tux` или `тукс` | Выводит ASCII-арт пингвина Тукса и радостный манифест 4 свобод ПО |
| `Linux` или `линукс` | Запускает знаменитую интервенцию Ричарда Столлмана о **GNU/Linux** |
| `сделай бочку` / `do a barrel roll` | Совершает полный 360-градусный переворот окна через CSS-трансформацию |
| `I = U / R` | Подробный 3-шаговый разбор закона Ома с аналогией про воду в трубе |
| `помоги решить` | Активирует режим Сократа с серией наводящих вопросов |
| `что такое фотосинтез` | Выдаёт академическое определение из школьного словаря ФГОС РФ |

---

## 📜 Лицензия

Проект распространяется под свободной лицензией **GNU General Public License v3.0 (GPLv3)**. Полный текст лицензии доступен в файле [LICENSE](file:///home/artem/PycharmProjects/FastAPI_Sferum-PWA/LICENSE).

> *«Свободное программное обеспечение — это вопрос свободы, а не цены. Чтобы понять эту концепцию, вам следует думать о «свободе слова», а не о «бесплатном пиве».»* — **Free Software Foundation**
