// @ts-nocheck
import React, { useState, useEffect } from "react";
import { appDataDir } from "@tauri-apps/api/path";
import MonacoEditor from "@monaco-editor/react";
import {
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
} from "vscode-languageclient";
import { initializeLSPClient, stopLSPClient } from "./lsp";

const DEFAULT_CODE = `import cadquery as cq
result = cq.Workplane("XY").box(10, 10, 10)`;

export default function Editor({
  code,
  onCodeChange,
}: {
  code?: string;
  onCodeChange?: (code: string) => void;
}) {
  const [internalCode, setInternalCode] = useState(DEFAULT_CODE);

  const editorValue = code ?? internalCode;

  // Stop LSP on unmount
  useEffect(() => {
    return () => {
      stopLSPClient();
    };
  }, []);

  const handleEditorChange = (value: string | undefined) => {
    const next = value ?? "";
    if (onCodeChange) {
      onCodeChange(next);
    } else {
      setInternalCode(next);
    }
  };

  const handleEditorDidMount = async (editor: any, monaco: any) => {
    try {
      // Give the Monaco model a real file:// URI.
      // `ty` rejects Monaco's default `inmemory://model/...` document/workspace URIs.
      const workspaceRoot = await appDataDir();
      const normalizedRoot = workspaceRoot.replace(/\\/g, "/").replace(/\/$/, "");
      const modelUri = monaco.Uri.file(`${normalizedRoot}/code.py`);

      const previousModel = editor.getModel?.();

      let model = monaco.editor.getModel(modelUri);
      if (!model) {
        model = monaco.editor.createModel(editor.getValue(), "python", modelUri);
      }

      editor.setModel(model);

      if (previousModel && previousModel !== model && previousModel.uri?.scheme !== "file") {
        previousModel.dispose();
      }

      const client = await initializeLSPClient();

      // Ensure the JSON-RPC / initialize handshake completed.
      if (typeof (client as any).onReady === "function") {
        await (client as any).onReady();
      }

      const documentUri = modelUri.toString();
      let version = 1;

      // Manually sync Monaco model changes to the LSP.
      // We don't rely on VS Code text document services here because the editor is created
      // via `@monaco-editor/react` (not the monaco-languageclient EditorApp).
      client.sendNotification(DidOpenTextDocumentNotification.type, {
        textDocument: {
          uri: documentUri,
          languageId: "python",
          version,
          text: model.getValue(),
        },
      });

      const contentListener = model.onDidChangeContent((event: any) => {
        version += 1;
        const contentChanges = event.changes.map((change: any) => ({
          range: {
            start: {
              line: change.range.startLineNumber - 1,
              character: change.range.startColumn - 1,
            },
            end: {
              line: change.range.endLineNumber - 1,
              character: change.range.endColumn - 1,
            },
          },
          rangeLength: change.rangeLength,
          text: change.text,
        }));

        client.sendNotification(DidChangeTextDocumentNotification.type, {
          textDocument: {
            uri: documentUri,
            version,
          },
          contentChanges,
        });
      });

      const completionProvider = monaco.languages.registerCompletionItemProvider(
        "python",
        {
          triggerCharacters: ["."],
          provideCompletionItems: async (
            completionModel: any,
            position: any,
            context: any,
            token: any
          ) => {
            if (completionModel.uri.toString() !== documentUri) {
              return { suggestions: [] };
            }

            const word = completionModel.getWordUntilPosition(position);
            const range = new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn
            );

            const response = await client.sendRequest("textDocument/completion", {
              textDocument: { uri: documentUri },
              position: {
                line: position.lineNumber - 1,
                character: position.column - 1,
              },
              context: {
                triggerKind: context?.triggerKind,
                triggerCharacter: context?.triggerCharacter,
              },
            });

            const items = Array.isArray(response)
              ? response
              : response?.items ?? [];

            const suggestions = items.map((item: any) => {
              const insertText = item.insertText ?? item.label;
              const kind = item.kind ?? 0;
              const sortText = item.sortText ?? "";

              const kindMap: Record<number, number> = {
                1: monaco.languages.CompletionItemKind.Text,
                2: monaco.languages.CompletionItemKind.Method,
                3: monaco.languages.CompletionItemKind.Function,
                4: monaco.languages.CompletionItemKind.Constructor,
                5: monaco.languages.CompletionItemKind.Field,
                6: monaco.languages.CompletionItemKind.Variable,
                7: monaco.languages.CompletionItemKind.Class,
                8: monaco.languages.CompletionItemKind.Interface,
                9: monaco.languages.CompletionItemKind.Module,
                10: monaco.languages.CompletionItemKind.Property,
                11: monaco.languages.CompletionItemKind.Unit,
                12: monaco.languages.CompletionItemKind.Value,
                13: monaco.languages.CompletionItemKind.Enum,
                14: monaco.languages.CompletionItemKind.Keyword,
                15: monaco.languages.CompletionItemKind.Snippet,
                16: monaco.languages.CompletionItemKind.Color,
                17: monaco.languages.CompletionItemKind.File,
                18: monaco.languages.CompletionItemKind.Reference,
                19: monaco.languages.CompletionItemKind.Folder,
                20: monaco.languages.CompletionItemKind.EnumMember,
                21: monaco.languages.CompletionItemKind.Constant,
                22: monaco.languages.CompletionItemKind.Struct,
                23: monaco.languages.CompletionItemKind.Event,
                24: monaco.languages.CompletionItemKind.Operator,
                25: monaco.languages.CompletionItemKind.TypeParameter,
              };

              const documentation =
                typeof item.documentation === "string"
                  ? item.documentation
                  : item.documentation?.value;

              return {
                label: item.label,
                kind: kindMap[kind] ?? monaco.languages.CompletionItemKind.Text,
                insertText,
                sortText,
                insertTextRules:
                  item.insertTextFormat === 2
                    ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                    : monaco.languages.CompletionItemInsertTextRule.KeepWhitespace,
                range,
                detail: item.detail,
                documentation,
              };
            });

            return { suggestions };
          },
        }
      );

      // Ensure the doc is closed when the editor is disposed.
      editor.onDidDispose?.(() => {
        try {
          contentListener.dispose();
        } catch {
          // ignore
        }

        try {
          completionProvider.dispose();
        } catch {
          // ignore
        }

        try {
          client.sendNotification(DidCloseTextDocumentNotification.type, {
            textDocument: { uri: documentUri },
          });
        } catch {
          // ignore
        }
      });
    } catch (error) {
      console.error("Failed to setup LSP:", error);
    }
  };

  return (
    <div className="flex-1 h-full bg-[#1e1e1e]">
      <div className="h-full relative bg-[#1e1e1e]">
        <MonacoEditor
          height="100%"
          defaultLanguage="python"
          value={editorValue}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          loading={null}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            automaticLayout: true,
            wordWrap: "on",
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            fontFamily:
              "'JetBrains Mono', 'Fira Code', Monaco, 'Courier New', monospace",
            lineNumbers: "on",
            renderLineHighlight: "all",
            scrollbar: {
              vertical: "visible",
              horizontal: "visible",
              useShadows: true,
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
          }}
        />
      </div>
    </div>
  );
}

export { DEFAULT_CODE };
