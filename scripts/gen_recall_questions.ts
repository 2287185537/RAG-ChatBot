import 'dotenv/config';
import { writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { pc } from '../src/lib/pinecone';
import { generateQuestionPrompt } from '../src/lib/prompts';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

/**
 * 目的：
 * - 从 Pinecone 取出指定数量的片段（默认 70 条）
 * - 令 LLM 基于每个片段生成 2-3 个问题
 * - 以 JSONL 格式保存到文件（每行一个 {chunk_id, question}）
 */

type CLIOptions = {
  topK: number;                // 片段数量
  numQuestions: number;        // 每个片段生成的问题数量（2-5之间，默认3）
  outFile: string;             // 输出文件路径（jsonl）
  prefix?: string;             // 可选：按ID前缀筛选
  namespace?: string;          // 可选：命名空间
};

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const hit = args.find(a => a.startsWith(`--${key}=`));
    return hit ? hit.split('=')[1] : undefined;
  };

  const topK = Number(get('topK') ?? get('k') ?? 70);
  const numQuestions = Number(get('questions') ?? get('q') ?? 2);
  const outFile = get('out') ?? 'export/recall_questions.jsonl';
  const prefix = get('prefix');
  const namespace = get('namespace');

  return { topK, numQuestions, outFile, prefix, namespace };
}

async function listIds(options: { limit: number; prefix?: string; namespace?: string }): Promise<string[]> {
  const { limit, prefix, namespace } = options;
  const baseIndex = pc.index(process.env.PINECONE_INDEX || 'ragchatbot');
  const index = namespace ? baseIndex.namespace(namespace) : baseIndex;

  const ids: string[] = [];
  let paginationToken: string | undefined = undefined;
  do {
    const page = await index.listPaginated({
      prefix,
      paginationToken,
    } as any);

    const pageIds = (page.vectors || []).map((v: any) => v.id);
    ids.push(...pageIds);
    paginationToken = page.pagination?.next;
  } while (paginationToken && ids.length < limit);

  return ids.slice(0, limit);
}

async function fetchVectors(ids: string[], namespace?: string) {
  const baseIndex = pc.index(process.env.PINECONE_INDEX || 'ragchatbot');
  const index = namespace ? baseIndex.namespace(namespace) : baseIndex;
  // 从 Pinecone 拉取向量（v6接口）
  const res: any = await index.fetch(ids as any);
  // 兼容不同 SDK 返回结构：可能是 { vectors: {id: record, ...} } / { vectors: Record[] } / { records: ... }
  let vectors: any[] = [];
  if (Array.isArray(res?.vectors)) {
    vectors = res.vectors;
  } else if (res?.vectors && typeof res.vectors === 'object') {
    vectors = Object.values(res.vectors);
  } else if (Array.isArray(res?.records)) {
    vectors = res.records;
  } else if (res?.records && typeof res.records === 'object') {
    vectors = Object.values(res.records);
  }
  return vectors;
}

function ensureFile(outFile: string) {
  const dir = dirname(outFile);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(outFile)) {
    writeFileSync(outFile, '');
  }
}

function extractJsonArray(text: string): string[] {
  try {
    const obj = JSON.parse(text.trim());
    if (Array.isArray(obj?.questions)) return obj.questions as string[];
  } catch {}
  // 回退方案：从纯文本中尝试提取第一个 {...} JSON 片段
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]);
      if (Array.isArray(obj?.questions)) return obj.questions as string[];
    } catch {}
  }
  return [];
}

async function main() {
  const { topK, numQuestions, outFile, prefix, namespace } = parseArgs();

  if (!process.env.PINECONE_API_KEY) {
    console.error('缺少 PINECONE_API_KEY 环境变量');
    process.exit(1);
  }
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('缺少 GOOGLE_GENERATIVE_AI_API_KEY 环境变量');
    process.exit(1);
  }

  console.log(`准备从 Pinecone 取出 ${topK} 条片段${prefix ? `（前缀: ${prefix}）` : ''}...`);
  const ids = await listIds({ limit: topK, prefix, namespace });
  if (ids.length === 0) {
    console.error('未获取到任何ID，请检查索引是否为空或提供 prefix。');
    process.exit(1);
  }

  const vectors = await fetchVectors(ids, namespace);
  const withText = vectors.filter(v => v?.metadata?.text && typeof v.metadata.text === 'string');
  if (withText.length === 0) {
    console.error('获取到的向量缺少 metadata.text，无法生成问题。');
    process.exit(1);
  }

  ensureFile(outFile);
  let totalQuestions = 0;

  for (const v of withText) {
    const context: string = v.metadata.text as string;
    const prompt = generateQuestionPrompt({ context, numQuestionsPerChunk: numQuestions });

    try {
      const { text } = await generateText({
        model: google('gemini-2.5-flash'),
        prompt,
      });

      const questions = extractJsonArray(text).slice(0, Math.max(2, Math.min(5, numQuestions)));
      if (questions.length === 0) {
        console.warn(`片段 ${v.id} 未解析出问题，已跳过。`);
        continue;
      }

      for (const q of questions) {
        const line = JSON.stringify({ chunk_id: v.id, question: q });
        appendFileSync(outFile, line + '\n', 'utf-8');
        totalQuestions += 1;
      }
    } catch (err) {
      console.error(`生成问题失败: ${v.id}`, err);
    }
  }

  console.log(`完成。输出文件: ${outFile}，问题总数: ${totalQuestions}`);
}

main().catch(err => {
  console.error('脚本执行失败：', err);
  process.exit(1);
});


