import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { google } from '@ai-sdk/google';
import { pc } from '@/lib/pinecone';
import { generateRAGPrompt, baseRAGPrompt } from '@/lib/prompts';
import { analyzeConversationHistory, generateOptimizedPrompt } from '@/lib/promptOptimizer';

// 允许流式响应，最长 30 秒
export const maxDuration = 30;

//收到来自前端Chatcontainer的请求
export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  //读取pinecone的向量数据库，获取到context
  //const context = await getContext(messages.content);
  const context = await getContext(messages);
  console.log(context);

  // 分析对话历史，优化提示词
  const optimizationData = analyzeConversationHistory(messages);
  const optimizedPrompt = generateOptimizedPrompt(baseRAGPrompt, optimizationData, context);

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: optimizedPrompt,
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}


const getContext = async (messages: UIMessage[]) => {
    try {
        // 提取最后一条用户消息的内容
        const lastUserMessage = messages
            .filter(msg => msg.role === 'user')
            .pop();
            
        if (!lastUserMessage || !lastUserMessage.parts || lastUserMessage.parts.length === 0) {
            throw new Error('No user message found or message parts are empty');
        }
        
        // 从parts数组中提取文本内容
        let queryText = '';
        for (const part of lastUserMessage.parts) {
            if (part.type === 'text') {
                queryText += part.text;
            }
        }

        if (!queryText.trim()) {
            throw new Error('Query text is empty after processing');
        }

        const model = 'multilingual-e5-large';
        // 将查询文本转换为Pinecone可搜索的数值向量
        const queryEmbedding = await pc.inference.embed(
          model,
          [queryText],  // 使用实际的查询文本
          { inputType: 'query' }
        );

        // 检查embedding是否成功生成
        if (!queryEmbedding.data || queryEmbedding.data.length === 0) {
            throw new Error('Failed to generate query embedding');
        }

        const embedding = queryEmbedding.data[0];
        if (!embedding) {
            throw new Error('No embedding data available');
        }

        // 在指定命名空间中搜索最相似的3个向量
        const INDEX = process.env.PINECONE_INDEX || 'ragchatbot'
        const queryResponse = await pc.index(INDEX).query({
          topK: 10,
          vector: 'values' in embedding ? embedding.values : embedding.sparseValues,
          includeValues: false,
          includeMetadata: true
        });

        console.log('Query response:', queryResponse);
        return queryResponse.matches;
    } catch (error) {
        console.error('Error in getContext:', error);
        // 返回空数组而不是抛出错误，避免整个聊天流程中断
        return [];
    }
}


