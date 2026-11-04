import { MAX_PHOTO_BYTES, type PhotoError } from '~/features/photos/photo-file';

import { saveWebbingPhoto, type WebbingPhotoDeps } from './photo-upload';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

type UpdateResult = ReturnType<WebbingPhotoDeps['updateImagePath']>;

/** Fake row + object store; `row.image_path` is the committed truth. */
function harness(initialPath: string | null = 'owner/1/old.jpg') {
  const row = { image_path: initialPath };
  const objects = new Set<string>(initialPath ? [initialPath] : []);
  let n = 0;
  const deps = {
    readAsset: jest.fn(async () => JPEG.buffer.slice(0) as ArrayBuffer),
    upload: jest.fn<
      Promise<string>,
      [string, ArrayBuffer, string, ((sent: number) => void)?]
    >(async (key) => {
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
    }).catch((e: PhotoError) => e);
    expect(error).toMatchObject({
      code: 'unconfirmed',
      pending: { path: 'owner/1/photo-1.jpg', sourceUri: asset.uri },
    });
    expect(objects.size).toBe(2);

    // Retry reconciles first and finds the pending key committed: no new upload.
    const path = await saveWebbingPhoto({
      webbingId: 1,
      previousPath: 'owner/1/old.jpg',
      asset,
      pending: (error as PhotoError).pending,
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
        asset: { ...asset, fileSize: MAX_PHOTO_BYTES + 1 },
        deps,
      }),
    ).rejects.toMatchObject({ code: 'too-large' });
    expect(deps.readAsset).not.toHaveBeenCalled();
    expect(deps.upload).not.toHaveBeenCalled();
  });
  it('applies a different photo after the pending upload turns out committed', async () => {
    const { row, objects, deps } = harness();
    // An earlier attempt committed photo-1 but its response was lost.
    row.image_path = 'owner/1/photo-1.jpg';
    objects.add('owner/1/photo-1.jpg');
    deps.createId = () => 'photo-2';
    const path = await saveWebbingPhoto({
      webbingId: 1,
      previousPath: 'owner/1/old.jpg',
      asset: { ...asset, uri: 'file:///other.jpg' },
      pending: { path: 'owner/1/photo-1.jpg', sourceUri: asset.uri },
      deps,
    });
    expect(path).toBe('owner/1/photo-2.jpg');
    expect(row.image_path).toBe(path);
    expect([...objects]).toEqual([path]);
  });

  it('removes the photo when asked to, even after a committed pending upload', async () => {
    const { row, objects, deps } = harness();
    row.image_path = 'owner/1/photo-1.jpg';
    objects.add('owner/1/photo-1.jpg');
    await expect(
      saveWebbingPhoto({
        webbingId: 1,
        previousPath: 'owner/1/old.jpg',
        asset: null,
        pending: { path: 'owner/1/photo-1.jpg', sourceUri: asset.uri },
        deps,
      }),
    ).resolves.toBeNull();
    expect(row.image_path).toBeNull();
    expect(objects.size).toBe(0);
  });

  it('keeps the pending source when the reconcile read fails again', async () => {
    const { deps } = harness();
    deps.readImagePath.mockRejectedValueOnce(new TypeError('offline'));
    const pending = { path: 'owner/1/photo-1.jpg', sourceUri: asset.uri };
    await expect(
      saveWebbingPhoto({
        webbingId: 1,
        previousPath: 'owner/1/old.jpg',
        asset,
        pending,
        deps,
      }),
    ).rejects.toMatchObject({ code: 'unconfirmed', pending });
  });

  it('reports monotonic progress from preparing to saving', async () => {
    const { row, deps } = harness();
    deps.upload.mockImplementationOnce(
      async (key, _body, _type, onProgress) => {
        onProgress?.(0.5);
        onProgress?.(1);
        return `owner/${key}`;
      },
    );
    const steps: string[] = [];
    const values: number[] = [];
    await saveWebbingPhoto({
      webbingId: 1,
      previousPath: row.image_path,
      asset,
      onProgress: (p) => {
        steps.push(p.step);
        values.push(p.progress);
      },
      deps,
    });
    expect(steps[0]).toBe('preparing');
    expect(steps[steps.length - 1]).toBe('saving');
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });
});
