import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { marked } from "marked";

export type ApiConfig = {
    endpoint: string;
    apiKey: string;
    provider: "openai" | "lmstudio" | "gpt4all" | "ollama";
};

export function Settings({ config, setConfig, systemPrompt, setSystemPrompt }: {
    config: ApiConfig;
    setConfig: (c: ApiConfig) => void;
    systemPrompt: string;
    setSystemPrompt: (s: string) => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-md">
                <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('settingsTitle')}</h2>
                    <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{t('settingsDesc')}</p>
                </div>
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4 dark:bg-slate-800 dark:border-slate-700">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300" htmlFor="provider">{t('provider')}</label>
                        <select
                            id="provider"
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:ring-blue-900"
                            value={config.provider}
                            onChange={e => setConfig({ ...config, provider: e.target.value as ApiConfig["provider"] })}
                        >
                            <option value="openai">OpenAI</option>
                            <option value="lmstudio">LM Studio</option>
                            <option value="gpt4all">GPT4ALL</option>
                            <option value="ollama">Ollama</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300" htmlFor="endpoint">{t('endpoint')}</label>
                        <input
                            id="endpoint"
                            type="text"
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition placeholder-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-blue-900"
                            value={config.endpoint}
                            onChange={e => setConfig({ ...config, endpoint: e.target.value })}
                            placeholder="https://api.openai.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300" htmlFor="apikey">{t('apiKey')}</label>
                        <input
                            id="apikey"
                            type="password"
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition placeholder-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-blue-900"
                            value={config.apiKey}
                            onChange={e => setConfig({ ...config, apiKey: e.target.value })}
                            placeholder="sk-..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300" htmlFor="systemprompt">{t('systemPrompt')}</label>
                        <textarea
                            id="systemprompt"
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition placeholder-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-blue-900 resize-none"
                            value={systemPrompt}
                            onChange={e => setSystemPrompt(e.target.value)}
                            placeholder={t('systemPromptPlaceholder')}
                            rows={3}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function Minimap({
    messages,
    scrollContainerRef,
    messageRefs,
}: {
    messages: { role: string; content: string }[];
    scrollContainerRef: { current: HTMLDivElement | null };
    messageRefs: { current: (HTMLDivElement | null)[] };
}) {
    const { t } = useTranslation();
    const [scroll, setScroll] = useState({ ratio: 0, viewSize: 1 });

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const update = () => {
            const canScroll = el.scrollHeight - el.clientHeight;
            setScroll({
                ratio: canScroll > 0 ? el.scrollTop / canScroll : 0,
                viewSize: el.scrollHeight > 0 ? el.clientHeight / el.scrollHeight : 1,
            });
        };
        update();
        el.addEventListener('scroll', update, { passive: true });
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => {
            el.removeEventListener('scroll', update);
            ro.disconnect();
        };
    }, [scrollContainerRef, messages]);

    const onClickMessage = (i: number) => {
        messageRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    return (
        <div className="relative w-5 bg-slate-50 border-l border-slate-200 overflow-hidden h-full dark:bg-slate-800 dark:border-slate-700">
            <div className="absolute inset-0 flex flex-col gap-[2px]">
                {messages.map((m, i) => (
                    <button
                        key={i}
                        onClick={() => onClickMessage(i)}
                        title={`${m.role === 'user' ? t('you') : t('ai')}: ${m.content.slice(0, 40)}`}
                        className={`flex-1 cursor-pointer transition-opacity hover:opacity-100 opacity-60 border-none outline-none
                            ${m.role === 'user' ? 'bg-blue-400' : 'bg-slate-300 dark:bg-slate-600'}`}
                        style={{ minHeight: '2px' }}
                    />
                ))}
            </div>
            {scroll.viewSize < 1 && (
                <div
                    className="absolute left-0 right-0 border-2 border-blue-500 rounded pointer-events-none"
                    style={{
                        top: `${scroll.ratio * (1 - scroll.viewSize) * 100}%`,
                        height: `${scroll.viewSize * 100}%`,
                    }}
                />
            )}
        </div>
    );
}

export function Chat({ config, systemPrompt }: { config: ApiConfig; systemPrompt: string }) {
    const { t } = useTranslation();
    const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [atBottom, setAtBottom] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const check = () => {
            setAtBottom(el.scrollHeight - el.clientHeight - el.scrollTop < 40);
        };
        check();
        el.addEventListener('scroll', check, { passive: true });
        const ro = new ResizeObserver(check);
        ro.observe(el);
        return () => {
            el.removeEventListener('scroll', check);
            ro.disconnect();
        };
    }, [messages, loading]);

    async function sendMessage() {
        if (!input || loading) return;
        const userInput = input;
        setInput("");
        setLoading(true);
        setMessages(prev => [...prev, { role: "user", content: userInput }]);
        try {
            const res = await fetch(config.endpoint + "/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(config.apiKey ? { "Authorization": `Bearer ${config.apiKey}` } : {})
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [
                        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
                        ...messages,
                        { role: "user", content: userInput },
                    ],
                })
            });
            const data = await res.json();
            const aiMsg = data.choices?.[0]?.message?.content || "(no response)";
            setMessages(prev => [...prev, { role: "assistant", content: aiMsg }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: "assistant", content: t('error') + String(e) }]);
        }
        setLoading(false);
    }

    const minimapTarget = document.getElementById('minimap-portal');

    return (
        <div className="flex flex-col flex-1 relative">
            <div className="border-b border-slate-100 px-4 py-3 text-center dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('hint')}</p>
            </div>

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
                {messages.length === 0 && !loading && (
                    <div className="flex items-center justify-center pt-16">
                        <p className="text-slate-400 text-sm">{t('empty')}</p>
                    </div>
                )}
                {messages.map((m, i) => {
                    const isUser = m.role === "user";
                    return (
                        <div key={i} ref={el => { messageRefs.current[i] = el; }} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl shadow-sm ${isUser
                                ? 'bg-blue-600 text-white rounded-br-sm'
                                : 'bg-slate-100 text-slate-800 rounded-bl-sm dark:bg-slate-700 dark:text-slate-100'
                                }`}>
                                <div className={`text-xs font-semibold mb-0.5 ${isUser ? 'text-blue-200' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {isUser ? t('you') : t('ai')}
                                </div>
                                <div className="whitespace-pre-wrap break-words leading-relaxed">
                                    <span dangerouslySetInnerHTML={{ __html: marked.parse(m.content) as string }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm inline-flex gap-1 dark:bg-slate-700">
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
                <div ref={scrollRef} />
            </div>

            {!atBottom && (
                <button
                    onClick={() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    title={t('scrollToLatest')}
                    className="absolute bottom-40 right-40 z-10 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex items-center justify-center shadow-lg transition"
                >
                    ↓
                </button>
            )}

            <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-5 py-1.5 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition dark:bg-slate-700 dark:border-slate-600 dark:focus-within:ring-blue-900">
                    <input
                        type="text"
                        className="flex-1 min-w-0 bg-transparent outline-none text-slate-800 placeholder-slate-400 text-sm py-1.5 dark:text-slate-100 dark:placeholder-slate-500"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        disabled={loading}
                        onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
                        placeholder={t('placeholder')}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={loading || !input}
                        className="shrink-0 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex items-center justify-center shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        ⇧
                    </button>
                </div>
            </div>

            {messages.length > 0 && minimapTarget && createPortal(
                <Minimap messages={messages} scrollContainerRef={scrollContainerRef} messageRefs={messageRefs} />,
                minimapTarget
            )}

        </div>
    );
}
