/**
 * talk2chain - 精简的 LLM API 路由
 * 使用 Qwen3 进行意图识别
 * 注意：敏感数据（API Key）从环境变量读取，不暴露给客户端
 */

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { Intent } from '../../../types/intent'

export async function POST(request: NextRequest) {
  try {
    const { userInput, currentChain } = await request.json()

    if (!userInput) {
      return NextResponse.json(
        { error: '用户输入不能为空' },
        { status: 400 }
      )
    }

    // 从环境变量读取 API Key（服务器端，不暴露给客户端）
    const apiKey = process.env.QWEN_API_KEY
    const model = process.env.QWEN_MODEL || 'qwen-max'
    
    if (!apiKey) {
      console.error('❌ Qwen API Key 未配置')
      return NextResponse.json(
        { error: '未配置 LLM API Key。请检查 Talk2Chain/.env 文件中的 QWEN_API_KEY' },
        { status: 500 }
      )
    }

    // 精简的系统提示词（支持 PAS、WND、FRQ Transfer 和跨链到 BSC，同时支持 ZETA Transfer）
    const systemPrompt = `你是一个专业的区块链意图解析助手。你的任务是将用户的自然语言请求转换为结构化的 JSON 格式。

支持的意图类型：
1. transfer: 链内转账（在指定链上发送代币）
2. cross_chain_transfer: 跨链转账（从一条链跨链到另一条链）

支持的链：
- polkadot (Polkadot Hub TestNet、Polkadot、PAS)
- westend (Westend TestNet、Westend、WND)
- frequency (Frequency TestNet、Frequency、FRQ)
- bsc (BSC、币安智能链、Binance Smart Chain)

支持的代币：
- PAS (Polkadot Hub TestNet)
- WND (Westend TestNet)
- FRQ (Frequency TestNet)


重要规则：
1. 如果用户在 Polkadot Hub TestNet 上发送 PAS，使用 action: "transfer"，fromChain 和 toChain 都是 "polkadot"，fromToken 和 toToken 都是 "PAS"
2. 如果用户在 Westend TestNet 上发送 WND，使用 action: "transfer"，fromChain 和 toChain 都是 "westend"，fromToken 和 toToken 都是 "WND"
3. 如果用户在 Frequency TestNet 上发送 FRQ，使用 action: "transfer"，fromChain 和 toChain 都是 "frequency"，fromToken 和 toToken 都是 "FRQ"
5. 如果用户说"跨链到 BSC"、"发送到 BSC"、"从 [链名] 转到 BSC"，使用 action: "cross_chain_transfer"，fromChain: "源链"，toChain: "bsc"，fromToken: "源代币"，toToken: "源代币"
6. 主要支持 PAS、WND、FRQ 代币
7. 如果用户提到其他代币或链，返回错误提示

请分析用户的意图，并返回以下格式的 JSON：
{
  "action": "意图类型",
  "fromChain": "源链（如需要）",
  "toChain": "目标链（如需要）",
  "fromToken": "代币符号",
  "toToken": "代币符号",
  "amount": "数量（如需要）",
  "recipient": "接收地址（如需要）"
}

只返回 JSON，不要包含其他文本。`

    const userPrompt = `用户请求：${userInput}
${currentChain ? `\n当前连接的网络：${currentChain}` : ''}

请仔细分析：
- 如果是 Polkadot Hub TestNet 链内转账，使用 action: "transfer"，fromChain 和 toChain 都是 "polkadot"，fromToken 和 toToken 都是 "PAS"
- 如果是 Westend TestNet 链内转账，使用 action: "transfer"，fromChain 和 toChain 都是 "westend"，fromToken 和 toToken 都是 "WND"
- 如果是 Frequency TestNet 链内转账，使用 action: "transfer"，fromChain 和 toChain 都是 "frequency"，fromToken 和 toToken 都是 "FRQ"
- 如果是跨链到 BSC，使用 action: "cross_chain_transfer"，fromChain: "源链"，toChain: "bsc"，fromToken: "源代币"，toToken: "源代币"
- 主要支持 PAS、WND、FRQ 代币

请分析并返回结构化的意图 JSON。`

    // 调用 Qwen API
    const baseURL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'
    
    const response = await axios.post(
      baseURL,
      {
        model: model,
        input: {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        },
        parameters: {
          temperature: 0.3,
          result_format: 'message',
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    )

    console.log('Qwen API 响应:', response.data.output.choices[0].message.content)

    if (!response.data?.output?.choices?.[0]?.message?.content) {
      throw new Error('Qwen API 返回格式异常')
    }

    const content = response.data.output.choices[0].message.content
    
    console.log('Qwen API 原始响应内容:', content)
    
    // 解析 JSON - 改进版本，更精确地匹配 JSON 对象
    let jsonStr: string | null = null
    
    // 首先尝试匹配代码块中的 JSON
    const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1]
    } else {
      // 如果没有代码块，尝试找到第一个完整的 JSON 对象
      const firstBrace = content.indexOf('{')
      if (firstBrace !== -1) {
        let braceCount = 0
        let endBrace = firstBrace
        for (let i = firstBrace; i < content.length; i++) {
          if (content[i] === '{') braceCount++
          if (content[i] === '}') braceCount--
          if (braceCount === 0) {
            endBrace = i + 1
            break
          }
        }
        jsonStr = content.substring(firstBrace, endBrace)
      }
    }
    
    if (!jsonStr) {
      console.error('无法从响应中提取 JSON')
      throw new Error('无法从 LLM 响应中提取有效的 JSON 数据')
    }
    
    console.log('提取的 JSON 字符串:', jsonStr)
    
    let intent: Intent
    try {
      intent = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('JSON 解析失败:', parseError)
      console.error('尝试解析的字符串:', jsonStr)
      throw new Error(`JSON 解析失败: ${parseError}`)
    }

    // 验证意图（支持 PAS、ZETA、WND、FRQ）
    const supportedTokens = ['PAS', 'ZETA', 'WND', 'FRQ']
    if (intent.fromToken && !supportedTokens.includes(intent.fromToken)) {
      return NextResponse.json(
        { error: `仅支持 ${supportedTokens.join('、')} 代币，不支持其他代币` },
        { status: 400 }
      )
    }

    const supportedFromChains = ['polkadot', 'zetachain', 'westend', 'frequency']
    if (intent.fromChain && !supportedFromChains.includes(intent.fromChain)) {
      return NextResponse.json(
        { error: `仅支持从 ${supportedFromChains.join('、')} 发起操作` },
        { status: 400 }
      )
    }

    const supportedToChains = ['polkadot', 'zetachain', 'bsc', 'westend', 'frequency']
    if (intent.toChain && !supportedToChains.includes(intent.toChain)) {
      return NextResponse.json(
        { error: `仅支持 ${supportedToChains.join('、')} 链` },
        { status: 400 }
      )
    }

    console.log('✅ 解析的意图:', intent)

    return NextResponse.json({ intent })
  } catch (error: any) {
    console.error('LLM API 路由错误:', error)
    
    if (error.response) {
      const status = error.response.status
      const errorData = error.response.data
      
      if (status === 401) {
        return NextResponse.json(
          { error: 'API Key 无效或已过期。请检查 Talk2Chain/.env 文件中的 QWEN_API_KEY' },
          { status: 401 }
        )
      }
      
      return NextResponse.json(
        { error: `LLM API 错误 (${status}): ${errorData?.message || JSON.stringify(errorData)}` },
        { status: status }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'LLM API 调用失败' },
      { status: 500 }
    )
  }
}

