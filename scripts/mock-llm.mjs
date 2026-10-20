import http from 'node:http'

// A deliberately scripted OpenAI-compatible endpoint for tests. It is not a
// fake agent shipped to users: it exists so the tool loop, streaming and UI can
// be exercised without an API key. Real runs use LLM_BASE_URL/LLM_API_KEY.

const PORT = Number(process.env.MOCK_LLM_PORT ?? 5199)
let counter = 0

function toolCall(name, args) {
  counter += 1
  return {
    id: `call_mock_${counter}`,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  }
}

function completion(toolCalls) {
  return {
    id: `chatcmpl-mock-${counter}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'mock-1',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: null, tool_calls: toolCalls },
        finish_reason: 'tool_calls',
      },
    ],
    usage: { prompt_tokens: 800, completion_tokens: 120, total_tokens: 920 },
  }
}

function parsedTools(messages) {
  return messages
    .filter((message) => message.role === 'tool')
    .map((message) => {
      // run.js wraps each result in an untrusted-data envelope; parse the JSON
      // that follows the first newline.
      const text = String(message.content ?? '')
      const marker = text.indexOf('\n')
      const json = marker >= 0 ? text.slice(marker + 1) : text
      try {
        return JSON.parse(json)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function finishMessage(messages) {
  const page = [...parsedTools(messages)].reverse().find((tool) => tool.finalUrl)
  const headers = page?.headers ?? {}
  const dns = parsedTools(messages).find(
    (tool) => tool.type === 'TXT' && tool.ok !== false,
  )

  const findings = []

  if (!headers['strict-transport-security']) {
    findings.push({
      title: 'HSTS is not enabled',
      severity: 'medium',
      category: 'transport',
      observation:
        'The document response did not include a Strict-Transport-Security header.',
      impact:
        'A browser can be downgraded to plain HTTP on the first visit, before the redirect to HTTPS is seen.',
      fix: 'Send Strict-Transport-Security with a max-age of at least one year after confirming every subdomain supports HTTPS.',
      evidence: ['headers'],
      confidence: 'high',
    })
  }

  if (!headers['content-security-policy']) {
    findings.push({
      title: 'No Content-Security-Policy',
      severity: 'medium',
      category: 'headers',
      observation:
        'No Content-Security-Policy header was returned with the document.',
      impact:
        'Injected script has no browser-enforced restriction on where it can load code from or send data.',
      fix: 'Start with a report-only policy, then restrict script-src and connect-src to the origins the site actually uses.',
      evidence: ['headers'],
      confidence: 'high',
    })
  }

  if (headers.server) {
    findings.push({
      title: 'Server header discloses the platform',
      severity: 'info',
      category: 'disclosure',
      observation: `The response advertised its server as "${headers.server}".`,
      impact:
        'It removes a small amount of guesswork for an attacker fingerprinting the stack.',
      fix: 'Strip or genericise the Server header at the edge if the platform allows it.',
      evidence: ['headers'],
      confidence: 'medium',
    })
  }

  if (dns && dns.hasDmarc === false) {
    findings.push({
      title: 'No DMARC record',
      severity: 'medium',
      category: 'dns',
      observation: 'The TXT records for the hostname did not include v=DMARC1.',
      impact:
        'Anyone can send mail claiming to be this domain without a published policy telling receivers to reject it.',
      fix: 'Publish a DMARC record starting at p=none with reporting, then move to p=quarantine.',
      evidence: ['dns:TXT'],
      confidence: 'high',
    })
  }

  return {
    summary:
      'The agent observed the transport and header posture, probed two exposure paths and resolved TXT records. No exposed secret or configuration file was confirmed.',
    findings,
  }
}

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.end('ok')
    return
  }

  if (request.method !== 'POST' || !request.url.endsWith('/chat/completions')) {
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'not found' }))
    return
  }

  let raw = ''
  request.on('data', (chunk) => {
    raw += chunk
  })
  request.on('end', () => {
    let body
    try {
      body = JSON.parse(raw)
    } catch {
      response.writeHead(400, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'invalid json' }))
      return
    }

    const messages = body.messages ?? []
    const turn = messages.filter((message) => message.role === 'assistant').length
    let toolCalls

    if (turn === 0) {
      toolCalls = [toolCall('fetch_page', {})]
    } else if (turn === 1) {
      toolCalls = [
        toolCall('probe_path', { path: '/.env' }),
        toolCall('probe_path', { path: '/.git/config' }),
      ]
    } else if (turn === 2) {
      const page = [...parsedTools(messages)].reverse().find((tool) => tool.finalUrl)
      const origin = page?.finalUrl ? new URL(page.finalUrl).origin : 'https://example.com'
      toolCalls = [toolCall('fetch_asset', { url: `${origin}/` })]
    } else if (turn === 3) {
      toolCalls = [toolCall('dns_lookup', { type: 'TXT' })]
    } else {
      toolCalls = [toolCall('finish', finishMessage(messages))]
    }

    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(completion(toolCalls)))
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock-llm listening on http://127.0.0.1:${PORT}`)
})
