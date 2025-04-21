import React from "react";
import MonacoEditor from "@monaco-editor/react";

export default function Editor() {
  return (
    <MonacoEditor
      height="100%"
      defaultLanguage="python"
      defaultValue={`# Write your CadQuery code here\nimport cadquery as cq\n`}
      theme="vs-dark"
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        automaticLayout: true,
        wordWrap: "on",
        scrollBeyondLastLine: false,
      }}
    />
  );
}
