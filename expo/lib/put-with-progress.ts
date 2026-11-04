/** Progress is reported in steps of 2%, so a fast network can't flood renders. */
const PROGRESS_STEPS = 50;

/**
 * PUT a body and report the share of bytes sent (0–1). `fetch` has no upload
 * progress in React Native; XMLHttpRequest does.
 */
export function putWithProgress(
  url: string,
  body: ArrayBuffer,
  contentType: string,
  onProgress: (sent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let lastStep = -1;
    request.open('PUT', url);
    request.setRequestHeader('Content-Type', contentType);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      const step = Math.floor((event.loaded / event.total) * PROGRESS_STEPS);
      if (step === lastStep) return;
      lastStep = step;
      onProgress(step / PROGRESS_STEPS);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();
        return;
      }
      reject(new Error(`Upload failed with status ${request.status}`));
    };
    request.onerror = () => reject(new Error('Upload failed'));
    request.ontimeout = () => reject(new Error('Upload timed out'));
    request.send(body);
  });
}
