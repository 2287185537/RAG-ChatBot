import { NextResponse } from 'next/server';
import { pc } from '@/lib/pinecone';
import { deleteFile } from '@/index';

// 删除接口：按 file_key 删除数据库记录，并按前缀清理 Pinecone 向量
// 请求体: { file_key: string, namespace?: string }
export async function POST(request: Request) {
  try {
    const { file_key, namespace } = await request.json();
    if (!file_key || typeof file_key !== 'string') {
      return NextResponse.json({ error: '缺少或非法的 file_key' }, { status: 400 });
    }

    const INDEX = process.env.PINECONE_INDEX || 'ragchatbot'
    const index = pc.index(INDEX);
    const ns = namespace ? index.namespace(namespace) : index;

    // 1) 分页列出以 file_key# 为前缀的所有向量ID
    let paginationToken: string | undefined = undefined;
    let totalDeleted = 0;
    do {
      const page = await ns.listPaginated({ prefix: `${file_key}#`, paginationToken });
      const ids = (page.vectors || []).map(v => v.id);
      if (ids.length > 0) {
        await ns.deleteMany(ids);
        totalDeleted += ids.length;
      }
      paginationToken = page.pagination?.next;
    } while (paginationToken);

    // 2) 删除数据库记录
    await deleteFile(file_key);

    return NextResponse.json({ message: '删除成功', vectorsDeleted: totalDeleted });
  } catch (error) {
    console.error('删除失败:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}


