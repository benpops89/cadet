import React, { useState, useRef, useEffect } from "react";
import { appDataDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import Editor, { DEFAULT_CODE } from "./Editor";
import Renderer from "./Renderer";
import Sidebar from "./Sidebar";

export default function App() {
  const [modelPath, setModelPath] = useState(null);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editorWidth, setEditorWidth] = useState(50); // percentage
  const isDragging = useRef(false);

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      const addDataDirPath = await appDataDir();
      const filePath = await invoke("generate_model", {
        code,
        format: "stl",
        outputPath: addDataDirPath,
      });
      setModelPath(filePath);
    } catch (error) {
      console.error("Error generating STL:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setCode(DEFAULT_CODE);
  };

  const handleMouseDown = (e) => {
    isDragging.current = true;
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    
    const container = document.querySelector('.main-container');
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Constrain between 20% and 80%
    if (newWidth >= 20 && newWidth <= 80) {
      setEditorWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  useEffect(() => {
    const loadingEl = document.getElementById('app-loading');
    if (loadingEl) loadingEl.remove();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="flex h-screen">
      {/* Global Sidebar */}
      <Sidebar
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
        onReset={handleReset}
      />

      {/* Main area (Editor + Renderer) */}
      <div className="flex flex-1 min-w-0 main-container">
        <div 
          className="min-w-0 bg-[#1e1e1e]"
          style={{ width: `${editorWidth}%` }}
        >
          <Editor code={code} onCodeChange={setCode} />
        </div>

        {/* Draggable divider */}
        <div
          className="w-1 bg-gray-700 hover:bg-gray-500 cursor-col-resize transition-colors relative group"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        <div 
          className="min-w-0 bg-[#1e1e1e]"
          style={{ width: `${100 - editorWidth}%` }}
        >
          <Renderer modelPath={modelPath} />
        </div>
      </div>
    </div>
  );
}
