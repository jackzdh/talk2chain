/**
 * Talk2Chain - LLM 意图解析
 * 通过 Next.js API 路由调用，避免 CORS 问题
 */

import { Intent } from '../types/intent'

/**
 * 使用 LLM 解析用户意图并转换为结构化 JSON
 */
export async function parseIntent(userInput: string, currentChain?: string): Promise<Intent> {
  try {
    // 通过 Next.js API 路由调用 LLM
    const response = await fetch('/api/llm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userInput, currentChain }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `API 请求失败: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.intent) {
      throw new Error('API 返回格式异常：缺少 intent 字段')
    }

    return data.intent as Intent
  } catch (error: any) {
    console.error('LLM 调用失败:', error)
    
    if (error.message) {
      throw new Error(`LLM 调用失败: ${error.message}`)
    } else {
      throw new Error('LLM 调用失败: 未知错误')
    }
  }
}

