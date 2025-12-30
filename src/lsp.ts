/**
 * LSP (Language Server Protocol) integration using monaco-languageclient
 */

import { invoke } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { appDataDir } from "@tauri-apps/api/path";
import { initialize, SyncDescriptor } from "@codingame/monaco-vscode-api";
import { MonacoLanguageClient } from "monaco-languageclient";
import { Uri } from "vscode";
import {
  CloseAction,
  ErrorAction,
  MessageTransports,
} from "vscode-languageclient";
import {
  AbstractMessageReader,
  AbstractMessageWriter,
  type DataCallback,
  Disposable,
  type Message,
} from "vscode-jsonrpc/browser";
import "vscode/localExtensionHost";

import { TauriClipboardService } from "./tauriClipboardService";

let languageClient: MonacoLanguageClient | null = null;
let initializingClient: Promise<MonacoLanguageClient> | null = null;
let servicesInitialized = false;

class TauriMessageReader extends AbstractMessageReader {
  public readonly ready: Promise<void>;
  private callback: DataCallback | undefined;
  private listening = false;
  private unlistenPromise: Promise<UnlistenFn>;
  private pendingMessages: Message[] = [];

  constructor() {
    super();

    // Register the Tauri listener immediately so we don't miss early responses
    // (e.g. `initialize` response arriving before the language client calls `listen()`).
    this.unlistenPromise = listen<string>("lsp-response", (event) => {
      try {
        const message = JSON.parse(event.payload) as Message;
        const callback = this.callback;
        if (callback) {
          callback(message);
        } else {
          this.pendingMessages.push(message);
        }
      } catch (error) {
        this.fireError(error);
      }
    });

    this.ready = this.unlistenPromise.then(() => undefined);
  }

  listen(callback: DataCallback): Disposable {
    if (this.listening) {
      throw new Error("TauriMessageReader can only listen once");
    }

    this.listening = true;
    this.callback = callback;

    // Flush anything we buffered before the language client was ready.
    if (this.pendingMessages.length) {
      for (const message of this.pendingMessages) {
        callback(message);
      }
      this.pendingMessages = [];
    }

    return Disposable.create(() => this.dispose());
  }

  override dispose(): void {
    this.callback = undefined;
    this.pendingMessages = [];

    this.unlistenPromise
      .then((unlisten) => unlisten())
      .catch((error) => this.fireError(error));

    super.dispose();
  }
}

class TauriMessageWriter extends AbstractMessageWriter {
  private writeChain: Promise<void> = Promise.resolve();

  write(message: Message): Promise<void> {
    // Maintain message ordering.
    this.writeChain = this.writeChain.then(async () => {
      try {
        await emit("lsp-request", JSON.stringify(message));
      } catch (error) {
        this.fireError(error, message);
        throw error;
      }
    });

    return this.writeChain;
  }

  end(): void {
    this.fireClose();
  }
}

/**
 * Initialize the LSP client with Monaco
 */
export async function initializeLSPClient(): Promise<MonacoLanguageClient> {
  if (languageClient) {
    return languageClient;
  }

  if (initializingClient) {
    return initializingClient;
  }

  const initPromise = (async () => {
    // Initialize VS Code services if not already done
    if (!servicesInitialized) {
      await initialize({
        clipboardService: new SyncDescriptor(TauriClipboardService),
      });
      servicesInitialized = true;
    }

    // Start the LSP server via Tauri
    await invoke("lsp_start");

    // Create message transports over Tauri events
    const reader = new TauriMessageReader();
    await reader.ready;
    const writer = new TauriMessageWriter();

    const workspaceRoot = await appDataDir();

    languageClient = new MonacoLanguageClient({
      name: "Ty Python Language Server",
      clientOptions: {
        documentSelector: [{ language: "python" }],
        // Ensure the server sees a real filesystem-backed workspace root.
        workspaceFolder: {
          uri: Uri.file(workspaceRoot),
          name: "cadet",
          index: 0,
        },
        errorHandler: {
          error: () => ({ action: ErrorAction.Continue }),
          closed: () => ({ action: CloseAction.DoNotRestart }),
        },
      },
      messageTransports: {
        reader,
        writer,
      } satisfies MessageTransports,
    });

    // `ty` requests workspace configuration (server -> client).
    // Handle it directly by method name to avoid protocol imports.
    languageClient.onRequest("workspace/configuration" as any, (params: any) => {
      const items = Array.isArray(params?.items) ? params.items : [];
      return items.map(() => null);
    });

    // Start the client
    await languageClient.start();

    return languageClient;
  })();

  initializingClient = initPromise;

  try {
    return await initPromise;
  } catch (error) {
    console.error("Failed to initialize LSP client:", error);
    languageClient = null;
    throw error;
  } finally {
    initializingClient = null;
  }
}

/**
 * Stop the LSP client
 */
export async function stopLSPClient(): Promise<void> {
  // If we're in the middle of starting up, wait for it to settle so
  // we don't leave the Rust side running with a half-initialized client.
  if (initializingClient) {
    try {
      await initializingClient;
    } catch {
      // ignore
    }
  }

  if (languageClient) {
    try {
      await languageClient.stop();
      await invoke("lsp_stop");
      languageClient = null;
    } catch (error) {
      console.error("Failed to stop LSP client:", error);
    }
  }
}

/**
 * Get the current language client instance
 */
export function getLSPClient(): MonacoLanguageClient | null {
  return languageClient;
}
