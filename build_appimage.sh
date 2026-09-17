#!/usr/bin/env bash
# ==============================================================================
# build_appimage.sh — Скрипт автоматической сборки переносимого пакета AppImage
# Собирает структуру AppDir, бандлит Python-зависимости и генерирует AppImage.
# Полностью адаптирован для Arch Linux, Ubuntu/Debian и CI/CD окружений.
# ==============================================================================

set -euo pipefail

# Цветовая индикация терминала
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[ИНФО]${NC} $1"; }
success() { echo -e "${GREEN}[УСПЕХ]${NC} $1"; }
warn() { echo -e "${YELLOW}[ВНИМАНИЕ]${NC} $1"; }
error() { echo -e "${RED}[ОШИБКА]${NC} $1" >&2; }

# Определение путей
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${PROJECT_DIR}/build"
APPDIR="${BUILD_DIR}/AppDir"
OUTPUT_IMAGE="${PROJECT_DIR}/NavigatorZnanij-x86_64.AppImage"
APPIMAGETOOL="${BUILD_DIR}/appimagetool"

export ARCH="x86_64"

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}  Сборка AppImage: «Навигатор Знаний» (ФГОС RAG + Метод Сократа)  ${NC}"
echo -e "${CYAN}================================================================${NC}"

# 1. Проверка базовых утилит
info "Проверка необходимых инструментов в системе..."
for cmd in python3 curl; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        error "Утилита '$cmd' не найдена. Пожалуйста, установите её в систему."
        exit 1
    fi
done

mkdir -p "${BUILD_DIR}"

# 2. Получение appimagetool
if command -v appimagetool >/dev/null 2>&1; then
    APPIMAGETOOL_EXEC="$(command -v appimagetool)"
    info "Используется системный appimagetool: ${APPIMAGETOOL_EXEC}"
else
    if [ ! -f "${APPIMAGETOOL}" ]; then
        info "Загрузка appimagetool-x86_64.AppImage..."
        TOOL_URL="https://github.com/AppImageCommunity/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage"
        FALLBACK_URL="https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"

        if ! curl -L --fail -o "${APPIMAGETOOL}" "${TOOL_URL}"; then
            warn "Основное зеркало недоступно. Пробуем резервный URL..."
            curl -L --fail -o "${APPIMAGETOOL}" "${FALLBACK_URL}"
        fi
        chmod +x "${APPIMAGETOOL}"
        success "appimagetool успешно загружен."
    fi
    APPIMAGETOOL_EXEC="${APPIMAGETOOL}"
fi

# 3. Подготовка чистой структуры AppDir
info "Формирование дерева каталогов AppDir..."
rm -rf "${APPDIR}"
mkdir -p \
    "${APPDIR}/usr/bin" \
    "${APPDIR}/usr/lib" \
    "${APPDIR}/usr/share/applications" \
    "${APPDIR}/usr/share/icons/hicolor/256x256/apps" \
    "${APPDIR}/opt"

# 4. Копирование ресурсов спецификации Linux Desktop и AppRun
info "Копирование desktop-файла, иконки и скрипта запуска AppRun..."
cp "${PROJECT_DIR}/linux/AppRun" "${APPDIR}/AppRun"
chmod +x "${APPDIR}/AppRun"

cp "${PROJECT_DIR}/linux/navigator.desktop" "${APPDIR}/navigator.desktop"
cp "${PROJECT_DIR}/linux/navigator.desktop" "${APPDIR}/usr/share/applications/navigator.desktop"

if [ -f "${PROJECT_DIR}/linux/navigator.png" ]; then
    cp "${PROJECT_DIR}/linux/navigator.png" "${APPDIR}/navigator.png"
    cp "${PROJECT_DIR}/linux/navigator.png" "${APPDIR}/.DirIcon"
    cp "${PROJECT_DIR}/linux/navigator.png" "${APPDIR}/usr/share/icons/hicolor/256x256/apps/navigator.png"
fi

# 5. Копирование исходного кода приложения
info "Синхронизация файлов приложения (main.py, web/, backend/)..."
cp "${PROJECT_DIR}/main.py" "${APPDIR}/"
cp "${PROJECT_DIR}/requirements.txt" "${APPDIR}/"
cp -r "${PROJECT_DIR}/backend" "${APPDIR}/"
cp -r "${PROJECT_DIR}/web" "${APPDIR}/"

# 6. Создание изолированного виртуального окружения Python и установка зависимостей
info "Создание изолированного Python-окружения внутри AppDir..."
VENV_DIR="${APPDIR}/opt/venv"
python3 -m venv "${VENV_DIR}"

info "Установка зависимостей из requirements.txt..."
"${VENV_DIR}/bin/pip" install --upgrade pip --quiet
"${VENV_DIR}/bin/pip" install -r "${PROJECT_DIR}/requirements.txt" --quiet

# Очистка кэша pip и ненужных файлов для минимизации размера
rm -rf "${VENV_DIR}/share" "${VENV_DIR}"/**/__pycache__ 2>/dev/null || true

# 7. Генерация итогового AppImage
info "Упаковка AppDir в AppImage через appimagetool..."
export ARCH=x86_64
export NO_STRIP=1

# Удаляем старый файл перед генерацией во избежание 'Text file busy'
rm -f "${OUTPUT_IMAGE}"

# В ArchLinux и некоторых контейнерах FUSE может требовать --appimage-extract-and-run
if [ "${APPIMAGETOOL_EXEC}" = "${APPIMAGETOOL}" ]; then
    "${APPIMAGETOOL_EXEC}" --appimage-extract-and-run "${APPDIR}" "${OUTPUT_IMAGE}"
else
    "${APPIMAGETOOL_EXEC}" "${APPDIR}" "${OUTPUT_IMAGE}"
fi

chmod +x "${OUTPUT_IMAGE}"

echo ""
success "Сборка успешно завершена!"
echo -e "${GREEN}Итоговый файл:${NC} ${OUTPUT_IMAGE}"
echo -e "${GREEN}Размер:${NC} $(du -h "${OUTPUT_IMAGE}" | cut -f1)"
echo -e "${CYAN}Команда для запуска:${NC} ./${OUTPUT_IMAGE##*/}"
