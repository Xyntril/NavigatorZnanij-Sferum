/**
 * Навигатор Знаний — Клиентская логика приложения MAX UI (web/app.js)
 * Разработано в рамках хакатона «Идея фикс» платформы Сферум (ООО «МАХ», ООО «Компания ВК»).
 * 
 * Архитектура:
 * 1. Интеграция с официальной библиотекой MAX Bridge (https://st.max.ru/js/max-web-app.js):
 *    - Глобальный объект window.WebApp (ready, expand);
 *    - Авторизация через window.WebApp.initDataUnsafe.user (id, first_name, last_name, photo_url);
 *    - Поддержка нативной системной кнопки «Назад» (window.WebApp.BackButton);
 *    - Тактильные виброотклики HapticFeedback (impactOccurred('light')) при отправке и смене экранов.
 * 2. Дизайн-система MAX UI (@maxhub/max-ui):
 *    - 2 изолированные схемы оформления: MAX UI Dark (по умолчанию) и MAX UI Light;
 *    - Поддержка фирменных squircle-аватаров Avatar.Container и карточек Panel/Container.
 * 3. Мультимодельный роутер:
 *    - Переключение между Sber GigaChat, DeepSeek API, YandexGPT и локальным ядром ФГОС.
 * 4. Полное и безвозвратное удаление истории диалогов и пользовательских сессий (клиент + бэкенд).
 */

document.addEventListener("DOMContentLoaded", () => {
    // =========================================================================
    // 1. ИНЛАЙНОВЫЕ SVG-ИКОНКИ (100% ОФФЛАЙН, БЕЗ СТОРОННИХ ШРИФТОВ)
    // =========================================================================
    const ICONS = {
        brain: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-5.04z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-5.04z"/></svg>`,
        fileDoc: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
        filePhoto: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
        check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
        tag: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
        chatItem: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
        trash: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`
    };

    // =========================================================================
    // 2. АДАПТЕР MAX BRIDGE (max-web-app.js integration)
    // =========================================================================
    const MaxBridge = {
        isAvailable() {
            return typeof window.WebApp !== "undefined";
        },
        init() {
            if (this.isAvailable()) {
                try {
                    window.WebApp.ready?.();
                    window.WebApp.expand?.();
                    console.log("[MAX Bridge] Интеграция с платформой MAX инициализирована успешно.");
                } catch (err) {
                    console.warn("[MAX Bridge] Ошибка вызова ready/expand:", err);
                }

                // Подключение нативной кнопки «Назад»
                if (window.WebApp.BackButton) {
                    try {
                        window.WebApp.BackButton.onClick(() => {
                            this.handleBackNavigation();
                        });
                    } catch (err) {
                        console.warn("[MAX Bridge] Ошибка привязки BackButton:", err);
                    }
                }
            }
        },
        getUser() {
            if (this.isAvailable() && window.WebApp.initDataUnsafe && window.WebApp.initDataUnsafe.user) {
                const u = window.WebApp.initDataUnsafe.user;
                const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ");
                return {
                    id: u.id,
                    first_name: u.first_name || "",
                    last_name: u.last_name || "",
                    photo_url: u.photo_url || null,
                    username: u.username || "",
                    displayName: fullName || u.first_name || u.username || `Пользователь #${u.id}`
                };
            }
            return null;
        },
        triggerHaptic(type = "light") {
            if (this.isAvailable() && window.WebApp.HapticFeedback && typeof window.WebApp.HapticFeedback.impactOccurred === "function") {
                try {
                    window.WebApp.HapticFeedback.impactOccurred(type);
                } catch (err) {
                    console.debug("[MAX Bridge] HapticFeedback impactOccurred error:", err);
                }
            }
        },
        setBackButtonVisible(visible) {
            if (this.isAvailable() && window.WebApp.BackButton) {
                try {
                    if (visible) {
                        window.WebApp.BackButton.show();
                    } else {
                        window.WebApp.BackButton.hide();
                    }
                } catch (err) {
                    console.debug("[MAX Bridge] BackButton visibility error:", err);
                }
            }
        },
        handleBackNavigation() {
            // Закрытие модальных окон при нажатии нативной кнопки "Назад"
            if (settingsModal && settingsModal.style.display === "flex") {
                closeSettingsModal();
                return;
            }
            if (attachModal && attachModal.style.display === "flex") {
                closeAttachModal();
                return;
            }
            if (aboutModal && aboutModal.style.display === "flex") {
                aboutModal.style.display = "none";
                this.updateBackState();
                return;
            }
            // Закрытие мобильного сайдбара
            if (appSidebar && appSidebar.classList.contains("mobile-open")) {
                appSidebar.classList.remove("mobile-open");
                this.updateBackState();
                return;
            }
        },
        updateBackState() {
            const hasOpenModal = (
                (settingsModal && settingsModal.style.display === "flex") ||
                (attachModal && attachModal.style.display === "flex") ||
                (aboutModal && aboutModal.style.display === "flex") ||
                (appSidebar && appSidebar.classList.contains("mobile-open"))
            );
            this.setBackButtonVisible(hasOpenModal);
        }
    };

    // Стартовая инициализация моста MAX WebApp
    MaxBridge.init();

    // =========================================================================
    // 3. СОСТОЯНИЕ ПРИЛОЖЕНИЯ И ТЕМЫ MAX UI
    // =========================================================================
    const VALID_THEMES = ["dark", "light"];
    let currentTheme = localStorage.getItem("nz_theme") || "dark";
    if (!VALID_THEMES.includes(currentTheme)) currentTheme = "dark";

    let currentUsername = localStorage.getItem("nz_user") || "Пользователь";
    let currentUserPhoto = localStorage.getItem("nz_user_photo") || null;
    let currentLLMModel = localStorage.getItem("nz_llm_model") || "gigachat";
    let isWaitingForResponse = false;
    let sessions = [];
    let currentSessionId = null;

    // Загрузка сохранённых диалогов
    try {
        const saved = localStorage.getItem("nz_sessions");
        if (saved) sessions = JSON.parse(saved);
    } catch (e) {
        console.warn("Ошибка чтения сохранённых сессий:", e);
        sessions = [];
    }

    // =========================================================================
    // 4. ССЫЛКИ НА DOM-ЭЛЕМЕНТЫ MAX UI
    // =========================================================================
    const appContainer = document.getElementById("app-container");

    // Экран 1: Онбординг
    const onboardingScreen = document.getElementById("onboarding-screen");
    const onboardingForm = document.getElementById("onboarding-form");
    const usernameInput = document.getElementById("username-input");
    const onboardingWarning = document.getElementById("onboarding-warning");

    // Экран 2: Рабочая область (Chat + Panel)
    const chatScreen = document.getElementById("chat-screen");
    const appSidebar = document.getElementById("app-sidebar");
    const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
    const currentUserLabel = document.getElementById("current-user-label");
    const headerUserAvatar = document.getElementById("header-user-avatar");
    const newChatBtn = document.getElementById("new-chat-btn");
    const sessionHistoryList = document.getElementById("session-history-list");
    const aboutBtn = document.getElementById("about-btn");
    const headerTuxBtn = document.getElementById("header-tux-btn");

    // Область переписки и ввод
    const chatMessagesArea = document.getElementById("chat-messages-area");
    const messagesContainer = document.getElementById("messages-container");
    const typingIndicator = document.getElementById("typing-indicator");
    const chatForm = document.getElementById("chat-form");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const attachBtn = document.getElementById("attach-btn");

    // Модальное окно «Настройки»
    const settingsBtn = document.getElementById("settings-btn");
    const headerSettingsBtn = document.getElementById("header-settings-btn");
    const settingsModal = document.getElementById("settings-modal");
    const closeSettingsModalBtn = document.getElementById("close-settings-modal-btn");
    const closeSettingsBtnOk = document.getElementById("close-settings-btn-ok");
    const settingsThemeSelect = document.getElementById("settings-theme-select");
    const settingsLlmSelect = document.getElementById("settings-llm-select");
    const settingsClearAllSessionsBtn = document.getElementById("settings-clear-all-sessions-btn");

    // Модальные окна «Прикрепить файл» и «О проекте»
    const attachModal = document.getElementById("attach-modal");
    const closeAttachModalBtn = document.getElementById("close-attach-modal-btn");
    const modalAttachDocBtn = document.getElementById("modal-attach-doc-btn");
    const modalAttachPhotoBtn = document.getElementById("modal-attach-photo-btn");

    const aboutModal = document.getElementById("about-modal");
    const closeAboutModalBtn = document.getElementById("close-about-modal-btn");
    const modalOkBtn = document.getElementById("modal-ok-btn");

    // =========================================================================
    // 5. УПРАВЛЕНИЕ ТЕМАМИ И ПРОФИЛЕМ ПОЛЬЗОВАТЕЛЯ MAX
    // =========================================================================
    function applyTheme(themeName) {
        if (!VALID_THEMES.includes(themeName)) themeName = "dark";
        currentTheme = themeName;
        localStorage.setItem("nz_theme", currentTheme);

        document.body.className = "theme-" + themeName;

        if (settingsThemeSelect) {
            settingsThemeSelect.value = themeName;
        }
    }

    function setLLMModel(modelName) {
        currentLLMModel = modelName || "gigachat";
        localStorage.setItem("nz_llm_model", currentLLMModel);

        if (settingsLlmSelect) {
            settingsLlmSelect.value = currentLLMModel;
        }

        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.set_llm_model === "function") {
            window.pywebview.api.set_llm_model(currentLLMModel).catch(console.warn);
        }
    }

    function renderSquircleAvatar(element, name, photoUrl) {
        if (!element) return;
        if (photoUrl) {
            element.innerHTML = `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(name)}" class="max-avatar-img">`;
        } else {
            element.textContent = (name && name[0] ? name[0] : "П").toUpperCase();
        }
    }

    function updateProfileDisplay(name, maxUser = null) {
        currentUsername = name || "Пользователь";
        localStorage.setItem("nz_user", currentUsername);

        if (maxUser && maxUser.photo_url) {
            currentUserPhoto = maxUser.photo_url;
            localStorage.setItem("nz_user_photo", currentUserPhoto);
        }

        if (currentUserLabel) currentUserLabel.textContent = currentUsername;

        // Обновляем мини-аватар в шапке
        renderSquircleAvatar(headerUserAvatar, currentUsername, currentUserPhoto);

        // Обновляем блок профиля в настройках
        const profileNameEl = document.getElementById("profile-display-name");
        const profileStatusEl = document.getElementById("profile-bridge-status");
        const profileAvatarEl = document.getElementById("profile-avatar-circle");

        if (profileNameEl) profileNameEl.textContent = currentUsername;
        renderSquircleAvatar(profileAvatarEl, currentUsername, currentUserPhoto);

        if (maxUser) {
            if (profileStatusEl) {
                profileStatusEl.textContent = `MAX Bridge: ID #${maxUser.id} (${maxUser.first_name} ${maxUser.last_name})`.trim();
            }
        } else {
            if (profileStatusEl) {
                profileStatusEl.textContent = "Режим: Локальный десктопный клиент";
            }
        }
    }

    // Слушатели модального окна настроек
    function openSettingsModal() {
        MaxBridge.triggerHaptic("light");
        if (settingsThemeSelect) settingsThemeSelect.value = currentTheme;
        if (settingsLlmSelect) settingsLlmSelect.value = currentLLMModel;
        settingsModal.style.display = "flex";
        MaxBridge.updateBackState();
    }

    function closeSettingsModal() {
        settingsModal.style.display = "none";
        MaxBridge.updateBackState();
    }

    if (settingsBtn) settingsBtn.addEventListener("click", openSettingsModal);
    if (headerSettingsBtn) headerSettingsBtn.addEventListener("click", openSettingsModal);
    if (closeSettingsModalBtn) closeSettingsModalBtn.addEventListener("click", closeSettingsModal);
    if (closeSettingsBtnOk) closeSettingsBtnOk.addEventListener("click", closeSettingsModal);

    if (settingsModal) {
        settingsModal.addEventListener("click", (e) => {
            if (e.target === settingsModal) closeSettingsModal();
        });
    }

    if (settingsThemeSelect) {
        settingsThemeSelect.addEventListener("change", (e) => {
            applyTheme(e.target.value);
            MaxBridge.triggerHaptic("light");
        });
    }

    if (settingsLlmSelect) {
        settingsLlmSelect.addEventListener("change", (e) => {
            setLLMModel(e.target.value);
            MaxBridge.triggerHaptic("light");
        });
    }

    // Инициализация стартовой темы и модели LLM
    applyTheme(currentTheme);
    setLLMModel(currentLLMModel);

    // =========================================================================
    // 6. УПРАВЛЕНИЕ СЕССИЯМИ И БЕЗВОЗВРАТНОЕ УДАЛЕНИЕ ДАННЫХ
    // =========================================================================
    function saveSessionsToStorage() {
        try {
            localStorage.setItem("nz_sessions", JSON.stringify(sessions));
        } catch (e) {
            console.warn("Ошибка сохранения сессий в хранилище:", e);
        }
    }

    function renderSessionHistory() {
        if (!sessionHistoryList) return;
        sessionHistoryList.innerHTML = "";

        if (sessions.length === 0) {
            const emptyItem = document.createElement("div");
            emptyItem.style.padding = "12px 14px";
            emptyItem.style.fontSize = "0.82rem";
            emptyItem.style.color = "var(--max-color-text-tertiary)";
            emptyItem.textContent = "История диалогов пуста";
            sessionHistoryList.appendChild(emptyItem);
            return;
        }

        sessions.forEach(sess => {
            const item = document.createElement("div");
            item.className = "history-item" + (sess.id === currentSessionId ? " active" : "");

            item.innerHTML = `
                <span class="history-item-icon">${ICONS.chatItem}</span>
                <span class="history-item-text" title="${escapeHtml(sess.title)}">${escapeHtml(sess.title)}</span>
                <button type="button" class="history-item-delete" title="Удалить диалог безвозвратно" data-session-id="${sess.id}">
                    ${ICONS.trash}
                </button>
            `;

            // Переключение диалога
            item.addEventListener("click", (e) => {
                if (e.target.closest(".history-item-delete")) return;
                MaxBridge.triggerHaptic("light");
                switchSession(sess.id);
                if (appSidebar) appSidebar.classList.remove("mobile-open");
                MaxBridge.updateBackState();
            });

            // Безвозвратное удаление отдельного диалога
            const deleteBtn = item.querySelector(".history-item-delete");
            if (deleteBtn) {
                deleteBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    deleteSession(sess.id);
                });
            }

            sessionHistoryList.appendChild(item);
        });
    }

    function createNewSession(initialTitle = "Новый диалог") {
        const id = "sess_" + Date.now();
        const newSession = {
            id,
            title: initialTitle,
            createdAt: new Date().toISOString(),
            messages: []
        };
        sessions.unshift(newSession);
        currentSessionId = id;
        saveSessionsToStorage();
        renderSessionHistory();
        return newSession;
    }

    function switchSession(sessionId) {
        currentSessionId = sessionId;
        renderSessionHistory();
        messagesContainer.innerHTML = "";

        const sess = sessions.find(s => s.id === sessionId);
        if (sess && sess.messages.length > 0) {
            sess.messages.forEach(msg => {
                if (msg.role === "user") {
                    renderUserBubble(msg.text, false);
                } else if (msg.role === "bot") {
                    renderBotBubble(msg.data, false);
                } else if (msg.role === "file") {
                    renderFileBubble(msg.data, false);
                }
            });
            scrollToBottom();
        } else {
            initSessionGreeting();
        }
    }

    function addMessageToCurrentSession(msgObj) {
        let sess = sessions.find(s => s.id === currentSessionId);
        if (!sess) {
            sess = createNewSession();
        }
        sess.messages.push(msgObj);

        if (msgObj.role === "user" && sess.messages.filter(m => m.role === "user").length === 1) {
            const snippet = msgObj.text.slice(0, 26).trim() + (msgObj.text.length > 26 ? "..." : "");
            sess.title = snippet;
            renderSessionHistory();
        }
        saveSessionsToStorage();
    }

    function deleteSession(sessionId) {
        MaxBridge.triggerHaptic("light");
        if (!confirm("Удалить этот диалог безвозвратно? Все сообщения будут полностью стёрты из базы данных.")) {
            return;
        }

        // Вызов Python API для стирания на бэкенде
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.delete_session === "function") {
            window.pywebview.api.delete_session(sessionId).catch(console.warn);
        }

        sessions = sessions.filter(s => s.id !== sessionId);
        saveSessionsToStorage();

        if (currentSessionId === sessionId) {
            if (sessions.length > 0) {
                switchSession(sessions[0].id);
            } else {
                currentSessionId = null;
                messagesContainer.innerHTML = "";
                initSessionGreeting();
            }
        }
        renderSessionHistory();
    }

    function clearAllSessions() {
        MaxBridge.triggerHaptic("light");
        if (!confirm("Вы действительно хотите полностью и безвозвратно удалить ВСЕ чаты и сессии из базы данных?")) {
            return;
        }

        // Вызов Python API для полной очистки базы данных
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.clear_all_sessions === "function") {
            window.pywebview.api.clear_all_sessions().catch(console.warn);
        }

        sessions = [];
        currentSessionId = null;
        saveSessionsToStorage();
        renderSessionHistory();
        messagesContainer.innerHTML = "";
        initSessionGreeting();
        closeSettingsModal();
    }

    if (settingsClearAllSessionsBtn) {
        settingsClearAllSessionsBtn.addEventListener("click", clearAllSessions);
    }

    // =========================================================================
    // 7. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ И РЕНДЕРИНГ СООБЩЕНИЙ MAX UI
    // =========================================================================
    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatMarkdown(text) {
        if (!text) return "";
        let out = escapeHtml(text);

        // Блоки кода ```text ... ```
        out = out.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre class="code-block"><code>${code}</code></pre>`;
        });

        // Инлайновый код `code`
        out = out.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // Жирный шрифт **текст**
        out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

        // Курсив *текст*
        out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");

        // Переносы строк
        out = out.replace(/\n/g, "<br>");
        return out;
    }

    function getCurrentTimeString() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
        });
    }

    function renderUserBubble(text, save = true) {
        const row = document.createElement("div");
        row.className = "message-row user";

        const bubble = document.createElement("div");
        bubble.className = "chat-bubble user";

        const content = document.createElement("div");
        content.className = "bubble-content";
        content.innerHTML = formatMarkdown(text);

        const time = document.createElement("div");
        time.className = "bubble-time";
        time.textContent = getCurrentTimeString();

        bubble.appendChild(content);
        bubble.appendChild(time);
        row.appendChild(bubble);
        messagesContainer.appendChild(row);

        if (save) {
            addMessageToCurrentSession({ role: "user", text, time: getCurrentTimeString() });
        }
        scrollToBottom();
    }

    function renderFileBubble(fileData, save = true) {
        const row = document.createElement("div");
        row.className = "message-row user";

        const bubble = document.createElement("div");
        bubble.className = "chat-bubble user";

        const isPhoto = fileData.type === "photo";
        const iconSvg = isPhoto ? ICONS.filePhoto : ICONS.fileDoc;
        const typeLabel = isPhoto ? "Снимок задания / Схема" : "Учебный документ";

        bubble.innerHTML = `
            <div class="file-attachment-card">
                <div class="file-icon-box">${iconSvg}</div>
                <div class="file-info-box">
                    <div class="file-name">${escapeHtml(fileData.filename)}</div>
                    <div class="file-meta">${typeLabel} • ${fileData.filesize || "Размер не указан"}</div>
                </div>
            </div>
            <div class="bubble-time">${getCurrentTimeString()}</div>
        `;

        row.appendChild(bubble);
        messagesContainer.appendChild(row);

        if (save) {
            addMessageToCurrentSession({ role: "file", data: fileData, time: getCurrentTimeString() });
        }
        scrollToBottom();
    }

    function renderBotBubble(data, save = true) {
        const row = document.createElement("div");
        row.className = "message-row bot";

        // Фирменный Squircle-аватар Сократа / Сферума
        const avatar = document.createElement("div");
        avatar.className = "max-avatar max-avatar-squircle bot-avatar-box";
        avatar.innerHTML = ICONS.brain;
        row.appendChild(avatar);

        const bubble = document.createElement("div");
        bubble.className = "chat-bubble bot";

        // Заголовок карточки
        if (data.title) {
            const titleEl = document.createElement("div");
            titleEl.className = "bubble-title";
            titleEl.textContent = data.title;
            bubble.appendChild(titleEl);
        }

        // Основной текст ответа
        if (data.message) {
            const content = document.createElement("div");
            content.className = "bubble-content";
            content.innerHTML = formatMarkdown(data.message);
            bubble.appendChild(content);
        }

        // Шаги разбора Сократа
        if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
            const stepsBlock = document.createElement("div");
            stepsBlock.className = "socratic-steps-block";

            data.steps.forEach(st => {
                const stepItem = document.createElement("div");
                stepItem.className = "socratic-step-item";
                stepItem.innerHTML = `
                    <div class="step-num">${st.step}</div>
                    <div class="step-body">
                        <div class="step-title">${escapeHtml(st.title)}</div>
                        <div class="step-desc">${formatMarkdown(st.description)}</div>
                    </div>
                `;
                stepsBlock.appendChild(stepItem);
            });
            bubble.appendChild(stepsBlock);
        }

        // Модель и аналогия
        if (data.analogy && data.analogy.narrative) {
            const analogyCard = document.createElement("div");
            analogyCard.className = "socratic-card";
            analogyCard.innerHTML = `
                <div style="display: flex; align-items: center; gap: 6px; font-weight: 600; margin-bottom: 6px;">
                    ${ICONS.brain}
                    <span>${escapeHtml(data.analogy.title || "Модель и аналогия")}</span>
                </div>
                <div style="font-size: 0.88rem; color: var(--max-color-text-secondary);">${formatMarkdown(data.analogy.narrative)}</div>
            `;
            bubble.appendChild(analogyCard);
        }

        // Наводящий вопрос Сократа
        if (data.socratic_question) {
            const socQuestion = document.createElement("div");
            socQuestion.className = "socratic-question-box";
            socQuestion.innerHTML = `
                <div class="soc-q-icon">${ICONS.check}</div>
                <div class="soc-q-text">${formatMarkdown(data.socratic_question)}</div>
            `;
            bubble.appendChild(socQuestion);
        }

        // Интерактивные подсказки для быстрого ответа
        if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
            const suggRow = document.createElement("div");
            suggRow.className = "suggestions-track";

            data.suggestions.forEach(sug => {
                const chip = document.createElement("button");
                chip.type = "button";
                chip.className = "suggestion-chip";
                chip.textContent = sug;
                chip.addEventListener("click", () => {
                    MaxBridge.triggerHaptic("light");
                    sendMessage(sug);
                });
                suggRow.appendChild(chip);
            });
            bubble.appendChild(suggRow);
        }

        // Подвал карточки с метаданными и временем
        const metaRow = document.createElement("div");
        metaRow.className = "bubble-footer-meta";
        metaRow.style.display = "flex";
        metaRow.style.justifyContent = "space-between";
        metaRow.style.marginTop = "6px";

        const badge = document.createElement("div");
        badge.className = "source-tag";
        badge.innerHTML = `${ICONS.tag} <span>${escapeHtml(data.source || "ФГОС РФ • MAX")}</span>`;

        const time = document.createElement("div");
        time.className = "bubble-time";
        time.textContent = getCurrentTimeString();

        metaRow.appendChild(badge);
        metaRow.appendChild(time);
        bubble.appendChild(metaRow);

        row.appendChild(bubble);
        messagesContainer.appendChild(row);

        if (save) {
            addMessageToCurrentSession({ role: "bot", data, time: getCurrentTimeString() });
        }
        scrollToBottom();
    }

    function setTyping(state) {
        isWaitingForResponse = state;
        if (sendBtn) sendBtn.disabled = state;
        if (typingIndicator) typingIndicator.style.display = state ? "flex" : "none";
        if (state) scrollToBottom();
    }

    // =========================================================================
    // 8. ИНТЕРАКТИВНЫЕ ОБРАЗОВАТЕЛЬНЫЕ ПАСХАЛКИ
    // =========================================================================
    function triggerBarrelRoll() {
        appContainer.classList.remove("barrel-roll-active");
        void appContainer.offsetWidth;
        appContainer.classList.add("barrel-roll-active");

        setTimeout(() => {
            appContainer.classList.remove("barrel-roll-active");
        }, 1350);
    }

    function getTuxResponse() {
        return {
            title: "Пингвин Тукс — Талисман Linux",
            message: `🐧 **Привет от пингвина Тукса — талисмана Linux!**\n\nЯ помогаю школьникам разбираться в информатике, физике и математике по стандартам ФГОС РФ для платформы Сферум и мессенджера MAX!\n\`\`\`text\n     .--.\n    |o_o |\n    |:_/ |\n   //   \\ \\\n  (|     | )\n /'\\_   _/\\\\\n \\___)=(___/\n\`\`\`\nИзучай фундаментальные законы и развивай аналитическое мышление методом Сократа!`,
            source: "ФГОС Информатика • MAX UI"
        };
    }

    function getLinuxResponse() {
        return {
            title: "Операционные системы • Архитектура Linux",
            message: `🐧 **Операционные системы семейства Linux**\n\nLinux — это высокопроизводительное монолитное ядро операционной системы, лежащее в основе миллионов серверов, облачных платформ и мобильных устройств.\n\nВ рамках школьного курса информатики по стандартам **ФГОС РФ** изучение устройства операционных систем развивает понимание файловой иерархии, процессов, потоков и сетевых протоколов.`,
            source: "ФГОС РФ • MAX"
        };
    }

    // =========================================================================
    // 9. ОТПРАВКА СООБЩЕНИЙ И МАРШРУТИЗАЦИЯ В LLM API
    // =========================================================================
    async function sendMessage(manualText) {
        const text = (manualText || userInput.value || "").trim();
        if (!text || isWaitingForResponse) return;

        // Тактильный отклик MAX Bridge при отправке
        MaxBridge.triggerHaptic("light");

        renderUserBubble(text, true);
        userInput.value = "";
        userInput.style.height = "auto";

        const lower = text.toLowerCase().trim();

        // Пасхалка "Сделай бочку"
        if (lower.includes("сделай бочку") || lower.includes("do a barrel roll") || lower === "бочка") {
            triggerBarrelRoll();
        }

        setTyping(true);

        try {
            let response = null;

            if (lower === "show me tux" || lower === "тукс" || lower === "tux") {
                response = getTuxResponse();
            } else if (lower === "linux" || lower === "линукс") {
                response = getLinuxResponse();
            } else if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.send_message === "function") {
                response = await window.pywebview.api.send_message(text, currentUsername, currentLLMModel);
            } else {
                // Браузерный fallback
                await new Promise(r => setTimeout(r, 400));
                response = {
                    title: "Закон Ома для участка цепи",
                    message: `Отличный вопрос, **${currentUsername}**! Закон Ома гласит: **I = U / R**. Сила тока прямо пропорциональна напряжению и обратно пропорциональна сопротивлению проводника.`,
                    steps: [
                        { step: 1, title: "Формула", description: "В системе СИ: Сила тока $I$ измеряется в Амперах (А), напряжение $U$ в Вольтах (В), сопротивление $R$ в Омах (Ом)." },
                        { step: 2, title: "Аналогия", description: "Напряжение — это напор воды из крана, а сопротивление — сужение шланга. Чем сильнее сужен шланг, тем меньше струя воды (ток)." },
                        { step: 3, title: "Вывод Сократа", description: "Что произойдёт с током в лампочке, если напряжение батарейки увеличить в два раза, не меняя лампочку?" }
                    ],
                    analogy: {
                        title: "Модель потока воды",
                        narrative: "Представь реку, в которую установили плотину с узким проходом. Вода течёт медленнее из-за сопротивления. Но если увеличить напор сверху, поток усилится!"
                    },
                    socratic_question: "Если сопротивление $R$ вырастет в 3 раза при постоянном $U$, как изменится сила тока $I$?",
                    source: "ФГОС Физика 8 класс • Перышкин А.В.",
                    suggestions: [
                        "I = U / R",
                        "помоги решить",
                        "что такое фотосинтез",
                        "show me tux"
                    ]
                };
            }

            if (response) {
                renderBotBubble(response, true);
            }
        } catch (err) {
            console.error("Ошибка при обработке запроса:", err);
            renderBotBubble({
                title: "Системное уведомление",
                message: "Не удалось получить ответ ассистента. Пожалуйста, повторите запрос.",
                source: "Системная ошибка"
            }, true);
        } finally {
            setTyping(false);
            userInput.focus();
        }
    }

    // =========================================================================
    // 10. ОНБОРДИНГ И ИНИЦИАЛИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ MAX BRIDGE
    // =========================================================================
    async function initSessionGreeting() {
        let greetingData = null;

        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.set_user_name === "function") {
            try {
                greetingData = await window.pywebview.api.set_user_name(currentUsername);
            } catch (err) {
                console.error("Ошибка вызова set_user_name:", err);
            }
        }

        if (!greetingData) {
            greetingData = {
                title: "Навигатор Знаний",
                username: currentUsername,
                message: `Привет, **${currentUsername}**! Я твой Навигатор Знаний в среде MAX.\n\nЯ помогу тебе изучать формулы и законы природы по стандартам ФГОС РФ методом Сократа.\n\nЧто будем изучать сегодня?`,
                steps: [
                    { step: 1, title: "Выбор темы", description: "Спроси формулу или явление (например, **I = U / R** или **a² + b² = c²**)." },
                    { step: 2, title: "Физический смысл", description: "Разберём процесс через понятную модель (давление воды в трубе)." },
                    { step: 3, title: "Метод Сократа", description: "Сделай самостоятельный вывод и закрепи понимание без зубрёжки." }
                ],
                analogy: {
                    title: "Метод Сократа",
                    narrative: "«Знание существует для того, чтобы им делиться». Мы учим понимать законы природы через логику и наводящие вопросы!"
                },
                socratic_question: "Хочешь узнать, как Закон Ома ($I = U / R$) объясняется через поток воды в трубе?",
                source: "ФГОС РФ • MAX"
            };
        }

        if (greetingData.username) {
            currentUsername = greetingData.username;
            updateProfileDisplay(currentUsername);
        }

        renderBotBubble(greetingData, true);
    }

    // Авторизация через MAX Bridge (window.WebApp.initDataUnsafe.user)
    const maxUser = MaxBridge.getUser();
    if (maxUser) {
        console.log("[MAX Bridge] Авторизован пользователь платформы MAX:", maxUser);
        updateProfileDisplay(maxUser.displayName, maxUser);

        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.sync_max_user === "function") {
            window.pywebview.api.sync_max_user(maxUser).catch(console.warn);
        }

        // Пропускаем приветственный экран при наличии данных MAX Bridge
        onboardingScreen.style.display = "none";
        chatScreen.style.display = "flex";

        if (sessions.length === 0) {
            createNewSession("Диалог Сократа");
            initSessionGreeting();
        } else {
            switchSession(sessions[0].id);
        }
    } else {
        updateProfileDisplay(currentUsername);
    }

    onboardingForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        MaxBridge.triggerHaptic("light");

        const rawName = usernameInput.value.trim();
        let warning = null;
        let sanitizedName = rawName || "Пользователь";

        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.set_user_name === "function") {
            try {
                const res = await window.pywebview.api.set_user_name(rawName);
                if (res) {
                    sanitizedName = res.username || "Пользователь";
                    warning = res.warning || null;
                }
            } catch (err) {
                console.error("Ошибка валидации через API:", err);
            }
        } else {
            const cyrillicRegex = /^[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*$/;
            if (!cyrillicRegex.test(rawName)) {
                warning = "Поле содержит недопустимые символы. Пожалуйста, используйте стандартный формат имени (только кириллица).";
                sanitizedName = "Пользователь";
            } else {
                sanitizedName = rawName.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("-");
            }
        }

        if (warning) {
            if (onboardingWarning) {
                onboardingWarning.style.display = "flex";
                const wText = document.getElementById("warning-text");
                if (wText) wText.textContent = warning;
            }
        }

        updateProfileDisplay(sanitizedName);

        // Переключение экрана онбординга на рабочий чат
        onboardingScreen.style.display = "none";
        chatScreen.style.display = "flex";

        if (sessions.length === 0) {
            createNewSession("Первый диалог");
            initSessionGreeting();
        } else {
            switchSession(sessions[0].id);
        }

        userInput.focus();
    });

    // =========================================================================
    // 11. АВТОРЕГУЛИРОВКА ТЕКСТОВОГО ПОЛЯ И ПРИКРЕПЛЕНИЕ МАТЕРИАЛОВ
    // =========================================================================
    userInput.addEventListener("input", () => {
        userInput.style.height = "auto";
        userInput.style.height = Math.min(userInput.scrollHeight, 140) + "px";
    });

    userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        sendMessage();
    });

    // Модальное окно "Прикрепить файл"
    function openAttachModal() {
        MaxBridge.triggerHaptic("light");
        attachModal.style.display = "flex";
        MaxBridge.updateBackState();
    }

    function closeAttachModal() {
        attachModal.style.display = "none";
        MaxBridge.updateBackState();
    }

    attachBtn.addEventListener("click", openAttachModal);
    closeAttachModalBtn.addEventListener("click", closeAttachModal);
    attachModal.addEventListener("click", (e) => {
        if (e.target === attachModal) closeAttachModal();
    });

    modalAttachDocBtn.addEventListener("click", async () => {
        closeAttachModal();
        if (isWaitingForResponse) return;
        MaxBridge.triggerHaptic("light");

        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.attach_document === "function") {
            try {
                const res = await window.pywebview.api.attach_document();
                if (res && res.success && !res.cancelled) {
                    renderFileBubble(res, true);
                    renderBotBubble({
                        title: "Память ассистента",
                        message: res.bot_reply || `Файл **${res.filename}** успешно загружен в память ассистента.\n\nКакую задачу или формулу из этого документа разберём по методу Сократа?`,
                        source: "Память ассистента • ФГОС RAG"
                    }, true);
                }
            } catch (err) {
                console.error("Ошибка прикрепления документа:", err);
            }
        } else {
            const mock = { filename: "uchebnik_fiziki_8kl.pdf", filesize: "520 КБ", type: "document" };
            renderFileBubble(mock, true);
            renderBotBubble({
                message: `Файл **${mock.filename}** успешно загружен в память ассистента.\n\nКакую задачу или формулу из него мы разберём?`,
                source: "Память ассистента"
            }, true);
        }
    });

    modalAttachPhotoBtn.addEventListener("click", async () => {
        closeAttachModal();
        if (isWaitingForResponse) return;
        MaxBridge.triggerHaptic("light");

        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.attach_photo === "function") {
            try {
                const res = await window.pywebview.api.attach_photo();
                if (res && res.success && !res.cancelled) {
                    renderFileBubble(res, true);
                    renderBotBubble({
                        title: "Память ассистента",
                        message: res.bot_reply || `Файл **${res.filename}** успешно загружен в память ассистента.\n\nЯ вижу снимок условия задачи или схемы цепи. Какую величину требуется определить?`,
                        source: "Память ассистента • ФГОС RAG"
                    }, true);
                }
            } catch (err) {
                console.error("Ошибка прикрепления фото:", err);
            }
        } else {
            const mock = { filename: "shema_cepi_resistor.png", filesize: "1.4 МБ", type: "photo" };
            renderFileBubble(mock, true);
            renderBotBubble({
                message: `Файл **${mock.filename}** успешно загружен в память ассистента.\n\nЯ вижу чертёж электрической цепи. Какую величину требуется определить?`,
                source: "Память ассистента"
            }, true);
        }
    });

    // =========================================================================
    // 12. ДЕЙСТВИЯ САЙДБАРА И ШАПКИ
    // =========================================================================
    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => {
            MaxBridge.triggerHaptic("light");
            messagesContainer.innerHTML = "";
            createNewSession("Новый диалог");
            initSessionGreeting();
            userInput.focus();
            if (appSidebar) appSidebar.classList.remove("mobile-open");
            MaxBridge.updateBackState();
        });
    }

    function openAboutModal() {
        MaxBridge.triggerHaptic("light");
        aboutModal.style.display = "flex";
        MaxBridge.updateBackState();
    }

    function closeAboutModal() {
        aboutModal.style.display = "none";
        MaxBridge.updateBackState();
    }

    if (aboutBtn) aboutBtn.addEventListener("click", openAboutModal);
    if (headerTuxBtn) headerTuxBtn.addEventListener("click", openAboutModal);
    if (closeAboutModalBtn) closeAboutModalBtn.addEventListener("click", closeAboutModal);
    if (modalOkBtn) modalOkBtn.addEventListener("click", closeAboutModal);

    if (aboutModal) {
        aboutModal.addEventListener("click", (e) => {
            if (e.target === aboutModal) closeAboutModal();
        });
    }

    // Мобильный тоггл панели сайдбара
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener("click", () => {
            MaxBridge.triggerHaptic("light");
            appSidebar.classList.toggle("mobile-open");
            MaxBridge.updateBackState();
        });
    }
});
