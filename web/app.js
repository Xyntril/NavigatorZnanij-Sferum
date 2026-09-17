/**
 * Навигатор Знаний — JavaScript клиентская логика (web/app.js)
 * Архитектура:
 * - 100% автономность (Zero CDN, чистые инлайновые SVG для оффлайн-работы в AppImage)
 * - Мультитемность (6 стилей HIG: Dark, Light, Win98, Aero, Breeze Dark, Libadwaita)
 * - Сайдбар с полноценной историей сессий/запросов и кнопкой "Новый диалог"
 * - Поддержка строгой цензуры и ФГОС-валидации имени
 * - Интерактивное прикрепление документов и изображений через нативный Python API
 * - Пасхалки: "Сделай бочку" (CSS 360°), Tux ASCII, GNU/Linux
 */

document.addEventListener("DOMContentLoaded", () => {
    // =========================================================================
    // 1. ИНЛАЙНОВЫЕ SVG-ИКОНКИ (100% ОФФЛАЙН, БЕЗ CDN)
    // =========================================================================
    const ICONS = {
        brain: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-5.04z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-5.04z"/></svg>`,
        fileDoc: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
        filePhoto: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
        check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
        steps: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
        tag: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
        chatItem: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
        user: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
    };

    // =========================================================================
    // 2. СОСТОЯНИЕ ПРИЛОЖЕНИЯ
    // =========================================================================
    const VALID_THEMES = ["dark", "light", "win98", "aero", "breeze", "adwaita"];
    let currentTheme = localStorage.getItem("nz_theme") || "dark";
    if (!VALID_THEMES.includes(currentTheme)) currentTheme = "dark";

    let currentUsername = localStorage.getItem("nz_user") || "Пользователь";
    let isWaitingForResponse = false;
    let sessions = [];
    let currentSessionId = null;

    // Загрузка сохраненных сессий из LocalStorage
    try {
        const savedSessions = localStorage.getItem("nz_sessions");
        if (savedSessions) {
            sessions = JSON.parse(savedSessions);
        }
    } catch (e) {
        console.warn("Не удалось прочитать сохраненные сессии:", e);
        sessions = [];
    }

    // =========================================================================
    // 3. ССЫЛКИ НА DOM-ЭЛЕМЕНТЫ
    // =========================================================================
    const appContainer = document.getElementById("app-container");

    // Экран 1: Онбординг
    const onboardingScreen = document.getElementById("onboarding-screen");
    const onboardingForm = document.getElementById("onboarding-form");
    const usernameInput = document.getElementById("username-input");
    const onboardingWarning = document.getElementById("onboarding-warning");
    const onboardingWinTitlebar = document.getElementById("onboarding-win-titlebar");
    const themeChoiceBtns = document.querySelectorAll(".theme-choice-btn");

    // Экран 2: Чат и Сайдбар
    const chatScreen = document.getElementById("chat-screen");
    const chatWinTitlebar = document.getElementById("chat-win-titlebar");
    const appSidebar = document.getElementById("app-sidebar");
    const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
    const win98Statusbar = document.getElementById("win-statusbar");
    const currentUserLabel = document.getElementById("current-user-label");
    const newChatBtn = document.getElementById("new-chat-btn");
    const sessionHistoryList = document.getElementById("session-history-list");
    const themeDropdown = document.getElementById("theme-dropdown");
    const clearChatBtn = document.getElementById("clear-chat-btn");
    const aboutBtn = document.getElementById("about-btn");
    const headerTuxBtn = document.getElementById("header-tux-btn");

    // Область сообщений и поле ввода
    const chatMessagesArea = document.getElementById("chat-messages-area");
    const messagesContainer = document.getElementById("messages-container");
    const typingIndicator = document.getElementById("typing-indicator");
    const chatForm = document.getElementById("chat-form");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const attachBtn = document.getElementById("attach-btn");

    // Модальные окна
    const attachModal = document.getElementById("attach-modal");
    const closeAttachModalBtn = document.getElementById("close-attach-modal-btn");
    const modalAttachDocBtn = document.getElementById("modal-attach-doc-btn");
    const modalAttachPhotoBtn = document.getElementById("modal-attach-photo-btn");

    const aboutModal = document.getElementById("about-modal");
    const closeAboutModalBtn = document.getElementById("close-about-modal-btn");
    const modalOkBtn = document.getElementById("modal-ok-btn");

    // =========================================================================
    // 4. УПРАВЛЕНИЕ 6 ТЕМАМИ ОФОРМЛЕНИЯ ПО РУКОВОДСТВАМ HIG
    // =========================================================================
    function applyTheme(themeName) {
        if (!VALID_THEMES.includes(themeName)) themeName = "dark";
        currentTheme = themeName;
        localStorage.setItem("nz_theme", currentTheme);

        // Переключение класса на body
        document.body.className = "theme-" + themeName;

        // Синхронизация селектора темы в сайдбаре
        if (themeDropdown) {
            themeDropdown.value = themeName;
        }

        // Синхронизация карточек на онбординге
        themeChoiceBtns.forEach(btn => {
            if (btn.dataset.theme === themeName) {
                btn.classList.add("selected");
            } else {
                btn.classList.remove("selected");
            }
        });

        // Заголовки окон для Win98 и Aero
        const isWindowed = (themeName === "win98" || themeName === "aero");
        if (chatWinTitlebar) chatWinTitlebar.style.display = isWindowed ? "flex" : "none";
        if (onboardingWinTitlebar) onboardingWinTitlebar.style.display = isWindowed ? "flex" : "none";
        if (win98Statusbar) win98Statusbar.style.display = (themeName === "win98") ? "flex" : "none";
    }

    // Обработчики кликов по кнопкам тем на онбординге
    themeChoiceBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const chosen = btn.dataset.theme;
            applyTheme(chosen);
        });
    });

    // Обработчик смены темы в сайдбаре
    if (themeDropdown) {
        themeDropdown.addEventListener("change", (e) => {
            applyTheme(e.target.value);
        });
    }

    // Инициализируем стартовую тему
    applyTheme(currentTheme);

    // =========================================================================
    // 5. МОДЕЛЬ СЕССИЙ И ИСТОРИИ ЗАПРОСОВ В САЙДБАРЕ
    // =========================================================================
    function saveSessionsToStorage() {
        try {
            localStorage.setItem("nz_sessions", JSON.stringify(sessions));
        } catch (e) {
            console.warn("Ошибка сохранения сессий:", e);
        }
    }

    function renderSessionHistory() {
        if (!sessionHistoryList) return;
        sessionHistoryList.innerHTML = "";

        if (sessions.length === 0) {
            const emptyItem = document.createElement("div");
            emptyItem.style.padding = "8px 12px";
            emptyItem.style.fontSize = "0.78rem";
            emptyItem.style.opacity = "0.6";
            emptyItem.style.fontStyle = "italic";
            emptyItem.textContent = "История сессий пуста";
            sessionHistoryList.appendChild(emptyItem);
            return;
        }

        sessions.forEach(sess => {
            const item = document.createElement("div");
            item.className = "history-item" + (sess.id === currentSessionId ? " active" : "");
            item.title = sess.title;

            const iconSpan = document.createElement("span");
            iconSpan.className = "history-item-icon";
            iconSpan.innerHTML = ICONS.chatItem;

            const textSpan = document.createElement("span");
            textSpan.className = "history-item-text";
            textSpan.textContent = sess.title || "Новый диалог";

            item.appendChild(iconSpan);
            item.appendChild(textSpan);

            item.addEventListener("click", () => {
                loadSession(sess.id);
                // Закрываем сайдбар на мобильных
                if (appSidebar) appSidebar.classList.remove("mobile-open");
            });

            sessionHistoryList.appendChild(item);
        });
    }

    function createNewSession(initialTitle = "Новый диалог") {
        const newId = "sess_" + Date.now();
        const newSession = {
            id: newId,
            title: initialTitle,
            createdAt: Date.now(),
            messages: []
        };
        sessions.unshift(newSession);
        currentSessionId = newId;
        saveSessionsToStorage();
        renderSessionHistory();
        return newSession;
    }

    function loadSession(sessionId) {
        const sess = sessions.find(s => s.id === sessionId);
        if (!sess) return;

        currentSessionId = sessionId;
        messagesContainer.innerHTML = "";

        // Воспроизводим сообщения из истории сессии
        sess.messages.forEach(msg => {
            if (msg.role === "user") {
                renderUserBubble(msg.text, false);
            } else if (msg.role === "file") {
                renderFileBubble(msg.fileInfo, false);
            } else if (msg.role === "bot") {
                renderBotBubble(msg.data, false);
            }
        });

        renderSessionHistory();
        scrollToBottom();
    }

    function addMessageToCurrentSession(msgObj) {
        let sess = sessions.find(s => s.id === currentSessionId);
        if (!sess) {
            sess = createNewSession(msgObj.text ? msgObj.text.slice(0, 30) : "Диалог");
        }

        // Если это первый вопрос пользователя, обновляем заголовок сессии
        if (msgObj.role === "user" && (sess.title === "Новый диалог" || sess.messages.length === 0)) {
            sess.title = msgObj.text.length > 28 ? msgObj.text.slice(0, 28) + "..." : msgObj.text;
        }

        sess.messages.push(msgObj);
        saveSessionsToStorage();
        renderSessionHistory();
    }

    // =========================================================================
    // 6. РЕНДЕРИНГ И ФОРМАТИРОВАНИЕ СООБЩЕНИЙ
    // =========================================================================
    function getCurrentTimeString() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatMarkdown(text) {
        if (!text) return "";

        // Блоки кода ```text ... ``` (включая ASCII-арт Тукса)
        let formatted = text.replace(/```text([\s\S]*?)```/g, (match, p1) => {
            return `<pre class="tux-ascii">${p1.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;
        });

        // Математические формулы $...$
        formatted = formatted.replace(/\$([^\$]+)\$/g, '<code class="math-inline">$1</code>');
        // Жирный шрифт **...**
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // Курсив *...*
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        // Цитаты
        formatted = formatted.replace(/^>\s*(.+)$/gm, '<blockquote style="border-left: 3px solid currentColor; opacity: 0.85; padding-left: 10px; margin: 6px 0;">$1</blockquote>');
        // Переносы строк
        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
        });
    }

    function renderUserBubble(text, save = true) {
        const row = document.createElement("div");
        row.className = "msg-row user";

        const bubble = document.createElement("div");
        bubble.className = "chat-bubble user";

        const content = document.createElement("div");
        content.textContent = text;

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

    function renderFileBubble(fileInfo, save = true) {
        const row = document.createElement("div");
        row.className = "msg-row user";

        const bubble = document.createElement("div");
        bubble.className = "chat-bubble user";

        const card = document.createElement("div");
        card.className = "file-attachment-card";

        const iconBox = document.createElement("div");
        iconBox.className = "file-icon-box";
        iconBox.innerHTML = fileInfo.type === "photo" ? ICONS.filePhoto : ICONS.fileDoc;

        const meta = document.createElement("div");
        meta.className = "file-meta";
        meta.innerHTML = `
            <div class="file-title">Файл: ${fileInfo.filename}</div>
            <div class="file-size">${fileInfo.filesize || 'Локальная память'}</div>
        `;

        card.appendChild(iconBox);
        card.appendChild(meta);

        const time = document.createElement("div");
        time.className = "bubble-time";
        time.textContent = getCurrentTimeString();

        bubble.appendChild(card);
        bubble.appendChild(time);
        row.appendChild(bubble);
        messagesContainer.appendChild(row);

        if (save) {
            addMessageToCurrentSession({ role: "file", fileInfo, time: getCurrentTimeString() });
        }
        scrollToBottom();
    }

    function renderBotBubble(data, save = true) {
        const row = document.createElement("div");
        row.className = "msg-row bot";

        const avatar = document.createElement("div");
        avatar.className = "bot-avatar-box";
        avatar.innerHTML = ICONS.brain;
        row.appendChild(avatar);

        const bubble = document.createElement("div");
        bubble.className = "chat-bubble bot";

        // Основной текст сообщения
        if (data.message) {
            const bodyDiv = document.createElement("div");
            bodyDiv.className = "bot-body-text";
            bodyDiv.innerHTML = formatMarkdown(data.message);
            bubble.appendChild(bodyDiv);
        }

        // Шаги Сократа
        if (data.steps && data.steps.length > 0) {
            const stepsCard = document.createElement("div");
            stepsCard.className = "socratic-steps-card";

            const label = document.createElement("div");
            label.className = "socratic-steps-label";
            label.innerHTML = `${ICONS.steps} <span>Шаги понимания:</span>`;
            stepsCard.appendChild(label);

            data.steps.forEach(s => {
                const sRow = document.createElement("div");
                sRow.className = "socratic-step-item";
                sRow.innerHTML = `
                    <span class="step-circle">${s.step}</span>
                    <div><strong>${s.title}:</strong> ${s.description}</div>
                `;
                stepsCard.appendChild(sRow);
            });
            bubble.appendChild(stepsCard);
        }

        // Карточка физической аналогии
        if (data.analogy && data.analogy.narrative) {
            const analogyBox = document.createElement("div");
            analogyBox.className = "socratic-card analogy-card";
            analogyBox.innerHTML = `
                <div style="font-weight: 700; margin-bottom: 4px;">🌊 ${data.analogy.title || "Физическая модель"}:</div>
                <div style="opacity: 0.9;">${formatMarkdown(data.analogy.narrative)}</div>
            `;
            bubble.appendChild(analogyBox);
        }

        // Вопрос Сократа
        if (data.socratic_question) {
            const qBox = document.createElement("div");
            qBox.className = "socratic-card socratic-question-card";
            qBox.innerHTML = `
                <div style="font-weight: 700; margin-bottom: 4px;">💡 Вопрос Сократа:</div>
                <div>${formatMarkdown(data.socratic_question)}</div>
            `;
            bubble.appendChild(qBox);
        }

        // Мета-строка (источник ФГОС и время)
        const metaRow = document.createElement("div");
        metaRow.style.display = "flex";
        metaRow.style.alignItems = "center";
        metaRow.style.justifyContent = "space-between";
        metaRow.style.marginTop = "4px";

        const badge = document.createElement("div");
        badge.className = "source-tag";
        badge.innerHTML = `${ICONS.tag} <span>${data.source || "ФГОС РФ • GNU GPLv3"}</span>`;

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
    // 7. ПАСХАЛКИ (БОЧКА 360°, TUX ASCII, GNU/LINUX)
    // =========================================================================
    function triggerBarrelRoll() {
        appContainer.classList.remove("barrel-roll-active");
        void appContainer.offsetWidth; // Force Reflow
        appContainer.classList.add("barrel-roll-active");

        setTimeout(() => {
            appContainer.classList.remove("barrel-roll-active");
        }, 1350);
    }

    function getTuxResponse() {
        return {
            title: "Пингвин Тукс",
            message: `🐧 **Привет из мира свободного программного обеспечения!**\n\nПингвин Тукс напоминает: знание должно быть свободным, как и твой цифровой наставник (GNU GPLv3)!\n\`\`\`text\n     .--.\n    |o_o |\n    |:_/ |\n   //   \\ \\\n  (|     | )\n /'\\_   _/\`\\\n \\___)=(___/\n\`\`\`\nСвободные знания принадлежат каждому человеку!`,
            source: "Free Software Foundation • GPLv3"
        };
    }

    function getStallmanResponse() {
        return {
            title: "Интервенция Ричарда М. Столлмана",
            message: `«Я хотел бы вмешаться на мгновение. То, что вы называете Linux, на самом деле — **GNU/Linux**, или, как я недавно стал называть его, **GNU плюс Linux**...\n\nМы учим понимать базовые принципы и защищаем 4 фундаментальные свободы пользователей!»`,
            source: "GNU Project • Richard M. Stallman"
        };
    }

    // =========================================================================
    // 8. ОТПРАВКА СООБЩЕНИЙ И ОБРАБОТКА ДИАЛОГА
    // =========================================================================
    async function sendMessage(manualText) {
        const text = (manualText || userInput.value || "").trim();
        if (!text || isWaitingForResponse) return;

        renderUserBubble(text, true);
        userInput.value = "";
        userInput.style.height = "auto";

        const lower = text.toLowerCase().trim();

        // Проверка пасхалки "Сделай бочку"
        if (lower.includes("сделай бочку") || lower.includes("do a barrel roll") || lower === "бочка") {
            triggerBarrelRoll();
        }

        setTyping(true);

        try {
            let response = null;

            // Локальный перехват оффлайн-пасхалок
            if (lower === "show me tux" || lower === "тукс" || lower === "tux") {
                response = getTuxResponse();
            } else if (lower === "linux" || lower === "линукс") {
                response = getStallmanResponse();
            } else if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.send_message === "function") {
                response = await window.pywebview.api.send_message(text, currentUsername);
            } else {
                // Браузерный fallback для локального тестирования
                await new Promise(r => setTimeout(r, 400));
                response = {
                    title: "Закон Ома для участка цепи",
                    message: `Отличный вопрос, **${currentUsername}**! Закон Ома гласит: **I = U / R**. Сила тока прямо пропорциональна напряжению и обратно пропорциональна сопротивлению проводника.`,
                    steps: [
                        { step: 1, title: "Напряжение (U)", description: "Напор или толчок, заставляющий заряды двигаться по цепи." },
                        { step: 2, title: "Сопротивление (R)", description: "Препятствие кристаллической решётки проводника." },
                        { step: 3, title: "Сила тока (I)", description: "Количество зарядов в секунду ($I = \\frac{U}{R}$)." }
                    ],
                    analogy: {
                        title: "Аналогия с водой в трубе",
                        narrative: "Напряжение ($U$) — давление водяного насоса. Сопротивление ($R$) — зажим на шланге. Сила тока ($I$) — сколько литров вытекает за 1 секунду."
                    },
                    socratic_question: "Если увеличить сопротивление $R$ в 2 раза при неизменном напряжении, как изменится сила тока?",
                    source: "ФГОС Физика 8 кл. • §44"
                };
            }

            renderBotBubble(response, true);
        } catch (err) {
            console.error("Ошибка передачи сообщения бэкенду:", err);
            renderBotBubble({
                message: "⚠️ Произошла ошибка связи с ядром системы. Попробуй ещё раз.",
                source: "Системное уведомление"
            }, true);
        } finally {
            setTyping(false);
            userInput.focus();
        }
    }

    // =========================================================================
    // 9. ОНБОРДИНГ И ВАЛИДАЦИЯ ИМЕНИ (ФГОС)
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
                message: `Привет, **${currentUsername}**! Я твой Навигатор Знаний.\n\nМои знания **абсолютно свободны**, и эта программа уважает твои **цифровые права и свободы** (GNU GPLv3).\n\nЧто будем изучать по свободной программе ФГОС?`,
                steps: [
                    { step: 1, title: "Свобода темы", description: "Спроси формулу или явление (например, **I = U / R** или **a² + b² = c²**)." },
                    { step: 2, title: "Физический смысл", description: "Разберём процесс через понятную модель (давление воды в трубе)." },
                    { step: 3, title: "Метод Сократа", description: "Сделай самостоятельный вывод и закрепи понимание без зубрежки." }
                ],
                analogy: {
                    title: "Метод Сократа",
                    narrative: "«Знание существует для того, чтобы им делиться свободно». Мы учим понимать законы природы через логику и наводящие вопросы!"
                },
                socratic_question: "Хочешь узнать, как Закон Ома ($I = U / R$) объясняется через поток воды в трубе?",
                source: "ФГОС РФ • GNU GPLv3"
            };
        }

        // Обновляем имя, если Python применил цензуру
        if (greetingData.username) {
            currentUsername = greetingData.username;
            localStorage.setItem("nz_user", currentUsername);
            if (currentUserLabel) currentUserLabel.textContent = currentUsername;
        }

        renderBotBubble(greetingData, true);
    }

    onboardingForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const rawName = usernameInput.value.trim();

        let warning = null;
        let sanitizedName = rawName || "Пользователь";

        // Проверяем через бэкенд Python (строгая валидация)
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.set_user_name === "function") {
            try {
                const res = await window.pywebview.api.set_user_name(rawName);
                if (res) {
                    sanitizedName = res.username || "Пользователь";
                    warning = res.warning || null;
                }
            } catch (err) {
                console.error("Ошибка проверки имени:", err);
            }
        }

        currentUsername = sanitizedName;
        localStorage.setItem("nz_user", currentUsername);
        if (currentUserLabel) currentUserLabel.textContent = currentUsername;

        // Переключаем экран
        onboardingScreen.style.display = "none";
        chatScreen.style.display = "flex";

        // Создаем стартовую сессию и выводим приветствие
        createNewSession("Стартовый диалог");
        await initSessionGreeting();
        userInput.focus();
    });

    // =========================================================================
    // 10. ПРИКРЕПЛЕНИЕ ДОКУМЕНТОВ И ФОТО (НАТИВНЫЙ API)
    // =========================================================================
    attachBtn.addEventListener("click", () => {
        if (isWaitingForResponse) return;
        attachModal.style.display = "flex";
    });

    const closeAttachModal = () => { attachModal.style.display = "none"; };
    if (closeAttachModalBtn) closeAttachModalBtn.addEventListener("click", closeAttachModal);
    attachModal.addEventListener("click", (e) => {
        if (e.target === attachModal) closeAttachModal();
    });

    modalAttachDocBtn.addEventListener("click", async () => {
        closeAttachModal();
        if (isWaitingForResponse) return;

        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.attach_document === "function") {
            try {
                const res = await window.pywebview.api.attach_document();
                if (res && res.success && !res.cancelled) {
                    renderFileBubble(res, true);
                    renderBotBubble({
                        title: "Свободная память",
                        message: res.bot_reply || `Файл **${res.filename}** успешно загружен в мою свободную память.\n\nКакую задачу или формулу из этого документа разберём методом Сократа?`,
                        source: "Свободная память • ФГОС RAG"
                    }, true);
                }
            } catch (err) {
                console.error("Ошибка прикрепления документа:", err);
            }
        } else {
            // Тестовый fallback для браузера
            const mock = { filename: "uchebnik_fiziki_8kl.pdf", filesize: "520 КБ", type: "document" };
            renderFileBubble(mock, true);
            renderBotBubble({
                message: `Файл **${mock.filename}** успешно загружен в мою свободную память.\n\nКакую задачу или формулу из него мы разберём?`,
                source: "Тестовая свободная память"
            }, true);
        }
    });

    modalAttachPhotoBtn.addEventListener("click", async () => {
        closeAttachModal();
        if (isWaitingForResponse) return;

        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.attach_photo === "function") {
            try {
                const res = await window.pywebview.api.attach_photo();
                if (res && res.success && !res.cancelled) {
                    renderFileBubble(res, true);
                    renderBotBubble({
                        title: "Свободная память",
                        message: res.bot_reply || `Файл **${res.filename}** успешно загружен в мою свободную память.\n\nЯ вижу снимок условия задачи или схемы цепи. Какую величину требуется определить?`,
                        source: "Свободная память • ФГОС RAG"
                    }, true);
                }
            } catch (err) {
                console.error("Ошибка прикрепления фото:", err);
            }
        } else {
            // Тестовый fallback для браузера
            const mock = { filename: "shema_cepi_resistor.png", filesize: "1.4 МБ", type: "photo" };
            renderFileBubble(mock, true);
            renderBotBubble({
                message: `Файл **${mock.filename}** успешно загружен в мою свободную память.\n\nЯ вижу чертёж электрической цепи. Какую величину требуется определить?`,
                source: "Тестовая свободная память"
            }, true);
        }
    });

    // =========================================================================
    // 11. ДЕЙСТВИЯ САЙДБАРА И ШАПКИ
    // =========================================================================
    // Кнопка "Новый диалог"
    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => {
            messagesContainer.innerHTML = "";
            createNewSession("Новый диалог");
            initSessionGreeting();
            userInput.focus();
            if (appSidebar) appSidebar.classList.remove("mobile-open");
        });
    }

    // Кнопка "Очистить"
    if (clearChatBtn) {
        clearChatBtn.addEventListener("click", () => {
            messagesContainer.innerHTML = "";
            let sess = sessions.find(s => s.id === currentSessionId);
            if (sess) {
                sess.messages = [];
                saveSessionsToStorage();
            }
            renderBotBubble({
                title: "Диалог очищен",
                message: `История сообщений текущей сессии очищена, **${currentUsername}**! Твоя локальная приватность защищена.\n\nЗадай мне любой вопрос по школьной программе ФГОС.`,
                source: "Приватность • GPLv3"
            }, true);
        });
    }

    // Модальное окно "О проекте"
    if (aboutBtn) {
        aboutBtn.addEventListener("click", () => { aboutModal.style.display = "flex"; });
    }
    const closeAboutModal = () => { aboutModal.style.display = "none"; };
    if (closeAboutModalBtn) closeAboutModalBtn.addEventListener("click", closeAboutModal);
    if (modalOkBtn) modalOkBtn.addEventListener("click", closeAboutModal);
    aboutModal.addEventListener("click", (e) => {
        if (e.target === aboutModal) closeAboutModal();
    });

    // Кнопка Тукса в шапке
    if (headerTuxBtn) {
        headerTuxBtn.addEventListener("click", () => {
            renderBotBubble(getTuxResponse(), true);
        });
    }

    // Мобильный переключатель сайдбара
    if (mobileMenuToggle && appSidebar) {
        mobileMenuToggle.addEventListener("click", () => {
            appSidebar.classList.toggle("mobile-open");
        });
    }

    // =========================================================================
    // 12. ОБРАБОТЧИКИ ПОЛЯ ВВОДА ТЕКСТА
    // =========================================================================
    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        sendMessage();
    });

    userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    userInput.addEventListener("input", () => {
        userInput.style.height = "auto";
        userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
    });

    // Первоначальный рендер истории сессий
    renderSessionHistory();
});
