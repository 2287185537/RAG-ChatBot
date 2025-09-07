import { NextRequest, NextResponse } from 'next/server';
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { pc } from '@/lib/pinecone';
import {Md5} from 'ts-md5'
import { insertFile } from '@/index';

export async function POST(request: Request) {
    const formData = await request.formData();
    const files = formData.getAll('file');
    console.log(files);

    //1.分割成doc
    const file = files[0] as File;  // 转换为 File 类型
    const buffer = await file.arrayBuffer();
    // 将文件二进制转成 Blob，供 PDF 加载器读取
    const blob = new Blob([buffer], { type: file.type || "application/pdf" });

    const loader = new WebPDFLoader(blob, {
    // 加载器参数（本项目用默认即可）
    });

    const docs = await loader.load();
    // 如需调试可以打印第一页内容



    //2. 对文档进行文本切分
    const splitDocs = await Promise.all(docs.map(doc => splitDocument(doc)));




    //3.上传到向量数据库（带 file_key 前缀与 metadata）
    const fileKey = Md5.hashStr(file.name);
    const res = await Promise.all(splitDocs.map(chunks => embedChunks(chunks, fileKey, file.name)))
    console.log(res);

    //保存到数据库
    await insertFile(file.name, fileKey);

    return NextResponse.json({ message: '文件上传成功' });

}

const splitDocument = async (doc: Document) => {
    //对文档分割的函数进行封装
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 100,
    });
    const texts = await textSplitter.splitText(doc.pageContent);
    return texts;
}

//上传到向量数据库（仅稠密向量）
const embedChunks = async (chunks: string[], fileKey: string, fileName: string) => {
    try {
        const model = 'multilingual-e5-large';
        const embeddings = await pc.inference.embed(
          model,
          chunks,
          { inputType: 'passage', truncate: 'END' }
        );
        
        // 检查embeddings是否成功生成
        if (!embeddings.data || embeddings.data.length === 0) {
            throw new Error('Failed to generate embeddings');
        }
        
        // 确保长度匹配
        if (chunks.length !== embeddings.data.length) {
            throw new Error(`Mismatch between chunks (${chunks.length}) and embeddings (${embeddings.data.length})`);
        }
        
        const records = chunks.map((chunk, i) => {
            const embedding = embeddings.data[i];
            if (!embedding) {
                throw new Error(`Missing embedding at index ${i}`);
            }
            
            return {
                // 以 file_key 作为前缀，便于后续按文档级别前缀删除
                id: `${fileKey}#${Md5.hashStr(chunk)}`,
                // 根据 embedding 类型选择正确的属性
                values: 'values' in embedding ? (embedding as any).values : (embedding as any).sparseValues,
                // 写入必要元信息，便于检索与可视化
                metadata: { text: chunk, file_key: fileKey, file_name: fileName }
            };
        });

        const INDEX = process.env.PINECONE_INDEX || 'ragchatbot'
        return await pc.index(INDEX).upsert(records);
    } catch (error) {
        console.error('Error in embedChunks:', error);
        throw error;
    }
};