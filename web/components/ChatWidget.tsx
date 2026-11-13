"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

interface M { role: "user" | "assistant"; content: string; images?: { url: string; caption: string }[]; sources?: { title: string; url: string }[] }

const STARTERS = ["Plan a birthday for 15 friends", "Hangout spots in Lagos under 10k each", "How does a group pot work?", "Is this message a scam?"];

/** Very small markdown: bold and list bullets, safely escaped. */
function render(t: string) {
  const esc = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^#{1,4}\s*(.+)$/gm, "<b>$1</b>").replace(/^\s*[-*•]\s+/gm, "• ").replace(/\(link: (https?:\/\/[^\s)]+)\)/g, '<a href="$1" target="_blank" rel="noreferrer">link</a>').replace(/\n/g, "<br/>");
}

export default function ChatWidget() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<M[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pot = path?.startsWith("/groups/") ? Number(path.split("/")[2]) : null;
  // The logo button tucks half into the edge while you scroll, so it never covers content.
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    const onScroll = () => {
      setTucked(true);
      clearTimeout(timer);
      timer = window.setTimeout(() => setTucked(false), 1400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("pause-chat");
      if (saved) setMsgs(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem("pause-chat", JSON.stringify(msgs.slice(-30)));
    } catch {}
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const q = (e as CustomEvent<string>).detail;
      if (q) send(q);
    };
    window.addEventListener("pause-chat", onOpen);
    return () => window.removeEventListener("pause-chat", onOpen);
  });

  const send = async (q: string) => {
    const content = q.trim();
    if (!content || busy) return;
    const next = [...msgs, { role: "user" as const, content }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })), pot: Number.isFinite(pot) ? pot : null }) });
      const d = await r.json();
      setMsgs([...next, { role: "assistant", content: d.reply ?? d.error ?? "Sorry, I didn't catch that.", images: d.images ?? [], sources: d.sources ?? [] }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "I couldn't reach the network. Please try again." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className={`chat-fab ${open ? "is-folded" : tucked ? "is-tucked" : ""}`}
        onClick={() => { setTucked(false); setOpen(true); }}
        aria-expanded={open}
        aria-controls="pause-chat"
        aria-label="Ask Pause"
        tabIndex={open ? -1 : 0}
      >
        <Image src="/img/logo-mark.png" alt="" width={64} height={64} priority />
        <span className="chat-fab-label">Ask Pause</span>
      </button>
      {open && (
        <section id="pause-chat" className="chat-panel" role="dialog" aria-label="Chat with Pause">
          <header className="chat-head">
            <Image className="chat-logo" src="/img/logo-mark.png" alt="" width={36} height={36} />
            <div>
              <b>Pause</b>
              <span className="muted small">Plans, saves, pays and protects{pot !== null && Number.isFinite(pot) ? ` · knows pot #${pot}` : ""}</span>
            </div>
            <button className="chat-x" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
          </header>
          <div className="chat-list" ref={listRef} aria-live="polite">
            {msgs.length === 0 && (
              <div className="chat-hello">
                <p>Hi! I&apos;m Pause. I can help your group plan an event, set a budget, collect everyone&apos;s share and pay vendors safely. What are you planning?</p>
                <div className="quick">
                  {STARTERS.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`fmsg ${m.role === "user" ? "me" : "bot"}`}>
                <div className="fbubble">
                  <span dangerouslySetInnerHTML={{ __html: render(m.content) }} />
                  {m.images && m.images.length > 0 && (
                    <div className="chat-photos">
                      {m.images.map((im) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a key={im.url} href={im.url} target="_blank" rel="noreferrer"><img src={im.url} alt={im.caption || "Photo from the web"} loading="lazy" referrerPolicy="no-referrer" onError={(e) => ((e.currentTarget.parentElement as HTMLElement).style.display = "none")} /></a>
                      ))}
                    </div>
                  )}
                  {m.sources && m.sources.length > 0 && (
                    <div className="chat-sources">{m.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</div>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="fmsg bot"><div className="fbubble typing">Pause is typing…</div></div>}
          </div>
          <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input aria-label="Message Pause" placeholder="Message Pause…" value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="send" />
            <button className="btn small-btn primary" disabled={busy || !text.trim()}>Send</button>
          </form>
        </section>
      )}
    </>
  );
}
