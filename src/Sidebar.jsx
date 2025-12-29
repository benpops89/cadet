import React from "react";
import {
  PlayIcon,
  ArrowDownTrayIcon,
  FolderOpenIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";

export default function Sidebar({ isGenerating, onGenerate, onReset }) {
  return (
    <div className="w-12 min-w-[48px] h-screen flex flex-col items-center py-4 bg-[#1e1e1e] border-r border-r-[rgba(255,255,255,0.1)] space-y-4">
      <button
        className="w-10 h-10 text-gray-400 hover:text-gray-200 cursor-pointer transition-colors"
        onClick={onGenerate}
        title="Generate"
        aria-label="Generate"
      >
        <PlayIcon />
      </button>
      <button
        className="w-10 h-10 text-gray-400 hover:text-gray-200 cursor-pointer transition-colors"
        title="Open"
        aria-label="Open"
      >
        <FolderOpenIcon />
      </button>
      <button
        className="w-10 h-10 text-gray-400 hover:text-gray-200 cursor-pointer transition-colors"
        title="Save"
        aria-label="Save"
      >
        <ArrowDownTrayIcon />
      </button>
      <button
        className="w-10 h-10 text-gray-400 hover:text-gray-200 cursor-pointer transition-colors"
        onClick={onReset}
        title="Reset"
        aria-label="Reset"
      >
        <ArrowPathIcon />
      </button>
    </div>
  );
}
