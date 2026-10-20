import { putWithProgress } from './put-with-progress';

type Handler = ((event?: unknown) => void) | null;

/** Minimal XMLHttpRequest double; `respond` plays the network's part. */
class FakeRequest {
  static last: FakeRequest;
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: unknown;
  status = 0;
  upload: { onprogress: Handler } = { onprogress: null };
  onload: Handler = null;
  onerror: Handler = null;
  ontimeout: Handler = null;

  constructor() {
    FakeRequest.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
  }
  progress(loaded: number, total = 100) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total });
  }
  respond(status: number) {
    this.status = status;
    this.onload?.();
  }
}

beforeEach(() => {
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = FakeRequest;
});

describe('putWithProgress', () => {
  it('PUTs the body with its content type and resolves on 2xx', async () => {
    const body = new ArrayBuffer(4);
    const done = putWithProgress('https://r2/key', body, 'image/png', () => {});
    const request = FakeRequest.last;
    expect(request).toMatchObject({
      method: 'PUT',
      url: 'https://r2/key',
      headers: { 'Content-Type': 'image/png' },
      body,
    });
    request.respond(200);
    await expect(done).resolves.toBeUndefined();
  });

  it('reports coarse, forward-only progress and finishes at 1', async () => {
    const seen: number[] = [];
    const done = putWithProgress('u', new ArrayBuffer(1), 'image/jpeg', (p) =>
      seen.push(p),
    );
    const request = FakeRequest.last;
    request.progress(10);
    request.progress(10.5); // same 2% step: ignored
    request.progress(11);
    request.progress(50);
    request.respond(204);
    await done;
    expect(seen).toEqual([0.1, 0.5, 1]);
  });

  it('rejects on HTTP and network failures', async () => {
    const failed = putWithProgress(
      'u',
      new ArrayBuffer(1),
      'image/png',
      () => {},
    );
    FakeRequest.last.respond(403);
    await expect(failed).rejects.toThrow('403');

    const offline = putWithProgress(
      'u',
      new ArrayBuffer(1),
      'image/png',
      () => {},
    );
    FakeRequest.last.onerror?.();
    await expect(offline).rejects.toThrow('Upload failed');
  });
});
