"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type EvalItem = { chunk_id: string; question: string };
type EvalResult = { chunk_id: string; question: string; hit: boolean; rank: number; score?: number };

export default function RecallEvalPage() {
  const [items, setItems] = useState<EvalItem[]>([]);
  const [loadingPreset, setLoadingPreset] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [topK, setTopK] = useState(10);
  const [namespace, setNamespace] = useState("");
  const [useRerank, setUseRerank] = useState(true);
  const [rerankTopK, setRerankTopK] = useState(50);
  const [stats, setStats] = useState<any>(null);
  const [results, setResults] = useState<EvalResult[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 初次可选择不自动加载，提供按钮触发
  }, []);

  const handleLoadPreset = async () => {
    try {
      setLoadingPreset(true);
      const res = await fetch(`/api/recall-eval?preset=default`);
      const data = await res.json();
      if (Array.isArray(data.items)) setItems(data.items);
    } finally {
      setLoadingPreset(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const next: EvalItem[] = [];
    for (const line of lines) {
      try {
        const o = JSON.parse(line);
        if (o?.chunk_id && o?.question) next.push({ chunk_id: o.chunk_id, question: o.question });
      } catch {}
    }
    setItems(next);
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/recall-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, topK, namespace: namespace || undefined, useRerank, rerankTopK })
      });
      const data = await res.json();
      setStats(data.stats);
      setResults(data.results || []);
    } finally {
      setSubmitting(false);
    }
  };

  const hitRate = useMemo(() => {
    if (!results.length) return 0;
    const hits = results.filter(r => r.hit).length;
    return +(hits / results.length).toFixed(4);
  }, [results]);

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">召回检测</h1>
      <div className="glass-card rounded-2xl p-4 space-y-4">
        <div className="flex gap-3 flex-wrap items-center">
          <button className="px-3 py-2 rounded-md border" onClick={handleLoadPreset} disabled={loadingPreset}>
            {loadingPreset ? '加载中...' : '加载默认数据集(export/recall_questions.jsonl)'}
          </button>
          <input ref={fileRef} type="file" accept=".jsonl,.txt,application/jsonl" onChange={handleFileChange} />
          <label className="flex items-center gap-2">
            <span>topK</span>
            <input className="border rounded px-2 py-1 w-20" type="number" min={1} max={50} value={topK} onChange={e => setTopK(+e.target.value)} />
          </label>
          <label className="flex items-center gap-2">
            <span>namespace</span>
            <input className="border rounded px-2 py-1" placeholder="可留空" value={namespace} onChange={e => setNamespace(e.target.value)} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useRerank} onChange={e => setUseRerank(e.target.checked)} />
            <span>Use Rerank</span>
          </label>
          <label className="flex items-center gap-2">
            <span>rerankTopK</span>
            <input className="border rounded px-2 py-1 w-24" type="number" min={topK} max={200} value={rerankTopK} onChange={e => setRerankTopK(Math.max(topK, +e.target.value))} />
          </label>
          <button className="px-4 py-2 rounded-md bg-black text-white" onClick={handleSubmit} disabled={submitting || items.length === 0}>
            {submitting ? '评测中...' : `开始评测(${items.length})`}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">支持导入 JSONL，每行形如 {`{"chunk_id":"...","question":"..."}`}</p>
      </div>

      {stats && (
        <div className="glass-card rounded-2xl p-4">
          <h2 className="font-semibold mb-2">统计</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div>样本: {stats.size}</div>
            <div>topK: {stats.topK}</div>
            <div>Recall@1: {stats.recallAt1}</div>
            <div>Recall@3: {stats.recallAt3}</div>
            <div>Recall@5: {stats.recallAt5}</div>
            <div>Recall@10: {stats.recallAt10}</div>
            <div>MRR@10: {stats.mrrAt10}</div>
            <div>命中率(&gt;0): {hitRate}</div>
          </div>
        </div>
      )}

      {!!results.length && (
        <div className="glass-card rounded-2xl p-4">
          <h2 className="font-semibold mb-2">结果</h2>
          <div className="overflow-auto max-h-[60vh] border rounded">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th className="text-left p-2 border-b">#</th>
                  <th className="text-left p-2 border-b">chunk_id</th>
                  <th className="text-left p-2 border-b">question</th>
                  <th className="text-left p-2 border-b">rank</th>
                  <th className="text-left p-2 border-b">score</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className={r.hit ? 'bg-green-50' : ''}>
                    <td className="p-2 border-b">{i + 1}</td>
                    <td className="p-2 border-b font-mono break-all">{r.chunk_id}</td>
                    <td className="p-2 border-b">{r.question}</td>
                    <td className="p-2 border-b">{r.rank}</td>
                    <td className="p-2 border-b">{r.score ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!results.length && items.length > 0 && (
        <div className="text-sm text-muted-foreground">已加载 {items.length} 条样本，点击“开始评测”运行。</div>
      )}
    </div>
  );
}


