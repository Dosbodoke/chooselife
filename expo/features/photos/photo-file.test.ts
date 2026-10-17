import {
  checkLocalPhoto,
  MAX_PHOTO_BYTES,
  photoProgress,
  preparePhotoUpload,
  validateStaticPhoto,
  type PhotoError,
} from './photo-file';

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
    return (error as PhotoError).code;
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

  it('rejects unsupported MIME types without trusting extensions', () => {
    for (const mime of ['image/gif', 'image/webp', 'image/heic']) {
      expect(code(() => validateStaticPhoto(JPEG, mime))).toBe(
        'unsupported-type',
      );
    }
  });

  it('identifies the type from the bytes when none was reported', () => {
    for (const mime of ['', null, undefined]) {
      expect(validateStaticPhoto(JPEG, mime).contentType).toBe('image/jpeg');
      expect(validateStaticPhoto(STATIC_PNG, mime).contentType).toBe(
        'image/png',
      );
    }
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(code(() => validateStaticPhoto(gif, null))).toBe('unsupported-type');
    expect(code(() => validateStaticPhoto(ANIMATED_PNG, null))).toBe(
      'animated',
    );
  });

  it('accepts the image/jpg alias', () => {
    expect(validateStaticPhoto(JPEG, 'image/jpg').extension).toBe('jpg');
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
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    big.set(JPEG);
    expect(code(() => validateStaticPhoto(big, 'image/jpeg'))).toBe(
      'too-large',
    );
  });
});

describe('checkLocalPhoto', () => {
  it('rejects declared unsupported types and oversized files on pick', () => {
    expect(
      code(() => checkLocalPhoto({ uri: 'a', mimeType: 'image/heic' })),
    ).toBe('unsupported-type');
    expect(
      code(() =>
        checkLocalPhoto({
          uri: 'a',
          mimeType: 'image/jpeg',
          fileSize: MAX_PHOTO_BYTES + 1,
        }),
      ),
    ).toBe('too-large');
  });

  it('leaves a missing type for the byte check', () => {
    expect(code(() => checkLocalPhoto({ uri: 'a', mimeType: null }))).toBe(
      'ok',
    );
  });
});

describe('preparePhotoUpload', () => {
  it('reads and validates the bytes', async () => {
    const read = jest.fn(async () => STATIC_PNG.slice().buffer);
    await expect(
      preparePhotoUpload({ uri: 'file:///a.png', mimeType: 'image/png' }, read),
    ).resolves.toMatchObject({ contentType: 'image/png', extension: 'png' });
    expect(read).toHaveBeenCalledWith('file:///a.png');
  });

  it('reports an unreadable photo', async () => {
    await expect(
      preparePhotoUpload({ uri: 'file:///gone.jpg' }, async () => {
        throw new Error('ENOENT');
      }),
    ).rejects.toMatchObject({ code: 'unreadable' });
  });
});

describe('photoProgress', () => {
  it('only moves forward across the steps', () => {
    const values = [
      photoProgress('preparing'),
      photoProgress('sending'),
      photoProgress('sending', 0.5),
      photoProgress('sending', 1),
      photoProgress('saving'),
    ].map((p) => p.progress);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
    expect(values[values.length - 1]).toBeLessThan(1);
    expect(photoProgress('sending', 7).progress).toBe(
      photoProgress('sending', 1).progress,
    );
  });
});
