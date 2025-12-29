import React, { useState } from "react";
import MonacoEditor from "@monaco-editor/react";

const DEFAULT_CODE = `import cadquery as cq
result = cq.Workplane("XY").box(10, 10, 10)`;

export default function Editor({ code, onCodeChange }) {
  const [internalCode, setInternalCode] = useState(DEFAULT_CODE);

  const editorValue = code ?? internalCode;

  const handleEditorChange = (value) => {
    const next = value ?? "";
    if (onCodeChange) {
      onCodeChange(next);
      return;
    }
    setInternalCode(next);
  };

  return (
    <div className="flex-1 h-full bg-[#1e1e1e]">
      <div className="h-full relative bg-[#1e1e1e]">
        <MonacoEditor
          height="100%"
          defaultLanguage="python"
          value={editorValue}
          onChange={handleEditorChange}
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
