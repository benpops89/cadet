import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

console.log("main.jsx executing...");
console.log("Root element:", document.getElementById("root"));

ReactDOM.createRoot(document.getElementById("root")).render(
  <App />
);

console.log("React root created and rendering...");
