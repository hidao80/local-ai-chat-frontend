(function () {
    var root = document.documentElement;
    var select = document.getElementById("langSelect");
    var supported = ["ja", "en", "zh"];

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
        return "en";
    }

    function apply(lang) {
        if (supported.indexOf(lang) === -1) lang = "en";
        root.dataset.lang = lang;
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
})();
