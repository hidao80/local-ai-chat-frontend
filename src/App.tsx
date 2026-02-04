

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Chat, Settings } from "./components/ChatAndSettings";
import type { ApiConfig } from "./components/ChatAndSettings";

type StoredConfig = ApiConfig & {
  systemPrompt?: string;
  lang?: string;
  dark?: boolean;
};

const DB_NAME = "ai-chat-config";
const STORE_NAME = "config";

function saveConfigToDB(config: StoredConfig) {
  const req = window.indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = function () {
    req.result.createObjectStore(STORE_NAME);
  };
  req.onsuccess = function () {
    const db = req.result;
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(config, "main");
    tx.oncomplete = () => db.close();
  };
}

function loadConfigFromDB(callback: (c: StoredConfig) => void) {
  const req = window.indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = function () {
    req.result.createObjectStore(STORE_NAME);
  };
  req.onsuccess = function () {
    const db = req.result;
    const tx = db.transaction(STORE_NAME, "readonly");
    const getReq = tx.objectStore(STORE_NAME).get("main");
    getReq.onsuccess = function () {
      if (getReq.result) callback(getReq.result);
      db.close();
    };
  };
}

function App() {
  const { t, i18n } = useTranslation();
  const [config, setConfig] = useState<ApiConfig>({
    endpoint: "https://api.openai.com",
    apiKey: "",
    provider: "openai"
  });
  const [showSettings, setShowSettings] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [dark, setDark] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (navRef.current) {
      document.documentElement.style.setProperty('--nav-h', navRef.current.offsetHeight + 'px');
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  function toggleLang() {
    const next = i18n.language === 'ja' ? 'en' : 'ja';
    i18n.changeLanguage(next);
    saveConfigToDB({ ...config, systemPrompt, lang: next, dark });
  }

  useEffect(() => {
    loadConfigFromDB((loaded) => {
      const { systemPrompt: sp, lang, dark: d, ...apiConfig } = loaded;
      setConfig((prev) => ({ ...prev, ...apiConfig }));
      if (sp !== undefined) setSystemPrompt(sp);
      if (lang) i18n.changeLanguage(lang);
      if (d !== undefined) setDark(d);
    });
  }, [i18n]);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    saveConfigToDB({ ...config, systemPrompt, lang: i18n.language, dark: next });
  }

  function handleToggle() {
    if (showSettings) {
      saveConfigToDB({ ...config, systemPrompt, lang: i18n.language, dark });
    }
    setShowSettings((s) => !s);
  }

  return (
    <div className="min-h-screen text-slate-50 via-blue-50 dark:bg-slate-950">
      <nav ref={navRef} className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-white/30 shadow-sm px-6 py-3 flex items-center justify-between dark:bg-slate-900/80 dark:border-slate-800">
        <span className="text-lg font-bold text-blue-600">
          Chat-FE
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLang}
            className="text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {i18n.language === 'ja' ? 'EN' : 'JA'}
          </button>
          <button
            onClick={toggleDark}
            className="text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {dark ? '☀' : '☽'}
          </button>
          <button
            onClick={handleToggle}
            className={`text-sm font-medium px-4 py-1.5 rounded-full border transition-colors ${showSettings
              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700'
              }`}
          >
            {showSettings ? t('toChat') : `⚙ ${t('toSettings')}`}
          </button>
        </div>
      </nav>
      <main className="flex justify-center px-4 py-6 md:py-8">
        <div id="minimap-portal" className="fixed right-4 w-5" style={{ top: 'var(--nav-h)', height: 'calc(100dvh - var(--nav-h))' }} />
        <div className="w-full max-w-2xl">
          <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-white/40 shadow-xl overflow-hidden flex flex-col dark:bg-slate-900/85 dark:border-slate-800/40" style={{ minHeight: '70vh' }}>
            {showSettings ? (
              <Settings config={config} setConfig={setConfig} systemPrompt={systemPrompt} setSystemPrompt={setSystemPrompt} />
            ) : (
              <Chat config={config} systemPrompt={systemPrompt} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
