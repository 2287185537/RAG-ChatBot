import { NextRequest, NextResponse } from 'next/server';
import { pc } from '@/lib/pinecone';

// 说明：召回评测 API
// POST /api/recall-eval
// 输入 { items: {chunk_id: string, question: string}[], topK?: number, namespace?: string, index?: string }
// 输出 { stats: {...}, results: [{chunk_id, question, hit: boolean, rank: number | -1, score?: number}] }

type EvalItem = { chunk_id: string; question: string };

export async function GET(req: NextRequest) {
  // 读取默认问题列表文件，便于前端一键加载。
  const { searchParams } = new URL(req.url);
  const preset = searchParams.get('preset');
  if (preset !== 'default') {
    return NextResponse.json({ error: 'unsupported preset' }, { status: 400 });
  }
  try {
    const { readFile } = await import('fs/promises');
    const { join } = await import('path');
    const filePath = join(process.cwd(), 'export', 'recall_questions.jsonl');
    const raw = await readFile(filePath, 'utf-8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const items: EvalItem[] = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj?.chunk_id && obj?.question) items.push({ chunk_id: obj.chunk_id, question: obj.question });
      } catch {}
    }
    return NextResponse.json({ items });
  } catch (err) {
    console.error('读取默认问题列表失败:', err);
    return NextResponse.json({ error: 'failed to load default dataset' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: EvalItem[] = Array.isArray(body?.items) ? body.items : [];
    const topK: number = Number(body?.topK ?? 10);
    const namespace: string | undefined = body?.namespace || undefined;
    const indexName: string = body?.index || process.env.PINECONE_INDEX || 'ragchatbot';
    const useRerank: boolean = Boolean(body?.useRerank ?? true);
    const rerankTopK: number = Number(body?.rerankTopK ?? Math.min(50, topK * 5));

    if (items.length === 0) {
      return NextResponse.json({ error: 'items 为空' }, { status: 400 });
    }

    const model = 'multilingual-e5-large';
    const baseIndex = pc.index(indexName);
    const index = namespace ? baseIndex.namespace(namespace) : baseIndex;

    const results: { chunk_id: string; question: string; hit: boolean; rank: number; score?: number }[] = [];

    for (const item of items) {
      try {
        // 1) 生成查询向量（仅稠密）
        const denseEmb = await pc.inference.embed(model, [item.question], { inputType: 'query' });
        const dense = denseEmb?.data?.[0];
        const vector: number[] = (dense && 'values' in dense) ? (dense as any).values : [];

        // 2) 稠密检索
        const firstTopK = useRerank ? Math.max(topK, Math.min(50, rerankTopK)) : topK;
        const queryRes = await index.query({
          topK: firstTopK,
          vector,
          includeValues: false,
          includeMetadata: true,
        } as any);

        let matches = queryRes?.matches || [];

        // 3) 托管重排（可选）
        if (useRerank && matches.length > 0) {
          // 文档要求：不传 rankFields 时，文档需包含 text 字段
          const documents = matches.map((m: any) => ({ text: m?.metadata?.text ?? '' }));
          try {
            const rr = await pc.inference.rerank(
              'bge-reranker-v2-m3',
              item.question,
              documents,
              { topN: topK, returnDocuments: false }
            );
            // 使用返回的 index 对原始 matches 重排
            const order = (rr?.data ?? []).map((d: any) => ({ idx: d.index as number, score: d.score as number }));
            const reordered: any[] = [];
            for (const o of order) {
              if (Number.isInteger(o.idx) && o.idx >= 0 && o.idx < matches.length) {
                reordered.push({ ...matches[o.idx], score: o.score });
              }
              if (reordered.length >= topK) break;
            }
            // 若重排结果不足，补齐原排序
            if (reordered.length < topK) {
              const used = new Set(reordered.map((r: any) => r.id));
              for (const m of matches) {
                if (used.has(m.id)) continue;
                reordered.push(m);
                if (reordered.length >= topK) break;
              }
            }
            matches = reordered;
          } catch (e) {
            console.error('rerank 失败，回退原排序', e);
            matches = matches.slice(0, topK);
          }
        } else {
          matches = matches.slice(0, topK);
        }
        let rank = -1;
        let score: number | undefined = undefined;
        for (let i = 0; i < matches.length; i++) {
          if (matches[i]?.id === item.chunk_id) {
            rank = i + 1; // 从1开始
            score = matches[i]?.score;
            break;
          }
        }
        results.push({ chunk_id: item.chunk_id, question: item.question, hit: rank > 0, rank, score });
      } catch (e) {
        console.error('评测失败: ', item.chunk_id, e);
        results.push({ chunk_id: item.chunk_id, question: item.question, hit: false, rank: -1 });
      }
    }

    // 统计指标
    const n = results.length;
    const at = (k: number) => results.filter(r => r.rank > 0 && r.rank <= k).length / n;
    const mrr = (k: number) => {
      let sum = 0;
      for (const r of results) {
        if (r.rank > 0 && r.rank <= k) sum += 1 / r.rank;
      }
      return sum / n;
    };

    const stats = {
      size: n,
      topK,
      useRerank,
      rerankTopK,
      recallAt1: Number(at(1).toFixed(4)),
      recallAt3: Number(at(3).toFixed(4)),
      recallAt5: Number(at(5).toFixed(4)),
      recallAt10: Number(at(10).toFixed(4)),
      mrrAt10: Number(mrr(10).toFixed(4)),
    };

    return NextResponse.json({ stats, results });
  } catch (error) {
    console.error('召回评测失败:', error);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}


