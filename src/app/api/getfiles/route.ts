import { getFile } from "@/index";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const files = await getFile();
        return NextResponse.json({ files });
    } catch (error) {
        console.error('获取文件失败:', error);
        return NextResponse.json({ error: '获取文件失败' }, { status: 500 });
    }
}