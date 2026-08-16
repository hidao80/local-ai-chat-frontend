(function () {
    var root = document.documentElement;
    var select = document.getElementById("langSelect");
    var supported = ["ja", "en", "zh", "es", "ru"];

    var i18nMeta = {
        ja: {
            title: "local-ai-chat-frontend — プライバシー重視のローカルLLMチャットUI",
            description: "Ollama / GPT4ALL / LM Studio / llama.cpp / OpenAI に対応した、ブラウザだけで動くプライバシー重視のチャットUI。バックエンドはお好きなローカルLLMプロバイダーを自由に選択、npx一発起動。",
        },
        en: {
            title: "local-ai-chat-frontend — Privacy-first Local LLM Chat UI",
            description: "A privacy-first chat UI that runs entirely in your browser — bring your own local LLM provider as the backend. Supports Ollama, GPT4ALL, LM Studio, llama.cpp, and OpenAI. Launch instantly with npx.",
        },
        zh: {
            title: "local-ai-chat-frontend — 注重隐私的本地LLM聊天界面",
            description: "支持 Ollama / GPT4ALL / LM Studio / llama.cpp / OpenAI 的纯浏览器端隐私优先聊天界面。后端由你自由选择本地 LLM 提供商，npx 一键启动。",
        },
        es: {
            title: "local-ai-chat-frontend — Chat UI local con LLM centrado en la privacidad",
            description: "Una interfaz de chat centrada en la privacidad que se ejecuta enteramente en tu navegador — trae tu propio proveedor de LLM local como backend. Compatible con Ollama, GPT4ALL, LM Studio, llama.cpp y OpenAI. Se inicia al instante con npx.",
        },
        ru: {
            title: "local-ai-chat-frontend — Приватный чат-интерфейс для локальных LLM",
            description: "Чат-интерфейс с приоритетом приватности, работающий полностью в вашем браузере — подключите свой локальный провайдер LLM в качестве бэкенда. Поддерживает Ollama, GPT4ALL, LM Studio, llama.cpp и OpenAI. Мгновенный запуск через npx.",
        },
    };

    var store = {
        get: function () {
            try {
                return localStorage.getItem("lac_landing_lang");
            } catch (e) {
                return null;
            }
        },
        set: function (v) {
            try {
                localStorage.setItem("lac_landing_lang", v);
            } catch (e) {
                /* ignore */
            }
        },
    };

    function detectLang() {
        var saved = store.get();
        if (saved && supported.indexOf(saved) !== -1) return saved;
        var nav = (navigator.language || "en").toLowerCase();
        if (nav.indexOf("ja") === 0) return "ja";
        if (nav.indexOf("zh") === 0) return "zh";
        if (nav.indexOf("es") === 0) return "es";
        if (nav.indexOf("ru") === 0) return "ru";
        return "en";
    }

    var ml = new MultilanguageJS({
        languages: supported,
        defaultLanguage: "en",
    });

    function apply(lang) {
        if (supported.indexOf(lang) === -1) lang = "en";
        ml.setLanguage(lang);
        root.lang = lang;
        var meta = i18nMeta[lang];
        document.title = meta.title;
        var descTag = document.querySelector('meta[name="description"]');
        if (descTag) descTag.setAttribute("content", meta.description);
        if (select) select.value = lang;
    }

    var initial = detectLang();
    apply(initial);

    if (select) {
        select.addEventListener("change", function () {
            apply(select.value);
            store.set(select.value);
        });
    }

    document.querySelectorAll(".copy-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var code = btn.closest(".code-row").querySelector("code");
            navigator.clipboard.writeText(code.textContent).then(function () {
                btn.classList.add("copied");
                btn.querySelector(".icon-copy").hidden = true;
                btn.querySelector(".icon-check").hidden = false;
                setTimeout(function () {
                    btn.classList.remove("copied");
                    btn.querySelector(".icon-copy").hidden = false;
                    btn.querySelector(".icon-check").hidden = true;
                }, 1500);
            });
        });
    });
})();
