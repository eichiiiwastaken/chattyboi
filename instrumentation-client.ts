import { initBotId } from "botid/client/core";

const hasSecureWebCrypto =
  globalThis.isSecureContext === true &&
  globalThis.crypto?.subtle !== undefined;

if (hasSecureWebCrypto) {
  initBotId({
    protect: [
      {
        path: "/api/chat",
        method: "POST",
      },
    ],
  });
}
