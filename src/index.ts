import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { fileTable } from './db/schema';
  
const db = drizzle(process.env.DATABASE_URL!);

export const insertFile = async (file_name: string, file_key: string) => {
    await db.insert(fileTable).values({ file_name, file_key })
}

export const getFile = async () => {
    return await db.select().from(fileTable)
}

// 根据 file_key 删除数据库中的文件记录
export const deleteFile = async (file_key: string) => {
    await db.delete(fileTable).where(eq(fileTable.file_key, file_key));
}
