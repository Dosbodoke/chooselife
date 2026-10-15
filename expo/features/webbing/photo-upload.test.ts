import {
  MAX_WEBBING_PHOTO_BYTES,
  saveWebbingPhoto,
  validateStaticPhoto,
  WebbingPhotoError,
  type WebbingPhotoDeps,
} from './photo-upload';

function chunk(type: string, data: number[] = []) {
  const length = [24, 16, 8, 0].map((shift) => (data.length >>> shift) & 0xff);
  return [
    ...length,
    ...[...type].map((c) => c.charCodeAt(0)),
    ...data,
    0,
    0,
    0,
    0,
  ];
}
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (...chunks: number[][]) =>
  new Uint8Array([...SIGNATURE, ...chunks.flat()]);
const STATIC_PNG = png(
  chunk('IHDR', new Array(13).fill(0)),
  chunk('IDAT', [1, 2]),
  chunk('IEND'),
);
const ANIMATED_PNG = png(
  chunk('IHDR', new Array(13).fill(0)),
  chunk('acTL', new Array(8).fill(0)),
  chunk('IDAT', [1]),
  chunk('IEND'),
);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as WebbingPhotoError).code;
  }
  return 'ok';
};

describe('validateStaticPhoto', () => {
  it('accepts static JPEG and PNG matching the reported type', () => {
    expect(validateStaticPhoto(JPEG, 'image/jpeg')).toEqual({
      contentType: 'image/jpeg',
      extension: 'jpg',
    });
    expect(validateStaticPhoto(STATIC_PNG, 'image/png').extension).toBe('png');
  });

  it('rejects unsupported and unknown MIME types without trusting extensions', () => {
    for (const mime of [
      'image/gif',
      'image/webp',
      'image/heic',
      '',
      null,
      undefined,
    ]) {
      expect(code(() => validateStaticPhoto(JPEG, mime))).toBe(
        'unsupported-type',
      );
    }
  });

  it('rejects animated PNG and MIME/signature mismatches', () => {
    expect(code(() => validateStaticPhoto(ANIMATED_PNG, 'image/png'))).toBe(
      'animated',
    );
    expect(code(() => validateStaticPhoto(STATIC_PNG, 'image/jpeg'))).toBe(
      'invalid-image',
    );
    expect(code(() => validateStaticPhoto(JPEG, 'image/png'))).toBe(
      'invalid-image',
    );
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(code(() => validateStaticPhoto(gif, 'image/png'))).toBe(
      'invalid-image',
    );
  });

  it('rejects truncated or malformed PNG chunks', () => {
    expect(
      code(() => validateStaticPhoto(STATIC_PNG.slice(0, 30), 'image/png')),
    ).toBe('invalid-image');
    const noEnd = png(chunk('IHDR', new Array(13).fill(0)), chunk('IDAT', [1]));
    expect(code(() => validateStaticPhoto(noEnd, 'image/png'))).toBe(
      'invalid-image',
    );
    const lying = STATIC_PNG.slice();
    lying[8 + 3] = 0xff; // IHDR length beyond the buffer
    expect(code(() => validateStaticPhoto(lying, 'image/png'))).toBe(
      'invalid-image',
    );
    const notHeaderFirst = png(chunk('IDAT', [1]), chunk('IEND'));
    expect(code(() => validateStaticPhoto(notHeaderFirst, 'image/png'))).toBe(
      'invalid-image',
    );
  });

  it('enforces the actual byte size', () => {
    const big = new Uint8Array(MAX_WEBBING_PHOTO_BYTES + 1);
    big.set(JPEG);
    expect(code(() => validateStaticPhoto(big, 'image/jpeg'))).toBe(
      'too-large',
    );
  });
});

type UpdateResult = ReturnType<WebbingPhotoDeps['updateImagePath']>;

/** Fake row + object store; `row.image_path` is the committed truth. */
function harness(initialPath: string | null = 'owner/1/old.jpg') {
  const row = { image_path: initialPath };
  const objects = new Set<string>(initialPath ? [initialPath] : []);
  let n = 0;
  const deps = {
    readAsset: jest.fn(async () => JPEG.buffer.slice(0) as ArrayBuffer),
    upload: jest.fn(async (key: string) => {
      const path = `owner/${key}`;
      objects.add(path);
      return path;
    }),
    remove: jest.fn(async (path: string) => {
      objects.delete(path);
    }),
    updateImagePath: jest.fn<UpdateResult, [string | null]>(async (path) => {
      row.image_path = path;
      return { data: { image_path: path }, error: null };
    }),
    readImagePath: jest.fn(async () => row.image_path),
    createId: () => `photo-${++n}`,
  } satisfies WebbingPhotoDeps;
  return { row, objects, deps };
}

const asset = { uri: 'file:///photo.jpg', mimeType: 'image/jpeg', fileSize: 6 };

describe('saveWebbingPhoto', () => {
  it('commits the new key before deleting the previous object', async () => {
    const { row, objects, deps } = harness();
    const path = await saveWebbingPhoto({
      webbingId: 1,
      previousPath: row.image_path,
      asset,
      deps,
    });
    expect(path).toBe('owner/1/photo-1.jpg');
    expect(row.image_path).toBe(path);
    expect([...objects]).toEqual([path]);
    expect(deps.updateImagePath.mock.invocationCallOrder[0]).toBeLessThan(
      deps.remove.mock.invocationCallOrder[0],
    );
  });

  it('keeps the committed row when the old-object delete fails', async () => {
    const { row, deps } = harness();
    deps.remove.mockRejectedValueOnce(new Error('R2 down'));
    await expect(
      saveWebbingPhoto({
        webbingId: 1,
        previousPath: row.image_path,
        asset,
        deps,
      }),
    ).resolves.toBe('owner/1/photo-1.jpg');
  });

  it('cleans up the new object on a definitive rejection and keeps the old key', async () => {
    const { row, objects, deps } = harness();
    deps.updateImagePath.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'denied' },
    });
    await expect(
      saveWebbingPhoto({
        webbingId: 1,
        previousPath: row.image_path,
        asset,
        deps,
      }),
    ).rejects.toMatchObject({ code: 'rejected' });
    expect(row.image_path).toBe('owner/1/old.jpg');
    expect([...objects]).toEqual(['owner/1/old.jpg']);
  });

  it('recovers success when the update committed but its response was lost', async () => {
    const { row, objects, deps } = harness();
    deps.updateImagePath.mockImplementationOnce(async (path) => {
      row.image_path = path;
      throw new TypeError('Network request failed');
    });
    const path = await saveWebbingPhoto({
      webbingId: 1,
      previousPath: 'owner/1/old.jpg',
      asset,
      deps,
    });
    expect(path).toBe('owner/1/photo-1.jpg');
    expect([...objects]).toEqual([path]);
  });

  it('removes the unreferenced new object when read-back shows the old key', async () => {
    const { row, objects, deps } = harness();
    deps.updateImagePath.mockImplementationOnce(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(
      saveWebbingPhoto({
        webbingId: 1,
        previousPath: row.image_path,
        asset,
        deps,
      }),
    ).rejects.toMatchObject({ code: 'upload-failed' });
    expect([...objects]).toEqual(['owner/1/old.jpg']);
  });

  it('preserves both objects when read-back fails, then reconciles before retrying', async () => {
    const { row, objects, deps } = harness();
    deps.updateImagePath.mockImplementationOnce(async (path) => {
      row.image_path = path;
      return {
        data: null,
        error: { code: '', message: 'TypeError: Network request failed' },
      };
    });
    deps.readImagePath.mockRejectedValueOnce(new TypeError('offline'));

    const error = await saveWebbingPhoto({
      webbingId: 1,
      previousPath: 'owner/1/old.jpg',
      asset,
      deps,
    }).catch((e: WebbingPhotoError) => e);
    expect(error).toMatchObject({
      code: 'unconfirmed',
      pendingPath: 'owner/1/photo-1.jpg',
    });
    expect(objects.size).toBe(2);

    // Retry reconciles first and finds the pending key committed: no new upload.
    const path = await saveWebbingPhoto({
      webbingId: 1,
      previousPath: 'owner/1/old.jpg',
      asset,
      pendingPath: (error as WebbingPhotoError).pendingPath,
      deps,
    });
    expect(path).toBe('owner/1/photo-1.jpg');
    expect(deps.upload).toHaveBeenCalledTimes(1);
    expect([...objects]).toEqual(['owner/1/photo-1.jpg']);
  });

  it('reports a conflict and deletes nothing when another path was committed', async () => {
    const { row, objects, deps } = harness();
    deps.updateImagePath.mockImplementationOnce(async () => {
      row.image_path = 'owner/1/other-device.jpg';
      throw new TypeError('Network request failed');
    });
    await expect(
      saveWebbingPhoto({
        webbingId: 1,
        previousPath: 'owner/1/old.jpg',
        asset,
        deps,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(deps.remove).not.toHaveBeenCalled();
    expect(objects.has('owner/1/photo-1.jpg')).toBe(true);
  });

  it('removes only the personal photo and confirms a lost remove response', async () => {
    const { row, objects, deps } = harness();
    deps.updateImagePath.mockImplementationOnce(async (path) => {
      row.image_path = path;
      throw new TypeError('Network request failed');
    });
    await expect(
      saveWebbingPhoto({
        webbingId: 1,
        previousPath: 'owner/1/old.jpg',
        asset: null,
        deps,
      }),
    ).resolves.toBeNull();
    expect(deps.upload).not.toHaveBeenCalled();
    expect(objects.size).toBe(0);
  });

  it('rejects unsupported assets before reading or uploading', async () => {
    const { deps } = harness();
    await expect(
      saveWebbingPhoto({
        webbingId: 1,
        previousPath: null,
        asset: { uri: 'file:///a.gif', mimeType: 'image/gif' },
        deps,
      }),
    ).rejects.toMatchObject({ code: 'unsupported-type' });
    await expect(
      saveWebbingPhoto({
        webbingId: 1,
        previousPath: null,
        asset: { ...asset, fileSize: MAX_WEBBING_PHOTO_BYTES + 1 },
        deps,
      }),
    ).rejects.toMatchObject({ code: 'too-large' });
    expect(deps.readAsset).not.toHaveBeenCalled();
    expect(deps.upload).not.toHaveBeenCalled();
  });
});
