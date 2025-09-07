import { pc } from '@/lib/pinecone'

export async function POST(req: Request) {
  try {
    const { query } = await req.json()
    if (typeof query !== 'string' || !query.trim()) {
      return new Response(JSON.stringify({ sources: [] }), { status: 200 })
    }

    const model = 'multilingual-e5-large'
    const queryEmbedding = await pc.inference.embed(model, [query], { inputType: 'query' })
    const embedding = queryEmbedding.data?.[0]
    if (!embedding) {
      return new Response(JSON.stringify({ sources: [] }), { status: 200 })
    }

    const INDEX = process.env.PINECONE_INDEX || 'ragchatbot'
    const queryResponse = await pc.index(INDEX).query({
      topK: 10,
      vector: 'values' in embedding ? embedding.values : embedding.sparseValues,
      includeValues: false,
      includeMetadata: true,
    })

    return new Response(JSON.stringify({ sources: queryResponse.matches ?? [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ sources: [] }), { status: 200 })
  }
}


