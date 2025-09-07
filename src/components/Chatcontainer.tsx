'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import React, { useEffect, useState } from 'react';
import MarkdownMessage from './MarkdownMessage';
// 去除图标与表情，保留更克制的文本与按钮

type Props = {}

const Chatcontainer = (props: Props) => {

   //向/api/chat发送请求
    const { messages, sendMessage, status } = useChat({
      transport: new DefaultChatTransport({
        api: '/api/chat',
      }),
    });

    const [input, setInput] = useState('');
    const [messageTimes, setMessageTimes] = useState<Record<string, string>>({});
    const [sourcesMap, setSourcesMap] = useState<Record<string, any[]>>({});

    // 记录每条消息首次出现的时间，确保时间戳稳定
    useEffect(() => {
      const next = { ...messageTimes };
      let changed = false;
      for (const m of messages) {
        if (!next[m.id]) {
          const d = new Date();
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          next[m.id] = `${hh}:${mm}`;
          changed = true;
        }
      }
      if (changed) setMessageTimes(next);
    }, [messages]);

    // 为没有来源的助手消息做前端回补：用其之前的最后一条用户问题去 /api/context 检索
    useEffect(() => {
      if (!messages || messages.length === 0) return;

      messages.forEach((m, idx) => {
        if (m.role === 'user') return;
        const hasServer = Array.isArray((m as any).providerMetadata?.sources) && (m as any).providerMetadata.sources.length > 0;
        const hasClient = Array.isArray(sourcesMap[m.id]) && sourcesMap[m.id].length > 0;
        if (hasServer || hasClient) return;

        // 找到这条助手消息之前的最后一条用户文本
        let queryText = '';
        for (let i = idx - 1; i >= 0; i--) {
          const prev = messages[i];
          if (prev.role === 'user') {
            for (const p of (prev as any).parts || []) {
              if (p?.type === 'text' && typeof p.text === 'string') queryText += p.text;
            }
            break;
          }
        }
        if (!queryText.trim()) return;

        fetch('/api/context', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query: queryText })
        })
          .then(r => r.json())
          .then(data => {
            const sources = Array.isArray(data?.sources) ? data.sources : [];
            if (sources.length > 0) {
              setSourcesMap(prev => ({ ...prev, [m.id]: sources }));
            }
          })
          .catch(() => {});
      });
    }, [messages, sourcesMap]);

    // 文本域自适应高度：每次输入时根据内容调整高度，最多 6 行
    const handleTextareaInput = (el: HTMLTextAreaElement | null) => {
      if (!el) return;
      el.style.height = 'auto';
      const lineHeight = 24; // 约等于 tailwind 中 py-3 的可视行高
      const maxHeight = lineHeight * 6;
      el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
    };
  
    return (
      <div className="h-full w-full flex flex-col">
        {/* 聊天消息区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-academic">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="glass-effect rounded-3xl p-8 max-w-xl text-center">
                <h3 className="text-base font-semibold text-foreground mb-2">欢迎使用AI知识库助手</h3>
                <p className="text-muted-foreground text-sm">上传文档后开始提问，系统将基于知识库进行学术风回答。</p>
              </div>
            </div>
          ) : (
            messages.map(message => (
              <div 
                key={message.id} 
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* 消息内容 */}
                <div 
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    message.role === 'user' 
                      ? 'glass-card bg-primary/5 text-foreground ml-auto' 
                      : 'glass-card bg-card/60 text-card-foreground'
                  } hover-lift`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[11px] font-medium text-muted-foreground">{message.role === 'user' ? '您' : '系统'}</div>
                    <div className="text-[10px] text-muted-foreground/80">{messageTimes[message.id]}</div>
                  </div>
                  <div className="text-sm leading-relaxed">
                    {message.parts.map((part, index) =>
                      part.type === 'text' ? <MarkdownMessage key={index} content={part.text} /> : null,
                    )}
                  </div>
                  {/* 折叠详情：展示检索片段（仅助手消息） */}
                  {message.role !== 'user' && (
                    <details className="mt-2 group">
                      <summary className="list-none text-xs text-muted-foreground cursor-pointer select-none hover:underline">
                        来源与依据
                      </summary>
                      <div className="mt-2 space-y-2">
                        {Array.isArray((message as any).providerMetadata?.sources) && (message as any).providerMetadata.sources.length > 0 ? (
                          (message as any).providerMetadata.sources.map((s: any, i: number) => (
                            <div key={i} className="rounded-lg border border-border/40 p-2 text-xs">
                              <div className="font-medium text-foreground/90">{s?.metadata?.title || s?.metadata?.file_name || `片段 ${i+1}`}</div>
                              {s?.metadata?.page && (
                                <div className="text-muted-foreground">页码: {s.metadata.page}</div>
                              )}
                              {s?.metadata?.text && (
                                <div className="mt-1 text-muted-foreground/90 line-clamp-4">{s.metadata.text}</div>
                              )}
                            </div>
                          ))
                        ) : Array.isArray(sourcesMap[message.id]) && sourcesMap[message.id].length > 0 ? (
                          sourcesMap[message.id].map((s: any, i: number) => (
                            <div key={i} className="rounded-lg border border-border/40 p-2 text-xs">
                              <div className="font-medium text-foreground/90">{s?.metadata?.title || s?.metadata?.file_name || `片段 ${i+1}`}</div>
                              {s?.metadata?.page && (
                                <div className="text-muted-foreground">页码: {s.metadata.page}</div>
                              )}
                              {s?.metadata?.text && (
                                <div className="mt-1 text-muted-foreground/90 line-clamp-4">{s.metadata.text}</div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-muted-foreground">暂无来源信息</div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 输入表单区域 */}
        <div className="border-t border-border/40 glass-effect p-4">
          <form
            className="flex flex-row gap-3 items-end"
            onSubmit={e => {
              e.preventDefault();
              if (input.trim()) {
                sendMessage({ text: input });
                setInput('');
              }
            }}
          >
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  handleTextareaInput(e.currentTarget);
                }}
                ref={el => handleTextareaInput(el)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() && status === 'ready') {
                      sendMessage({ text: input });
                      setInput('');
                    }
                  }
                }}
                rows={1}
                disabled={status !== 'ready'}
                placeholder="输入您的问题（Enter发送，Shift+Enter换行）..."
                className="w-full px-4 py-3 glass-card rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-foreground placeholder:text-muted-foreground transition-all duration-200 resize-none"
              />
            </div>
            <button 
              type="submit" 
              disabled={status !== 'ready' || !input.trim()}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover-lift"
            >
              发送
            </button>
          </form>
          
          {/* 状态提示 */}
          {status !== 'ready' && (
            <div className="text-center text-sm text-muted-foreground mt-3 flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span>
                {status === 'submitted' ? 'AI正在思考中...' : '准备就绪'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

export default Chatcontainer