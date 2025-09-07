### AI 知识库助手（基于 RAG 的知识检索与问答）

基于 RAG（检索增强生成）的知识库问答网站：支持文档上传、切分与向量化入库、相似度检索、上下文驱动回答以及来源引用展示。

![AI知识库助手界面预览](./public/001.png)

---

### 功能特性

- 文档上传与管理（支持 PDF、DOC/DOCX、TXT）
- 文本切分与向量化入库（Pinecone，`multilingual-e5-large`）
- 语义检索 + 上下文拼接，LLM回答（Gemini 2.5 Flash）
- 引用来源可视化（片段、文件名、页码）
- 文件级删除：向量与数据库记录按 `file_key` 前缀级联清理

---

### 架构概览

- 前端：`src/components/UpLoadContainer.tsx` 负责上传、列表与删除；`src/components/Chatcontainer.tsx` 负责会话，使用 `useChat` 与服务器进行通信。
- 服务端 API（`src/app/api/*/route.ts`）：
  - `upload`：加载 PDF → 切分 → 生成向量 → Pinecone `upsert`，并记录到 `files` 表
  - `context`：将查询编码为向量 → Pinecone `query` 返回片段
  - `chat`：检索上下文 → 生成提示词 → Gemini 2.5 Flash 回答
  - `getfiles`：列出 `files` 表记录
  - `delete`：按 `file_key` 前缀删除向量，并删除 `files` 表记录
  - `recall-eval`：离线检索评测（可选）

---

### 端到端数据流（RAG 对话）

1) 用户在 `Chatcontainer` 输入问题 → `POST /api/chat`
2) 服务器提取最近一条用户输入，使用 `multilingual-e5-large` 生成查询向量 → Pinecone `query(topK=10)` 获取匹配片段
3) 结合对话历史进行提示词优化（`src/lib/promptOptimizer.ts`），拼接为系统提示（`src/lib/prompts.ts`）
4) 使用 Vercel AI SDK + `@ai-sdk/google` 的 Gemini 2.5 Flash 进行生成 → 前端实时渲染
5) 前端若未收到来源，回退调用 `/api/context` 基于同样的用户问题展示检索来源

---

### 技术栈

- Next.js 15、React 19、TypeScript 5
- Vercel AI SDK（`ai`, `@ai-sdk/react`, `@ai-sdk/google`）
- Pinecone（`@pinecone-database/pinecone`）
- LangChain（`@langchain/community`, `@langchain/core`）
- Drizzle ORM + PostgreSQL（可托管在 Supabase）
- Tailwind CSS、React Query、Axios、React Dropzone

完整列表见 `技术栈.txt`。

---

### 目录结构

```text
src/
  app/
    api/
      chat/route.ts
      context/route.ts
      delete/route.ts
      getfiles/route.ts
      recall-eval/route.ts
      upload/route.ts
    favicon.ico
    globals.css
    layout.tsx
    page.tsx
    recall/
      page.tsx
  components/
    Chatcontainer.tsx
    MarkdownMessage.tsx
    QueryClientProvider.tsx
    ThemeProvider.tsx
    ThemeToggle.tsx
    ui/
      button.tsx
    UpLoadContainer.tsx
  db/
    schema.ts
  index.ts
  lib/
    pinecone.ts
    promptOptimizer.ts
    prompts.ts
    utils.ts
```

---

### 环境变量

在项目根目录创建 `.env.local`（本地）或 `.env`（部署），示例：

```env
# Pinecone
PINECONE_API_KEY=你的PineconeKey
PINECONE_INDEX=ragchatbot

# 数据库（PostgreSQL）
DATABASE_URL=postgres://user:pass@host:5432/dbname

# Google Gemini（Vercel AI SDK - Google 提供方）
GOOGLE_GENERATIVE_AI_API_KEY=你的GoogleAPIKey
```

---

### 快速开始（本地开发）

```bash
# 1) 安装依赖
npm install

# 2) 启动开发服务器（http://localhost:3000）
npm run dev

# 3) 生产构建与启动
npm run build
npm start
```

如需一键生成离线评测问题集：

```bash
npm run gen:recall
```

---

### 核心 API 说明

- `POST /api/upload`：表单上传字段 `file`；服务器进行加载→切分→向量化→入库；返回 `{ message }`。
- `POST /api/getfiles`：返回 `{ files: FileModel[] }`。
- `POST /api/delete`：请求 `{ file_key }`；按前缀删除向量并删除数据库记录；返回 `{ message, vectorsDeleted }`。
- `POST /api/context`：请求 `{ query }`；返回 `{ sources: Match[] }`（检索片段）。
- `POST /api/chat`：请求为 `useChat` 的消息体；返回回答，建议从 `providerMetadata.sources` 或前端回补显示来源。

> 详细字段可参考 `src/app/api/*/route.ts` 源码。

#### 召回评测（可选）
- `GET /api/recall-eval?preset=default`：加载默认问题集（来自 `export/recall_questions.jsonl`）
- `POST /api/recall-eval`：
  - 入参：`{ items: {chunk_id, question}[], topK?, namespace?, index?, useRerank?, rerankTopK? }`
  - 出参：`{ stats: {recallAtK..., mrrAt10...}, results: [{chunk_id, question, hit, rank, score?}] }`
  - 说明：默认使用 Pinecone 托管重排 `bge-reranker-v2-m3`，若失败自动回退原始相似度排序。

---

### 常见问题（FAQ）

- 无法检索到内容？
  - 确认文档已成功入库（上传日志与 `files` 表记录）。
  - 检查 `PINECONE_API_KEY/PINECONE_INDEX` 是否配置正确。
  - 问题过短或过泛，尝试加入更具体的关键词。
  - 检查索引名称是否与代码一致（`src/lib/pinecone.ts` 与各 API 使用 `process.env.PINECONE_INDEX || 'ragchatbot'`）。

- 生成回答没有来源？
  - 查看 `/api/context` 是否能根据同样问题返回 `sources`。
  - 确保服务端在回答时携带来源或前端做回补显示。
  
 - 删除失败或仅删除部分？
  - 确认 `file_key` 与向量 `id` 前缀一致（形如 `file_key#chunkHash`）。
  - Pinecone 删除使用分页列举，需等待一段时间索引最终一致。

---

### 部署

- 推荐部署到 Vercel。确保在部署面板正确配置环境变量（同上）。
  - 数据库：将 `DATABASE_URL` 指向托管的 PostgreSQL（如 Supabase）。
  - 向量库：`PINECONE_API_KEY` 与索引 `PINECONE_INDEX`（代码默认 `ragchatbot`）。

---

### 许可证

本项目供学习与交流使用。

---

### 重要实现细节与注意事项

- 文档切分：`RecursiveCharacterTextSplitter(chunkSize=500, chunkOverlap=100)`，适配常见技术文档粒度。
- 向量存储：仅使用稠密向量；`id` 形如 `file_key#Md5(chunk)`，并写入 `metadata.text/file_key/file_name`。
- 查询与重排：默认 `topK=10`，可选 Pinecone 托管重排提升相关性。
- 数据一致性：删除流程先清理向量（分页），再删数据库记录，避免脏数据。
- 前端来源回补：当回答未携带来源时，使用同问句调用 `/api/context` 展示依据。

