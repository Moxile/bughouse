import { ClientMessage, ServerMessage, S_State } from '@bughouse/shared';

type Handler = (msg: ServerMessage) => void;

export class GameSocket {
  private ws: WebSocket | null = null;
  private handlers: Handler[] = [];
  private queue: ClientMessage[] = [];

  connect(code: string): void {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws.onopen = () => {
      const playerId = sessionStorage.getItem('playerId') ?? undefined;
      this.send({ type: 'join', code, playerId });
      for (const msg of this.queue) this.sendRaw(msg);
      this.queue = [];
    };
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as ServerMessage;
      if (msg.type === 'welcome') {
        sessionStorage.setItem('playerId', msg.playerId);
      }
      for (const h of this.handlers) h(msg);
    };
    this.ws.onclose = () => {
      // Attempt reconnect after 2s.
      setTimeout(() => this.connect(code), 2000);
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendRaw(msg);
    } else {
      this.queue.push(msg);
    }
  }

  onMessage(handler: Handler): () => void {
    this.handlers.push(handler);
    return () => { this.handlers = this.handlers.filter((h) => h !== handler); };
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.queue = [];
  }

  private sendRaw(msg: ClientMessage): void {
    this.ws!.send(JSON.stringify(msg));
  }
}
