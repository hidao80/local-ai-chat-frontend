import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Message } from "../lib/chatStorage";

/** Vertical minimap of the chat: one bar per message, click-to-scroll, with a viewport indicator. */
export function Minimap({
  messages,
  scrollContainerRef,
  messageRefs,
}: {
  messages: Message[];
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
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [scrollContainerRef]);

  const onClickMessage = (i: number) => {
    messageRefs.current[i]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  return (
    <div className="relative w-5 bg-slate-50 border-l border-slate-200 overflow-hidden h-full dark:bg-slate-800 dark:border-slate-700">
      <div className="absolute inset-0 flex flex-col gap-[2px]">
        {messages.map((m, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: Message has no unique id; the list is append-only (no reorder/delete), so index is stable here.
            key={i}
            type="button"
            onClick={() => onClickMessage(i)}
            title={`${m.role === "user" ? t("you") : t("ai")}: ${m.content.slice(0, 40)}`}
            className={`flex-1 cursor-pointer transition-opacity hover:opacity-100 opacity-60 border-none outline-none
                            ${m.role === "user" ? "bg-blue-400" : "bg-slate-300 dark:bg-slate-600"}`}
            style={{ minHeight: "2px" }}
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
