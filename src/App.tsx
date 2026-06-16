import React, { useState, useRef, useEffect } from "react";
import { Play, Download, Terminal, Settings, CheckCircle2, ChevronRight, FileCode2, PackageOpen, LayoutDashboard, BrainCircuit, RefreshCcw } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";

interface GraphState {
  prompt: string;
  projectName: string;
  plan: any;
  files: Record<string, string>;
  criticStatus: string;
  criticFeedback: string;
  iterations: number;
}

interface LogEntry {
  id: string;
  type: string;
  agent?: string;
  message?: string;
  data?: any;
  time: Date;
}

export default function App() {
  const [prompt, setPrompt] = useState("create a library for SMILES molecular processing");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [finalState, setFinalState] = useState<GraphState | null>(null);
  
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const handleSseBlock = (block: string) => {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) return;

    const eventType = trimmedBlock
      .split("\n")
      .find((line) => line.startsWith("event:"))
      ?.replace("event:", "")
      .trim();

    const rawData = trimmedBlock
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.replace(/^data:\s?/, ""))
      .join("\n")
      .trim();

    if (!eventType) return;

    if (eventType === "update") {
      try {
        const data = JSON.parse(rawData);
        handleStreamUpdate(data);
      } catch (error) {
        console.error("SSE parse error:", error, rawData);
        addLog("error", undefined, "Invalid streamed update received from the server.");
      }
      return;
    }

    if (eventType === "info") {
      addLog("system", undefined, rawData || "Processing...");
      return;
    }

    if (eventType === "complete") {
      setIsRunning(false);
      return;
    }

    if (eventType === "error") {
      let errorMessage = rawData || "Unknown server error";
      try {
        const parsed = JSON.parse(rawData);
        errorMessage = parsed?.message || parsed?.error || rawData;
      } catch {
        // Keep raw string message when it is not JSON.
      }
      addLog("error", undefined, `Error: ${errorMessage}`);
      setIsRunning(false);
    }
  };

  const startGeneration = async () => {
    if (!prompt.trim()) return;

    setIsRunning(true);
    setLogs([]);
    setFinalState(null);
    setActiveFile(null);

    try {
      const response = await fetch(`/api/generate?prompt=${encodeURIComponent(prompt)}`);
      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        const errorBody = contentType.includes("application/json")
          ? await response.json().then((body) => body?.error || JSON.stringify(body))
          : await response.text();
        throw new Error(errorBody || `Request failed with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body received from the server.");
      }

      if (!contentType.includes("text/event-stream")) {
        const bodyText = await response.text();
        throw new Error(bodyText || "Unexpected response format received from the server.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          handleSseBlock(block);
        }
      }

      const flushedBuffer = buffer + decoder.decode();
      if (flushedBuffer.trim()) {
        handleSseBlock(flushedBuffer);
      }

      setIsRunning(false);
    } catch (err: any) {
      console.error(err);
      addLog("error", undefined, `Error: ${err.message}`);
      setIsRunning(false);
    }
  };

  const handleStreamUpdate = (data: any) => {    
    if (data.type === "agent_start") {
       addLog("info", data.agent, `Executing ${data.agent} node...`);
    } else if (data.type === "agent_finish") {
       addLog("success", data.agent, `${data.agent} completed step.`);
    } else if (data.type === "system") {
       addLog("system", undefined, data.message);
    } else if (data.type === "final_state") {
       addLog("system", undefined, "Library generation complete.");
       setFinalState(data.state);
       
       if (data.state && data.state.files) {
         const firstFile = Object.keys(data.state.files)[0];
         if (firstFile) setActiveFile(firstFile);
       }
    }
  };

  const addLog = (type: string, agent?: string, message?: string) => {
    setLogs((prev) => [
      ...prev,
      { id: Math.random().toString(36).substring(2, 9), type, agent, message, time: new Date() },
    ]);
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const downloadZip = async () => {
    if (!finalState || !finalState.files) return;
    const zip = new JSZip();
    
    Object.entries(finalState.files).forEach(([filepath, content]) => {
      zip.file(filepath, content as string);
    });

    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${finalState.projectName || "library"}.zip`);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header Section */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-inner">
            <PackageOpen className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">LibraryForge <span className="text-blue-600">AI</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100 uppercase tracking-wider">
            System Ready
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar: Input & Workflow */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
          <div className="p-4 flex-1 overflow-y-auto">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Input Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isRunning}
              placeholder="Describe the Python library you want to build..."
              className="w-full h-32 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 mb-6 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 hover:border-slate-300 resize-none transition-all disabled:opacity-50"
            />

            <button
              onClick={startGeneration}
              disabled={isRunning || !prompt}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:shadow-none mb-8"
            >
              {isRunning ? (
                <><RefreshCcw className="w-4 h-4 animate-spin" /> Orchestrating...</>
              ) : (
                <><Play className="w-4 h-4 fill-white" /> Generate Library</>
              )}
            </button>

            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">LangGraph Pipeline</label>
            <div className="space-y-4">
              {['planner', 'coder', 'tester', 'executor', 'critic'].map((agent) => {
                 const isActive = isRunning && logs.some(l => l.agent === agent);
                 const isDone = logs.some(l => l.agent === agent && l.type === "success");
                 
                 let style = "opacity-40";
                 let iconBg = "bg-slate-200";
                 if (isDone) {
                   style = "opacity-100";
                   iconBg = "bg-emerald-500 shadow-sm";
                 } else if (isActive) {
                   style = "opacity-100";
                   iconBg = "bg-blue-600 ring-4 ring-blue-50 shadow-sm";
                 }

                 return (
                   <div key={agent} className={`flex items-start gap-3 transition-opacity duration-300 ${style}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${iconBg}`}>
                         {isDone ? (
                           <CheckCircle2 className="w-4 h-4 text-white" />
                         ) : isActive ? (
                           <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                         ) : null}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold capitalize ${isActive && !isDone ? 'text-blue-600' : 'text-slate-900'}`}>{agent.replace('_', ' ')} Agent</p>
                        <p className="text-xs text-slate-500">
                          {isDone ? "Completed successfully" : isActive ? "Working..." : "Awaiting execution"}
                        </p>
                      </div>
                   </div>
                 )
              })}
            </div>
          </div>
        </aside>

        {/* Center: File Explorer & Preview */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {finalState ? (
            <div className="flex flex-1 overflow-hidden">
               {/* File List */}
               <div className="w-64 border-r border-slate-200 bg-slate-50/50 overflow-y-auto flex flex-col pt-3 shrink-0">
                  <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                    Files Generated
                  </div>
                  <div className="flex flex-col px-2 mt-2 gap-1">
                    {Object.keys(finalState.files).sort().map((filepath) => (
                      <button
                        key={filepath}
                        onClick={() => setActiveFile(filepath)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors",
                          activeFile === filepath 
                            ? "bg-white border border-slate-200 shadow-sm text-blue-600 font-semibold" 
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent"
                        )}
                      >
                        <FileCode2 className={cn("w-4 h-4 shrink-0", activeFile === filepath ? "text-blue-500" : "text-slate-400")} />
                        <span className="truncate">{filepath}</span>
                      </button>
                    ))}
                  </div>
               </div>
               
               {/* Code View */}
               <div className="flex-1 relative bg-[#1E1E1E] overflow-hidden flex flex-col">
                  {/* File Tabs */}
                  <div className="h-12 border-b border-black/20 flex items-end px-2 bg-[#252526] shrink-0">
                    <div className="px-4 py-2.5 bg-[#1E1E1E] border-t border-l border-r border-black/30 rounded-t-md text-xs font-semibold text-slate-200">
                      {activeFile || "Select a file"}
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-4 bg-[#1E1E1E] pb-48">
                    <pre className="text-[13px] leading-relaxed font-mono text-slate-300">
                      <code>{activeFile ? finalState.files[activeFile] : "No file selected."}</code>
                    </pre>
                  </div>

                  {/* Terminal/Log Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 h-40 bg-slate-900 border-t border-slate-700/60 p-3 font-mono text-[11px] flex flex-col shadow-[0_-4px_15px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800 shrink-0">
                      <span className="text-slate-400 uppercase tracking-tighter font-bold flex items-center gap-2"><Terminal className="w-3.5 h-3.5" /> Agent Console Output</span>
                      <span className="text-slate-500 flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-600"></span>
                          </span>
                          IDLE
                      </span>
                    </div>
                    <div className="text-slate-300 flex-1 overflow-y-auto space-y-1">
                      <AnimatePresence initial={false}>
                        {logs.map((log) => (
                          <motion.div key={log.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2">
                            {log.agent ? (
                               <span className={cn("font-bold", 
                                  log.agent === "planner" ? "text-blue-400" :
                                  log.agent === "coder" ? "text-purple-400" :
                                  log.agent === "tester" ? "text-yellow-400" :
                                  log.agent === "executor" ? "text-emerald-400" :
                                  log.agent === "critic" ? "text-pink-400" : "text-slate-400"
                               )}>[{log.agent.toUpperCase()}]</span>
                            ) : (
                               <span className="text-slate-500 font-bold">[SYSTEM]</span>
                            )}
                            <span className={cn(
                                log.type === "success" && "text-emerald-400",
                                log.type === "error" && "text-red-400"
                            )}>
                              {log.type === "success" ? <span className="font-bold">SUCCESS </span> : null}
                              {log.type === "error" ? <span className="font-bold">ERROR </span> : null}
                              {log.message}
                            </span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <div ref={logsEndRef} />
                    </div>
                  </div>
               </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col relative bg-slate-50/30">
               <div className="flex-1 flex flex-col items-center justify-center text-slate-500 px-4">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-6 shadow-sm">
                    <BrainCircuit className="w-8 h-8 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-medium text-slate-800 mb-2">LangGraph Orchestrator</h2>
                  <p className="text-sm max-w-md text-center text-slate-500">
                     Enter a prompt and click "Generate Library" to initialize the auto-coding sequence. The agents will collaborate to build and test your package.
                  </p>
               </div>
               
               {/* Terminal/Log Overlay visible during run even without files yet */}
               {isRunning && (
                  <div className="absolute bottom-0 left-0 right-0 h-48 bg-slate-900 border-t border-slate-800 p-3 font-mono text-[11px] flex flex-col">
                     <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800 shrink-0">
                      <span className="text-slate-400 uppercase tracking-tighter font-bold flex items-center gap-2"><Terminal className="w-3.5 h-3.5" /> Agent Console Output</span>
                      <span className="text-emerald-400 flex items-center gap-1.5 shadow-emerald-400/20">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          LIVE
                      </span>
                    </div>
                    <div className="text-slate-300 flex-1 overflow-y-auto space-y-1">
                      <AnimatePresence initial={false}>
                        {logs.map((log) => (
                          <motion.div key={log.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2">
                            {log.agent ? (
                               <span className={cn("font-bold", 
                                  log.agent === "planner" ? "text-blue-400" :
                                  log.agent === "coder" ? "text-purple-400" :
                                  log.agent === "tester" ? "text-yellow-400" :
                                  log.agent === "executor" ? "text-emerald-400" :
                                  log.agent === "critic" ? "text-pink-400" : "text-slate-400"
                               )}>[{log.agent.toUpperCase()}]</span>
                            ) : (
                               <span className="text-slate-500 font-bold">[SYSTEM]</span>
                            )}
                            <span className={cn(
                                log.type === "success" && "text-emerald-400",
                                log.type === "error" && "text-red-400"
                            )}>
                              {log.type === "success" ? <span className="font-bold">SUCCESS </span> : null}
                              {log.type === "error" ? <span className="font-bold">ERROR </span> : null}
                              {log.message}
                            </span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <div ref={logsEndRef} />
                    </div>
                  </div>
               )}
            </div>
          )}
        </div>

        {/* Right Sidebar: Details & Download */}
        {finalState && (
          <aside className="w-64 bg-slate-50 border-l border-slate-200 p-5 flex flex-col shrink-0 shadow-[-1px_0_10px_rgba(0,0,0,0.02)]">
            <div className="space-y-6 flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Package Details</label>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Name</span>
                    <span className="font-medium text-slate-800">{finalState.projectName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Modules</span>
                    <span className="font-medium text-slate-800">{Object.keys(finalState.files).length} files</span>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Quality Metrics</label>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-600 font-medium">Critic Status</span>
                      <span className={cn("font-bold", finalState.criticStatus === "OK" ? "text-emerald-600" : "text-amber-600")}>
                        {finalState.criticStatus}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-1000", finalState.criticStatus === "OK" ? "bg-emerald-500 w-full" : "bg-amber-500 w-1/2")}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Auto-fix Iterations</span>
                      <span className="font-bold text-slate-800">{finalState.iterations}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-auto border-t border-slate-200">
              <button
                onClick={downloadZip}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                Download .ZIP
              </button>
              <p className="mt-3 text-[10px] text-center text-slate-400">Review generated package code in workspace</p>
            </div>
          </aside>
        )}

      </main>

      {/* Footer Bar */}
      <footer className="h-8 bg-white border-t border-slate-200 px-4 flex items-center justify-between text-[10px] text-slate-500 shrink-0 font-mono tracking-wide">
        <div className="flex gap-6">
          <span>ENGINE: LangGraph v2.0</span>
          <span>MODEL: Gemini 2.5 Pro</span>
        </div>
        <div className="flex gap-4 font-bold">
          <span className={isRunning ? "text-blue-600" : "text-slate-400"}>STATUS: {isRunning ? "EXECUTING" : "IDLE"}</span>
        </div>
      </footer>
    </div>
  );
}

