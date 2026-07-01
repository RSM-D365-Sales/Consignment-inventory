import type { AgentReply, ChatMessage, ToolTrace } from '../models/chat'
import type { AzureOpenAIConfig } from '../models/config'
import { executeTool, toOpenAITools, type AgentData } from './agentTools'

const SYSTEM_PROMPT = `You are the Vince Consignment Inventory Assistant, embedded in an app that tracks Vince-owned inventory held at retail partners (Nordstrom, Saks Fifth Avenue, Macy's, Bloomingdale's).

Rules:
- Always ground every number in tool results. NEVER invent figures — call a tool.
- Be concise and businesslike. Prefer short answers with a tight list when ranking.
- Money is USD at cost unless the user asks for units or retail.
- When the user asks to draft, prepare, or send an end-of-season return for a partner, call draft_season_return. Do not claim a transfer order was created — creating it requires the user to confirm the card in the UI.
- If a partner name is ambiguous or missing for an action, ask a brief clarifying question.`

interface AzureRunOptions {
  question: string
  history: ChatMessage[]
  data: AgentData
  azure: AzureOpenAIConfig
  /** Called with each streamed token of the final answer. */
  onToken?: (delta: string) => void
  signal?: AbortSignal
}

interface StreamedToolCall {
  id: string
  name: string
  arguments: string
}

const TOOL_LABELS: Record<string, string> = {
  get_portfolio_summary: 'Portfolio summary',
  compare_partners: 'Compared partners',
  get_partner_details: 'Partner details',
  query_inventory: 'Queried inventory',
  draft_season_return: 'Drafted season return',
}

/**
 * Browser → Azure OpenAI (Foundry deployment) with function calling and true
 * SSE token streaming. Resolves tool calls in a loop, then streams the final
 * natural-language answer via onToken.
 *
 * BYO-key demo path. For production, point `endpoint` at the Azure Function
 * proxy instead so the key never reaches the browser (see FUTURE-INTEGRATION).
 */
export async function runAzure(opts: AzureRunOptions): Promise<AgentReply> {
  const { question, history, data, azure, onToken, signal } = opts
  validateAzure(azure)

  const url =
    `${azure.endpoint.replace(/\/+$/, '')}/openai/deployments/` +
    `${azure.deployment}/chat/completions?api-version=${azure.apiVersion}`
  const tools = toOpenAITools()

  // Build the conversation: system + prior turns (text only) + new question.
  const messages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }]
  for (const m of history) {
    if (m.text) messages.push({ role: m.role, content: m.text })
  }
  messages.push({ role: 'user', content: question })

  const traces: ToolTrace[] = []
  let card: AgentReply['card']

  // Up to a few rounds to let the model call tools then answer.
  for (let round = 0; round < 5; round++) {
    const { content, toolCalls } = await streamRound(
      url,
      azure.apiKey,
      messages,
      tools,
      onToken,
      signal,
    )

    if (toolCalls.length === 0) {
      return { text: content, tools: traces, card }
    }

    // Record the assistant's tool-call turn, then execute each tool locally.
    messages.push({
      role: 'assistant',
      content: content || null,
      tool_calls: toolCalls.map((t) => ({
        id: t.id,
        type: 'function',
        function: { name: t.name, arguments: t.arguments || '{}' },
      })),
    })

    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(tc.arguments || '{}')
      } catch {
        /* leave args empty on malformed JSON */
      }
      const result = executeTool(tc.name, args, data)
      traces.push({ name: tc.name, label: TOOL_LABELS[tc.name] ?? tc.name })
      if (result.card) card = result.card
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result.model),
      })
    }
  }

  return {
    text: 'I gathered the data but hit the tool-call limit before answering. Please rephrase.',
    tools: traces,
    card,
  }
}

/** One streamed completion round; assembles content + any tool calls. */
async function streamRound(
  url: string,
  apiKey: string,
  messages: any[],
  tools: ReturnType<typeof toOpenAITools>,
  onToken: ((delta: string) => void) | undefined,
  signal: AbortSignal | undefined,
): Promise<{ content: string; toolCalls: StreamedToolCall[] }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    signal,
    body: JSON.stringify({
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.2,
      stream: true,
    }),
  })

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `Azure OpenAI ${res.status} ${res.statusText}. ${truncate(detail, 240)}`,
    )
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  const toolMap = new Map<number, StreamedToolCall>()

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? '' // keep the trailing partial line

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') continue

      let json: any
      try {
        json = JSON.parse(payload)
      } catch {
        continue
      }
      const delta = json.choices?.[0]?.delta
      if (!delta) continue

      if (typeof delta.content === 'string' && delta.content.length) {
        content += delta.content
        onToken?.(delta.content)
      }

      if (Array.isArray(delta.tool_calls)) {
        for (const tcDelta of delta.tool_calls) {
          const idx = tcDelta.index ?? 0
          const existing =
            toolMap.get(idx) ?? { id: '', name: '', arguments: '' }
          if (tcDelta.id) existing.id = tcDelta.id
          if (tcDelta.function?.name) existing.name += tcDelta.function.name
          if (tcDelta.function?.arguments)
            existing.arguments += tcDelta.function.arguments
          toolMap.set(idx, existing)
        }
      }
    }
  }

  return {
    content,
    toolCalls: [...toolMap.values()].filter((t) => t.name),
  }
}

function validateAzure(azure: AzureOpenAIConfig) {
  const missing = (['endpoint', 'deployment', 'apiVersion', 'apiKey'] as const)
    .filter((k) => !azure[k]?.trim())
  if (missing.length) {
    throw new Error(
      `Azure OpenAI is not fully configured (missing: ${missing.join(
        ', ',
      )}). Add it in Setup → Assistant, or switch the assistant to Heuristic mode.`,
    )
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}
