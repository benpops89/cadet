import React, { useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import { appDataDir } from "@tauri-apps/api/path";
import { invoke } from '@tauri-apps/api/core';

export default function Editor({ onExport }) {
  const [code, setCode] = useState(`import cadquery as cq\nresult = cq.Workplane("XY").box(10, 10, 10)`);

  // Handle Monaco Editor change event
  const handleEditorChange = (value) => {
    setCode(value);
  };

  // Send the code to backend for processing
  const handleExport = async () => {
    try {
      const addDataDirPath = await appDataDir();
      console.log(addDataDirPath);
      const filePath = await invoke('generate_model', {
        code: code,
        format: "stl",
        outputPath: addDataDirPath,
      });
      console.log("Model exported to: ", filePath);
      onExport(filePath);
      // Assuming Renderer component takes STL data and renders it
      // You can pass the stlData to your Renderer component here
    } catch (error) {
      console.error("Error generating STL:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Monaco Editor (Top part) */}
      <div className="flex-1">
        <MonacoEditor
          height="100%"  // Let Monaco take all available height in the flex container
          defaultLanguage="python"
          value={code}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            automaticLayout: true,
            wordWrap: "on",
            scrollBeyondLastLine: false,
          }}
        />
      </div>

      {/* Generate STL Button (Bottom part) */}
      <div className="mt-4 p-4">
        <button
          onClick={handleExport}
          className="w-full py-2 bg-blue-500 text-white rounded"
        >
          Generate STL
        </button>
      </div>
    </div>
  );
}
