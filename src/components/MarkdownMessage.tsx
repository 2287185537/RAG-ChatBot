"use client"

import React from "react"

type Props = {
  content: string
}

// 极简 Markdown 渲染：支持段落、换行、粗体、斜体、代码块与行内代码、列表
// 为了保持依赖轻量，这里用非常基础的渲染；后续可替换为更完整的 md 库
export default function MarkdownMessage({ content }: Props) {
  // 将简单的 Markdown 转换为 HTML。由于是受控数据来源（后端生成），此处做最小处理
  const html = React.useMemo(() => {
    let text = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")

    // 代码块 ```
    text = text.replace(/```([\s\S]*?)```/g, (_, code) => {
      return `<pre class="bg-muted p-3 rounded-lg overflow-x-auto"><code>${code
        .replace(/\n$/,'')
        .replace(/\n/g, "<br/>")}</code></pre>`
    })

    // 粗体、斜体、行内代码
    text = text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-muted rounded px-1 py-0.5">$1</code>')

    // 列表（简单处理以行开头的 - ）
    if (/^\s*-\s+/m.test(text)) {
      text = text.replace(/(^|\n)-\s+(.+?)(?=\n(?!-\s)|$)/gs, (match) => {
        const items = match
          .trim()
          .split(/\n-\s+/)
          .map(s => s.replace(/^-\s+/, ''))
          .map(s => `<li>${s}</li>`) 
          .join('')
        return `\n<ul class="list-disc pl-5 my-2">${items}</ul>`
      })
    }

    // 段落与换行
    text = text
      .split(/\n{2,}/)
      .map(p => `<p class="my-2">${p.replace(/\n/g, '<br/>')}</p>`) 
      .join('')

    return text
  }, [content])

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none"> 
      {/* 这里信任渲染后的最小 HTML 子集 */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}


