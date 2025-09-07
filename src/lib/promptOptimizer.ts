// 提示词优化器 - 根据对话历史和用户反馈动态调整提示词

export interface PromptOptimizationData {
  conversationHistory: any[];
  userFeedback: 'positive' | 'negative' | 'neutral';
  responseQuality: number; // 0-10 评分
  contextRelevance: number; // 0-10 评分
  userSatisfaction: number; // 0-10 评分
  conversationDepth: number; // 对话轮次
}

export interface OptimizedPromptConfig {
  baseConfig: any;
  dynamicAdjustments: {
    contextWeight: number;
    conversationDepth: number;
    responseStyle: 'concise' | 'detailed' | 'balanced';
    technicalLevel: 'beginner' | 'intermediate' | 'advanced';
  };
}

// 分析对话历史，提取优化信息
export function analyzeConversationHistory(messages: any[]): PromptOptimizationData {
  const userMessages = messages.filter(msg => msg.role === 'user');
  const assistantMessages = messages.filter(msg => msg.role === 'assistant');
  
  // 计算对话深度
  const conversationDepth = messages.length;
  
  // 分析用户问题复杂度
  const questionComplexity = userMessages.reduce((acc, msg) => {
    const text = msg.parts?.find((part: any) => part.type === 'text')?.text || '';
    return acc + (text.length > 100 ? 2 : text.length > 50 ? 1 : 0);
  }, 0);
  
  // 分析回答长度
  const responseLength = assistantMessages.reduce((acc, msg) => {
    const text = msg.parts?.find((part: any) => part.type === 'text')?.text || '';
    return acc + text.length;
  }, 0);
  
  return {
    conversationHistory: messages,
    userFeedback: 'neutral', // 默认值，实际应用中应该从用户反馈获取
    responseQuality: Math.min(10, Math.max(0, 5 + (questionComplexity * 0.5) - (responseLength > 500 ? 1 : 0))),
    contextRelevance: Math.min(10, Math.max(0, 7 + (conversationDepth * 0.2))),
    userSatisfaction: Math.min(10, Math.max(0, 6 + (questionComplexity * 0.3))),
    conversationDepth
  };
}

// 根据分析结果优化提示词
export function optimizePrompt(
  baseConfig: any, 
  optimizationData: PromptOptimizationData
): OptimizedPromptConfig {
  
  // 根据对话深度调整上下文权重
  const contextWeight = Math.min(1.5, Math.max(0.5, 1 + (optimizationData.conversationDepth * 0.1)));
  
  // 根据用户满意度调整回答风格
  let responseStyle: 'concise' | 'detailed' | 'balanced' = 'balanced';
  if (optimizationData.userSatisfaction < 5) {
    responseStyle = 'detailed';
  } else if (optimizationData.userSatisfaction > 8) {
    responseStyle = 'concise';
  }
  
  // 根据问题复杂度调整技术级别
  let technicalLevel: 'beginner' | 'intermediate' | 'advanced' = 'intermediate';
  if (optimizationData.responseQuality < 4) {
    technicalLevel = 'beginner';
  } else if (optimizationData.responseQuality > 7) {
    technicalLevel = 'advanced';
  }
  
  return {
    baseConfig,
    dynamicAdjustments: {
      contextWeight,
      conversationDepth: optimizationData.conversationDepth,
      responseStyle,
      technicalLevel
    }
  };
}

// 生成优化后的提示词
export function generateOptimizedPrompt(
  baseConfig: any,
  optimizationData: PromptOptimizationData,
  context: any
): string {
  const optimized = optimizePrompt(baseConfig, optimizationData);
  
  // 根据优化结果调整提示词内容
  let adjustedRole = optimized.baseConfig.role;
  
  // 根据技术级别调整角色描述
  if (optimized.dynamicAdjustments.technicalLevel === 'beginner') {
    adjustedRole += " 请使用通俗易懂的语言，避免过于专业的技术术语。";
  } else if (optimized.dynamicAdjustments.technicalLevel === 'advanced') {
    adjustedRole += " 可以使用专业术语和深入的技术分析。";
  }
  
  // 根据回答风格调整规则
  let adjustedRules = [...optimized.baseConfig.rules];
  if (optimized.dynamicAdjustments.responseStyle === 'concise') {
    adjustedRules.push("提供简洁明了的回答，避免冗长的解释");
  } else if (optimized.dynamicAdjustments.responseStyle === 'detailed') {
    adjustedRules.push("提供详细全面的回答，包含必要的背景信息和解释");
  }
  
  // 根据上下文权重调整上下文指导
  let adjustedContextGuidance = [...optimized.baseConfig.contextGuidance];
  if (optimized.dynamicAdjustments.contextWeight > 1.2) {
    adjustedContextGuidance.push("特别注意上下文信息的深度挖掘和关联分析");
  }
  
  // 构建优化后的配置
  const optimizedConfig = {
    ...optimized.baseConfig,
    role: adjustedRole,
    rules: adjustedRules,
    contextGuidance: adjustedContextGuidance
  };
  
  // 使用基础生成函数
  const { generateRAGPrompt } = require('./prompts');
  return generateRAGPrompt(optimizedConfig, context);
}

// 提示词效果评估
export function evaluatePromptEffectiveness(
  originalPrompt: string,
  optimizedPrompt: string,
  userResponse: any
): number {
  // 简单的效果评估算法
  // 实际应用中可以使用更复杂的NLP分析
  
  const responseLength = userResponse?.parts?.find((part: any) => part.type === 'text')?.text?.length || 0;
  const hasFollowUp = userResponse?.parts?.some((part: any) => 
    part.type === 'text' && part.text.includes('谢谢') || part.text.includes('明白了')
  );
  
  let score = 5; // 基础分
  
  // 根据回答长度调整分数
  if (responseLength > 100) score += 2;
  if (responseLength > 200) score += 1;
  
  // 根据是否有后续问题调整分数
  if (hasFollowUp) score += 2;
  
  return Math.min(10, Math.max(0, score));
}
