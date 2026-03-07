'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    meta?: { txCount: number; dateFrom: string; dateTo: string; provider: string; model: string };
    error?: boolean;
}

interface Session {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

function renderMarkdown(text: string) {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (line.startsWith('|') && lines[i + 1]?.match(/^\|[-| :]+\|$/)) {
            const hdrs = line.split('|').filter(c => c.trim()).map(c => c.trim());
            i += 2;
            const rows: string[][] = [];
            while (i < lines.length && lines[i].startsWith('|')) {
                rows.push(lines[i].split('|').filter(c => c.trim()).map(c => c.trim()));
                i++;
            }
            elements.push(
                <div key={i} style={{ overflowX: 'auto', margin: '10px 0' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
                        <thead>
                            <tr>{hdrs.map((h, j) => <th key={j} style={{ padding: '7px 14px', borderBottom: '2px solid #334155', textAlign: 'left', whiteSpace: 'nowrap', color: '#f1f5f9', background: '#1e293b' }}>{formatInline(h)}</th>)}</tr>
                        </thead>
                        <tbody>
                            {rows.map((row, ri) => (
                                <tr key={ri} style={{ borderBottom: '1px solid #334155', background: ri % 2 === 0 ? '#1e293b' : '#0f172a' }}>
                                    {row.map((cell, ci) => <td key={ci} style={{ padding: '6px 14px', whiteSpace: 'nowrap', color: '#e2e8f0' }}>{formatInline(cell)}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            continue;
        }

        if (line.startsWith('### ')) { elements.push(<div key={i} style={{ fontWeight: 700, fontSize: 13, marginTop: 14, marginBottom: 4, color: 'var(--text)' }}>{formatInline(line.slice(4))}</div>); i++; continue; }
        if (line.startsWith('## ')) { elements.push(<div key={i} style={{ fontWeight: 700, fontSize: 15, marginTop: 16, marginBottom: 6, color: 'var(--text)' }}>{formatInline(line.slice(3))}</div>); i++; continue; }
        if (line.startsWith('# ')) { elements.push(<div key={i} style={{ fontWeight: 700, fontSize: 16, marginTop: 18, marginBottom: 8, color: 'var(--text)' }}>{formatInline(line.slice(2))}</div>); i++; continue; }

        if (line.match(/^[-*] /)) {
            const items: string[] = [];
            while (i < lines.length && lines[i].match(/^[-*] /)) { items.push(lines[i].slice(2)); i++; }
            elements.push(<ul key={i} style={{ margin: '8px 0', paddingLeft: 22 }}>{items.map((it, j) => <li key={j} style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', marginBottom: 2 }}>{formatInline(it)}</li>)}</ul>);
            continue;
        }

        if (line.match(/^\d+\. /)) {
            const items: string[] = [];
            while (i < lines.length && lines[i].match(/^\d+\. /)) { items.push(lines[i].replace(/^\d+\. /, '')); i++; }
            elements.push(<ol key={i} style={{ margin: '8px 0', paddingLeft: 22 }}>{items.map((it, j) => <li key={j} style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', marginBottom: 2 }}>{formatInline(it)}</li>)}</ol>);
            continue;
        }

        if (line.startsWith('```')) {
            i++;
            const codeLines: string[] = [];
            while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
            i++;
            elements.push(<pre key={i} style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: 8, padding: '12px 16px', fontSize: 12, overflowX: 'auto', margin: '10px 0', whiteSpace: 'pre', border: '1px solid #334155' }}>{codeLines.join('\n')}</pre>);
            continue;
        }

        if (line === '---') { elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />); i++; continue; }
        if (line.trim() === '') { elements.push(<div key={i} style={{ height: 8 }} />); i++; continue; }

        elements.push(<div key={i} style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>{formatInline(line)}</div>);
        i++;
    }
    return elements;
}

function formatInline(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i} style={{ background: '#1e293b', color: '#7dd3fc', padding: '1px 6px', borderRadius: 4, fontSize: '0.9em', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
        return part;
    });
}

function formatRelativeDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Heute';
    if (diffDays === 1) return 'Gestern';
    if (diffDays < 7) return `Vor ${diffDays} Tagen`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const PROVIDER_LABEL: Record<string, string> = { gemini: 'Gemini', claude: 'Claude', openai: 'GPT' };

const SUGGESTIONS = [
    'Wie ist unser aktueller Saldo?',
    'Welche Kategorie hat die höchsten Ausgaben?',
    'Zeig mir die Ausgaben des letzten Monats.',
    'Was waren die größten Einzelbuchungen?',
];

export default function ChatClient() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const hasMessages = messages.length > 0 || loading;

    // Load sessions on mount
    useEffect(() => {
        fetch('/api/chat/sessions')
            .then(r => r.json())
            .then(data => { if (Array.isArray(data)) setSessions(data); })
            .catch(() => {});
    }, []);

    useEffect(() => { inputRef.current?.focus(); }, []);

    useEffect(() => {
        if (hasMessages) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading, hasMessages]);

    function startNewChat() {
        setMessages([]);
        setInput('');
        setCurrentSessionId(null);
        setTimeout(() => inputRef.current?.focus(), 50);
    }

    async function loadSession(session: Session) {
        const res = await fetch(`/api/chat/sessions/${session.id}`);
        if (!res.ok) return;
        const data = await res.json();
        setMessages(data.messages ?? []);
        setCurrentSessionId(session.id);
    }

    async function deleteSession(id: string, e: React.MouseEvent) {
        e.stopPropagation();
        setDeletingId(id);
        await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' });
        setSessions(prev => prev.filter(s => s.id !== id));
        if (currentSessionId === id) startNewChat();
        setDeletingId(null);
    }

    const saveSession = useCallback(async (msgs: Message[], sessionId: string | null): Promise<string> => {
        if (sessionId) {
            await fetch(`/api/chat/sessions/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: msgs }),
            });
            setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, updated_at: new Date().toISOString() } : s));
            return sessionId;
        } else {
            const firstUserMsg = msgs.find(m => m.role === 'user')?.content ?? 'Neuer Chat';
            const title = firstUserMsg.length > 55 ? firstUserMsg.slice(0, 55) + '…' : firstUserMsg;
            const res = await fetch('/api/chat/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, messages: msgs }),
            });
            const data = await res.json();
            const newId = data.id;
            setSessions(prev => [{ id: newId, title, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...prev]);
            setCurrentSessionId(newId);
            return newId;
        }
    }, []);

    async function send(text?: string) {
        const msg = (text ?? input).trim();
        if (!msg || loading) return;

        const userMsg: Message = { role: 'user', content: msg };
        const history = [...messages.filter(m => !m.error), userMsg];
        setMessages(prev => [...prev.filter(m => !m.error), userMsg]);
        setInput('');
        setLoading(true);

        if (inputRef.current) inputRef.current.style.height = 'auto';

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: history.map(m => ({ role: m.role, content: m.content })),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Fehler');
            const assistantMsg: Message = { role: 'assistant', content: data.reply, meta: data.meta };
            const updatedMessages = [...history, assistantMsg];
            setMessages(updatedMessages);
            await saveSession(updatedMessages, currentSessionId);
        } catch (err: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${err.message}`, error: true }]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    }

    const inputBar = (
        <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 236) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder="Stell eine Frage zu den Pankonauten-Finanzen… (Enter zum Senden)"
            rows={1}
            disabled={loading}
            style={{
                width: '100%', padding: '13px 18px', borderRadius: 14,
                border: '2px solid var(--border)',
                background: 'var(--card)',
                fontSize: 14, color: 'var(--text)', resize: 'none', outline: 'none',
                fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box',
                transition: 'border-color 0.15s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
        />
    );

    return (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, height: '100%', gap: 0 }}>

            {/* ── Sessions Sidebar ── */}
            <div style={{
                width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
                borderRight: '1px solid var(--border)', paddingRight: 0, overflowY: 'auto',
                background: 'var(--bg-secondary)',
            }}>
                {/* New Chat Button */}
                <div style={{ padding: '16px 12px 12px' }}>
                    <button
                        onClick={startNewChat}
                        style={{
                            width: '100%', padding: '10px 14px', borderRadius: 10,
                            border: '1.5px solid var(--border)',
                            background: currentSessionId === null && !hasMessages ? 'var(--primary)' : 'var(--card)',
                            color: currentSessionId === null && !hasMessages ? '#fff' : 'var(--text)',
                            fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8,
                            transition: 'all 0.15s', fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => {
                            if (currentSessionId !== null || hasMessages) {
                                (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)';
                                (e.currentTarget as HTMLElement).style.color = 'var(--primary)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (currentSessionId !== null || hasMessages) {
                                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                                (e.currentTarget as HTMLElement).style.color = 'var(--text)';
                            }
                        }}
                    >
                        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                        Neuer Chat
                    </button>
                </div>

                {/* Session list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
                    {sessions.length === 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 24, lineHeight: 1.6 }}>
                            Noch keine gespeicherten Chats
                        </div>
                    )}
                    {sessions.map(s => (
                        <div
                            key={s.id}
                            onClick={() => loadSession(s)}
                            style={{
                                padding: '10px 12px', borderRadius: 8, marginBottom: 4,
                                background: currentSessionId === s.id ? 'var(--card)' : 'transparent',
                                border: currentSessionId === s.id ? '1px solid var(--border)' : '1px solid transparent',
                                cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3,
                                transition: 'background 0.12s', position: 'relative',
                            }}
                            onMouseEnter={e => {
                                if (currentSessionId !== s.id) (e.currentTarget as HTMLElement).style.background = 'var(--card)';
                                const btn = e.currentTarget.querySelector('.del-btn') as HTMLElement;
                                if (btn) btn.style.opacity = '1';
                            }}
                            onMouseLeave={e => {
                                if (currentSessionId !== s.id) (e.currentTarget as HTMLElement).style.background = 'transparent';
                                const btn = e.currentTarget.querySelector('.del-btn') as HTMLElement;
                                if (btn) btn.style.opacity = '0';
                            }}
                        >
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', paddingRight: 20 }}>
                                {s.title}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {formatRelativeDate(s.updated_at)}
                            </div>
                            <button
                                className="del-btn"
                                onClick={e => deleteSession(s.id, e)}
                                disabled={deletingId === s.id}
                                style={{
                                    position: 'absolute', top: 8, right: 8,
                                    width: 22, height: 22, borderRadius: 6,
                                    border: 'none', background: 'transparent',
                                    color: 'var(--text-muted)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 14, opacity: 0, transition: 'opacity 0.1s, color 0.1s',
                                    padding: 0,
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                                title="Chat löschen"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Chat Area ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>

                {/* Empty state */}
                {!hasMessages && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
                        <div style={{ width: '100%', maxWidth: 680 }}>
                            <div style={{ textAlign: 'center', marginBottom: 36 }}>
                                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 14px' }}>✦</div>
                                <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 6, color: 'var(--text)' }}>Finanz-Assistent</div>
                                <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Fragen zu den Kita-Finanzen – beantwortet aus Dashboard-Daten</div>
                            </div>
                            {inputBar}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                                {SUGGESTIONS.map(s => (
                                    <button key={s} onClick={() => send(s)} style={{
                                        padding: '8px 16px', borderRadius: 20, border: '1.5px solid var(--border)',
                                        background: 'var(--bg)', color: 'var(--text)', fontSize: 13, cursor: 'pointer',
                                        transition: 'border-color 0.15s, background 0.15s', fontFamily: 'inherit',
                                    }}
                                        onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'var(--primary)'; (e.target as HTMLElement).style.background = 'var(--card)'; }}
                                        onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; (e.target as HTMLElement).style.background = 'var(--bg)'; }}
                                    >{s}</button>
                                ))}
                            </div>
                            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                Hallo! Ich bin dein Finanz-Assistent für die Kita Pankonauten. Ich beantworte Fragen <strong>ausschließlich</strong> auf Basis der Daten in diesem Dashboard – keine externen Quellen.
                            </div>
                        </div>
                    </div>
                )}

                {/* Active chat */}
                {hasMessages && (
                    <>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 16px' }}>
                            <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {messages.map((msg, i) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                        alignItems: 'flex-start',
                                        gap: 12,
                                        padding: '6px 0',
                                    }}>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                                            background: msg.role === 'user' ? 'var(--card)' : 'var(--primary)',
                                            border: msg.role === 'user' ? '1.5px solid var(--primary)' : 'none',
                                            color: msg.role === 'user' ? 'var(--primary)' : '#fff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: msg.role === 'user' ? 13 : 15, fontWeight: 700,
                                        }}>
                                            {msg.role === 'user' ? 'Du' : '✦'}
                                        </div>
                                        <div style={{ maxWidth: '80%' }}>
                                            <div style={{
                                                padding: '12px 16px',
                                                borderRadius: msg.role === 'user' ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                                                background: msg.role === 'user' ? 'var(--card)' : msg.error ? '#fef2f2' : 'var(--card)',
                                                color: msg.error ? '#dc2626' : 'var(--text)',
                                                border: msg.role === 'user'
                                                    ? '1.5px solid var(--primary)'
                                                    : `1.5px solid ${msg.error ? '#fecaca' : 'var(--border)'}`,
                                                boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                                            }}>
                                                {msg.role === 'user'
                                                    ? <div style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', fontWeight: 500 }}>{msg.content}</div>
                                                    : <div>{renderMarkdown(msg.content)}</div>
                                                }
                                            </div>
                                            {msg.meta && (
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, paddingLeft: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                                    <span>📊 {msg.meta.txCount} Buchungen · {msg.meta.dateFrom} – {msg.meta.dateTo}</span>
                                                    <span style={{ opacity: 0.65 }}>{PROVIDER_LABEL[msg.meta.provider] ?? msg.meta.provider} · {msg.meta.model}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {loading && (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '6px 0' }}>
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, marginTop: 2 }}>✦</div>
                                        <div style={{ padding: '14px 18px', borderRadius: '4px 18px 18px 18px', background: 'var(--card)', border: '1.5px solid var(--border)', display: 'flex', gap: 6, alignItems: 'center' }}>
                                            {[0, 1, 2].map(j => (
                                                <div key={j} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)', animation: 'chatPulse 1.2s ease-in-out infinite', animationDelay: `${j * 0.2}s` }} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div ref={bottomRef} />
                            </div>
                        </div>

                        {/* Input pinned to bottom */}
                        <div style={{ padding: '12px 24px 0', borderTop: '1px solid var(--border)' }}>
                            <div style={{ maxWidth: 720, margin: '0 auto' }}>
                                {inputBar}
                                <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                                    Antworten basieren ausschließlich auf Dashboard-Daten
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <style>{`
                @keyframes chatPulse {
                    0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
                    40% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
