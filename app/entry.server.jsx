import {PassThrough} from 'stream';
import {renderToPipeableStream} from 'react-dom/server';
import {RemixServer} from 'react-router';
import {isbot} from 'isbot';
import {addDocumentResponseHeaders} from '@shopify/hydrogen';

const ABORT_DELAY = 5_000;

export default async function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  remixContext,
) {
  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get('user-agent');
  const callbackName = isbot(userAgent ?? '') ? 'onAllReady' : 'onShellReady';

  return new Promise((resolve, reject) => {
    const {pipe, abort} = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} />,
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set('Content-Type', 'text/html');
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

function createReadableStreamFromReadable(readable) {
  return new ReadableStream({
    start(controller) {
      readable.on('data', (chunk) => {
        controller.enqueue(new TextEncoder().encode(chunk));
      });
      readable.on('end', () => controller.close());
      readable.on('error', (err) => controller.error(err));
    },
  });
}
