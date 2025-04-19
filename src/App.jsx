// src/App.tsx
import { useState } from "react";
import Editor from "@monaco-editor/react";

function App() {
  const [code, setCode] = useState(
    `import cadquery as cq\n\nresult = cq.Workplane("XY").box(1, 2, 3)`
  );

  return (
    <div className="flex h-screen w-screen">
      <div className="w-1/2 border-r border-gray-300">
        <Editor
          height="100%"
          defaultLanguage="python"
          value={code}
          onChange={(value) => setCode(value || "")}
          options={{
            minimap: {
              enabled: false,
            }
          }}
        />
      </div>
      <div className="w-1/2 p-4">
        <div className="h-full bg-gray-100 flex items-center justify-center">
          3D Viewer Placeholder
        </div>
      </div>
    </div>
  );
}

export default App;
