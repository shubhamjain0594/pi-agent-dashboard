// Fake LSP server for tests. Speaks Content-Length stdio framing.
// Answers `initialize`, echoes every other request, and asks the client for
// `workspace/configuration` when it receives `trigger/askConfig`.
let buf = Buffer.alloc(0);

function send(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  process.stdout.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]));
}

function handle(msg) {
  if (msg.method === "exit") process.exit(0);
  if (msg.method === "trigger/askConfig") {
    send({ jsonrpc: "2.0", id: 900, method: "workspace/configuration", params: { items: [{ section: "x" }] } });
    return;
  }
  if (msg.id === undefined) return;
  if (msg.method === "initialize") {
    send({ jsonrpc: "2.0", id: msg.id, result: { capabilities: { hoverProvider: true } } });
    return;
  }
  send({ jsonrpc: "2.0", id: msg.id, result: { method: msg.method, params: msg.params ?? null } });
}

process.stdin.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  for (;;) {
    const headerEnd = buf.indexOf("\r\n\r\n");
    if (headerEnd < 0) return;
    const len = Number(/Content-Length:\s*(\d+)/i.exec(buf.subarray(0, headerEnd).toString("ascii"))[1]);
    if (buf.length < headerEnd + 4 + len) return;
    const msg = JSON.parse(buf.subarray(headerEnd + 4, headerEnd + 4 + len).toString("utf8"));
    buf = buf.subarray(headerEnd + 4 + len);
    handle(msg);
  }
});
