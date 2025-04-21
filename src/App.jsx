import React from "react";
import Editor from "./Editor";
import Renderer from "./Renderer";

export default function App() {
  return (
   <div className="flex h-screen v-screen">
      {/* Monaco Editor (Left) */}
      <div className="w-1/2 border-r border-gray-300">
        <Editor/>
      </div>

      {/* Live Preview Placeholder (Right) */}
      <div
        className="w-1/2 flex items-center justify-center bg-gray-100"
        id="viewer-container"
      >
        <Renderer/>
      </div>
    </div>
  );
}
