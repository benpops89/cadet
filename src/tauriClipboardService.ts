import { hash } from "@codingame/monaco-vscode-api/vscode/vs/base/common/hash";
import { URI } from "@codingame/monaco-vscode-api/vscode/vs/base/common/uri";

const MAX_RESOURCE_STATE_SOURCE_LENGTH = 1000;

type ClipboardPlugin = {
  readText: () => Promise<string>;
  writeText: (text: string) => Promise<void>;
};

async function getClipboardPlugin(): Promise<ClipboardPlugin> {
  // This dependency is provided at runtime by the Tauri clipboard manager plugin.
  // We load it dynamically so the codebase still typechecks before `bun install`.
  // @ts-expect-error - installed by the app, not necessarily present in CI.
  return (await import("@tauri-apps/plugin-clipboard-manager")) as ClipboardPlugin;
}

export class TauriClipboardService {
  // VS Code DI marker
  readonly _serviceBrand: undefined;

  private readonly mapTextToType = new Map<string, string>();
  private findText = "";

  private resources: URI[] = [];
  private resourcesStateHash: number | undefined;

  triggerPaste(_targetWindowId: number): Promise<void> | undefined {
    return undefined;
  }

  async writeText(text: string, type?: string): Promise<void> {
    this.clearResourcesState();

    if (type) {
      this.mapTextToType.set(type, text);
      return;
    }

    const clipboard = await getClipboardPlugin();
    await clipboard.writeText(text);
  }

  async readText(type?: string): Promise<string> {
    if (type) {
      return this.mapTextToType.get(type) || "";
    }

    try {
      const clipboard = await getClipboardPlugin();
      return await clipboard.readText();
    } catch {
      return "";
    }
  }

  async readFindText(): Promise<string> {
    return this.findText;
  }

  async writeFindText(text: string): Promise<void> {
    this.findText = text;
  }

  async writeResources(resources: URI[]): Promise<void> {
    // Tauri's clipboard manager plugin is text/image focused; VS Code uses a custom mime type
    // for resources. Keep those purely in-memory.
    if (resources.length === 0) {
      this.clearResourcesState();
      return;
    }

    this.resources = resources;
    this.resourcesStateHash = await this.computeResourcesStateHash();
  }

  async readResources(): Promise<URI[]> {
    const currentStateHash = await this.computeResourcesStateHash();
    if (this.resourcesStateHash !== currentStateHash) {
      this.clearResourcesState();
    }

    return this.resources;
  }

  async hasResources(): Promise<boolean> {
    return this.resources.length > 0;
  }

  clearInternalState(): void {
    this.clearResourcesState();
  }

  async readImage(): Promise<Uint8Array> {
    // Not currently required by the app.
    return new Uint8Array(0);
  }

  private async computeResourcesStateHash(): Promise<number | undefined> {
    if (this.resources.length === 0) {
      return undefined;
    }

    const clipboardText = await this.readText();
    return hash(clipboardText.substring(0, MAX_RESOURCE_STATE_SOURCE_LENGTH));
  }

  private clearResourcesState(): void {
    this.resources = [];
    this.resourcesStateHash = undefined;
  }
}
