import React, { useState } from "react";
import Editor from "./Editor";
import Renderer from "./Renderer";

export default function App() {
  const [modelPath, setModelPath] = useState(null);

  return (
   <div className="flex h-screen v-screen">
      {/* Monaco Editor (Left) */}
      <div className="w-1/2 border-r border-gray-300">
        <Editor onExport={(path) => setModelPath(path)} />
      </div>

      {/* Live Preview Placeholder (Right) */}
      <div
        className="w-1/2 flex items-center justify-center bg-gray-100"
        id="viewer-container"
      >
        <Renderer modelPath={modelPath}/>
      </div>
    </div>
  );
}
