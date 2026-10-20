export class AgentError extends Error {
  constructor(code, message, status = 502) {
    super(message)
    this.name = 'AgentError'
    this.code = code
    this.status = status
  }
}

export function agentConfig() {
  return {
    baseUrl: (process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1').replace(
      /\/+$/,
      '',
    ),
    apiKey: process.env.LLM_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? '',
  }
}

export function isAgentConfigured() {
  const config = agentConfig()
  return Boolean(config.apiKey && config.model)
}

// One chat completion against any OpenAI-compatible endpoint. The caller owns
// the loop, the tools and the validation — this module only talks HTTP.
export async function chatCompletion({ messages, tools, signal }) {
  const config = agentConfig()

  if (!config.apiKey || !config.model) {
    throw new AgentError(
      'agent_not_configured',
      'The agent is not configured. Set LLM_API_KEY and LLM_MODEL.',
      503,
    )
  }

  const timeout = AbortSignal.timeout(30_000)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.1,
        max_tokens: 1500,
      }),
      signal: combined,
    })
  } catch (error) {
    if (error?.name === 'TimeoutError') {
      throw new AgentError('llm_timeout', 'The model did not respond in time.', 504)
    }
    if (error?.name === 'AbortError') {
      throw new AgentError('aborted', 'The run was cancelled.', 499)
    }
    throw new AgentError(
      'llm_unreachable',
      'The model endpoint could not be reached.',
    )
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    // Gateways often echo the request messages in an error body, which would
    // put site text and prompt content into the logs. Keep the code only.
    let providerCode = null
    try {
      providerCode = JSON.parse(detail)?.error?.code ?? null
    } catch {
      providerCode = null
    }
    console.error(
      '[agent] provider error',
      response.status,
      providerCode ?? 'no_code',
    )
    throw new AgentError(
      'llm_failed',
      `The model provider returned ${response.status}.`,
    )
  }

  const data = await response.json().catch(() => null)
  const message = data?.choices?.[0]?.message

  if (!message) {
    throw new AgentError('llm_empty', 'The model returned no message.')
  }

  return { message, usage: data.usage ?? null }
}
