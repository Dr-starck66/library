import "dotenv/config";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { GoogleGenAI, Type } from "@google/genai";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Create a .env file from .env.example or configure the secret before starting LibraryForge AI."
    );
  }

  return new GoogleGenAI({ apiKey });
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateContentWithRetry(options: any, maxRetries = 3) {
  const ai = getAiClient();
  let attempt = 0;
  let currentModel = options.model;

  while (attempt < maxRetries) {
    try {
      return await ai.models.generateContent({ ...options, model: currentModel });
    } catch (err: any) {
      const errMsg = err.message || JSON.stringify(err);
      const isQuotaOrRateLimit = err.status === 429 || errMsg.includes("429") || errMsg.includes("quota");
      const isNetworkError = err.status === 503 || err.status === 500 || errMsg.includes("fetch failed") || errMsg.includes("undici") || errMsg.includes("timeout") || errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("500");

      if (isQuotaOrRateLimit || isNetworkError) {
        console.log(`[Retry] ${isQuotaOrRateLimit ? 'Rate limit' : 'Network error'} on ${currentModel} (attempt ${attempt + 1}/${maxRetries}).`);

        let waitMs = 5000;
        const retryMatch = errMsg.match(/retry in (\d+(?:\.\d+)?)s/);
        if (retryMatch) {
          waitMs = parseFloat(retryMatch[1]) * 1000 + 1000;
        } else if (isNetworkError) {
          waitMs = 3000 * (attempt + 1); // Exponential backoff for network errors
        }

        // Cap at 30 seconds to avoid giant delays
        if (waitMs > 30000) {
           waitMs = 30000;
        }

        // Fallback to flash if pro requires a long wait
        if (currentModel !== "gemini-2.5-flash" && waitMs >= 20000) {
          console.log(`Wait time ${waitMs}ms too long for ${currentModel}. Falling back to gemini-2.5-flash.`);
          currentModel = "gemini-2.5-flash";
          waitMs = 2000; // Small delay before fallback
        }
        
        console.log(`Waiting ${waitMs}ms before retrying...`);
        await delay(waitMs);
        attempt++;
      } else {
        throw err;
      }
    }
  }
  
  // Last resort
  console.log("Retries exhausted, trying minimal fallback model once.");
  return await ai.models.generateContent({ ...options, model: "gemini-2.5-flash" });
}

function safeJsonParse(text: string | null | undefined, fallback: any) {
  if (!text) return fallback;
  let cleanText = text.trim();
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```(?:json)?\n?/, "");
    cleanText = cleanText.replace(/\n?```$/, "");
  }
  try {
    cleanText = cleanText.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, "");
    return JSON.parse(cleanText);
  } catch (err) {
    console.error("JSON Parse Error. Fallback used.", err);
    return fallback;
  }
}

function extractFilesFromMarkdown(text: string): Record<string, string> {
  const files: Record<string, string> = {};
  const blockRegex = /###\s*([^\n]+)\s*```[a-zA-Z]*\s*([\s\S]*?)\s*```/g;
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    const [, filepath, content] = match;
    files[filepath.trim()] = content.trim();
  }
  return files;
}

// ====================== STATE ======================
export const LibraryState = Annotation.Root({
  prompt: Annotation<string>({ reducer: (curr, update) => update ?? curr, default: () => "" }),
  projectName: Annotation<string>({ reducer: (curr, update) => update ?? curr, default: () => "generated_library" }),
  plan: Annotation<any>({ reducer: (curr, update) => update ?? curr, default: () => null }),
  files: Annotation<Record<string, string>>({ reducer: (curr, update) => ({ ...curr, ...update }), default: () => ({}) }),
  criticStatus: Annotation<string>({ reducer: (curr, update) => update ?? curr, default: () => "PENDING" }),
  criticFeedback: Annotation<string>({ reducer: (curr, update) => update ?? curr, default: () => "" }),
  testResults: Annotation<string>({ reducer: (curr, update) => update ?? curr, default: () => "" }),
  testSuccess: Annotation<boolean>({ reducer: (curr, update) => update ?? curr, default: () => false }),
  iterations: Annotation<number>({ reducer: (curr, update) => (update !== undefined ? curr + update : curr), default: () => 0 }),
});

// ====================== NODES ======================

async function plannerNode(state: typeof LibraryState.State) {
  console.log("--> RUNNING PLANNER");
  
  const sysPrompt = `You are a world-class Python Architect for LibraryForge AI.

Your role:
- Design a clean, modern, production-grade Python library.
- Plan the exact module structure: src/<package_name>/ + tests/ + examples/.
- Specify exact dependencies required for the project (e.g., requests, pydantic, pytest).
- Follow strictly 2025 Python best practices.
- Output a comprehensive plan in JSON.
- Include clear descriptions for each module so the developer knows exactly what to implement.

Respond ONLY with valid JSON using this schema:`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      project_name: { type: Type.STRING },
      dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
      modules: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            filepath: { type: Type.STRING },
          },
        },
      },
    },
    required: ["project_name", "dependencies", "modules"],
  };

  const response = await generateContentWithRetry({
    model: "gemini-2.5-pro",
    contents: [{ role: "user", parts: [{ text: state.prompt }] }],
    config: {
      systemInstruction: sysPrompt,
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.2,
    },
  });

  const plan = safeJsonParse(response.text, { project_name: "generated_library", dependencies: [], modules: [] });

  return { 
    plan, 
    projectName: plan.project_name 
  };
}

async function coderNode(state: typeof LibraryState.State) {
  console.log("--> RUNNING CODER");

  const sysPrompt = `You are an expert Python Software Engineer working for LibraryForge AI.

**Strict Requirements:**
- Implement ALL files requested in the plan.
- Thoroughly define ALL dependencies in a completely valid \`pyproject.toml\` configuration using hatchling or setuptools. \`project.dependencies\` must contain everything needed.
- Follow PEP 8 and modern Python standards (2025).
- Include comprehensive type hints (e.g., list[str], dict[str, Any]).
- Write excellent Google-style docstrings.
- Make the package installable with pip.
- Export public API cleanly in __init__.py

**Output format:** You MUST respond using this exact structure for EVERY file:

### path/to/file.py
\`\`\`python
# complete code
\`\`\`

Generate the FULL codebase including:
- pyproject.toml
- src/<package>/ (all modules)
- tests/
- README.md
- example.py

Do not add any explanation outside the code blocks.`;

  const response = await generateContentWithRetry({
    model: "gemini-2.5-pro",
    contents: [{
      role: "user", 
      parts: [{ 
        text: `Plan:\n${JSON.stringify(state.plan, null, 2)}\n\nFeedback from previous iteration:\n${state.criticFeedback || "None"}` 
      }]
    }],
    config: {
      systemInstruction: sysPrompt,
      temperature: 0.25,
    },
  });

  const newFiles = extractFilesFromMarkdown(response.text || "");
  return { files: newFiles };
}

async function testerNode(state: typeof LibraryState.State) {
  console.log("--> RUNNING TESTER");

  const sysPrompt = `You are a meticulous Test Engineer for LibraryForge AI.

Your role:
- Generate comprehensive test files for the codebase provided.
- Write tests compatible with 'unittest' module, as it will be executed securely.
- Test edge cases, exceptions, and typical usage parameters.

Use the exact same Markdown format:

### tests/test_something.py
\`\`\`python
# test code
\`\`\``;

  const filesContext = Object.entries(state.files)
    .filter(([path]) => path.endsWith(".py") && !path.startsWith("tests/"))
    .map(([path, code]) => `=== ${path} ===\n${code}`)
    .join("\n\n");

  const response = await generateContentWithRetry({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [{ text: `Current codebase:\n\n${filesContext}\n\nGenerate comprehensive tests.` }]
    }],
    config: {
      systemInstruction: sysPrompt,
      temperature: 0.2,
    },
  });

  const testFiles = extractFilesFromMarkdown(response.text || "");
  return { files: testFiles };
}

// ==================== NEW: EXECUTOR NODE ====================
async function executorNode(state: typeof LibraryState.State) {
  console.log("--> RUNNING EXECUTOR (Real Test Execution)");

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "lf-sandbox-"));
  let resultText = "";
  let testSuccess = false;

  try {
    for (const [filepath, content] of Object.entries(state.files)) {
      const fullPath = path.join(tempDir, filepath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    }

    const execPromise = new Promise<{ error: any; stdout: string; stderr: string }>((resolve) => {
      exec("python3 -m unittest discover -s tests", { cwd: tempDir, timeout: 20000 }, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      });
    });

    const { error, stdout, stderr } = await execPromise;
    resultText = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;
    
    if (error && error.code === 127) {
      resultText = "Error: python3 command not found. Falling back to LLM evaluation.\n\n";
      const filesContext = Object.entries(state.files).map(([p, c]) => `File: ${p}\n${c}`).join("\n---\n");
      const sysPrompt = "You are a Python QA Engineer simulator. Evaluate test quality and predict results.";
      const response = await generateContentWithRetry({
        model: "gemini-2.5-pro",
        contents: [{ role: "user", parts: [{ text: `Code:\n\n${filesContext}\n\nEvaluate tests.` }] }],
        config: { systemInstruction: sysPrompt, temperature: 0.1 }
      });
      resultText += (response.text || "Simulation failed.");
      testSuccess = resultText.toLowerCase().includes("all passed") || (!resultText.toLowerCase().includes("fail") && !resultText.toLowerCase().includes("error"));
    } else {
      testSuccess = !error;
    }
  } catch (err: any) {
    resultText = "Sandbox Execution Error: " + err.message;
    testSuccess = false;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(console.error);
  }

  return {
    testResults: resultText.substring(0, 4000),
    testSuccess
  };
}

async function criticNode(state: typeof LibraryState.State) {
  console.log("--> RUNNING CRITIC");

  if (state.iterations >= 3) {
    return { 
      criticStatus: "OK", 
      criticFeedback: "Max iterations reached.", 
      iterations: 1 
    };
  }

  const sysPrompt = `You are a ruthless Senior Python Code Reviewer for LibraryForge AI.

Your role is to deeply analyze the generated project.
Evaluate:
1. Are all dependencies explicitly listed in \`pyproject.toml\` under \`project.dependencies\`?
2. Are tests written well, and did they pass? (Check Test Results)
3. Is the code complete, properly typed, and documented?
4. Fix any architecture deviations from the request.

If anything is missing or failing, set status="FAIL" and provide explicit, actionable feedback mentioning exactly which file to modify and what to add/fix.
If everything is robust, set status="OK".

Return JSON only.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      status: { type: Type.STRING, enum: ["OK", "FAIL"] },
      feedback: { type: Type.STRING },
      score: { type: Type.NUMBER },
      issues: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["status", "feedback", "score"],
  };

  const filesList = Object.keys(state.files).join(", ");

  const response = await generateContentWithRetry({
    model: "gemini-2.5-pro",
    contents: [{
      role: "user",
      parts: [{
        text: `Project: ${state.projectName}\nPlan: ${JSON.stringify(state.plan)}\nFiles: ${filesList}\nTest Results: ${state.testResults}\n\nProvide critical review.`
      }]
    }],
    config: {
      systemInstruction: sysPrompt,
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.1,
    },
  });

  const criticResult = safeJsonParse(response.text, { 
    status: "FAIL", 
    feedback: "Failed to parse critic response.", 
    score: 50 
  });

  return {
    criticStatus: criticResult.status,
    criticFeedback: criticResult.feedback,
    iterations: 1,
  };
}

async function fixerNode(state: typeof LibraryState.State) {
  console.log("--> RUNNING FIXER");
  return {
    criticFeedback: `CRITICAL FIX REQUIRED: ${state.criticFeedback}\nFocus on fixing the issues mentioned by the critic.`
  };
}

function shouldContinue(state: typeof LibraryState.State) {
  if (state.criticStatus === "OK" && state.testSuccess) {
    return END;
  }
  return "fixer";
}

// ====================== GRAPH ======================
const workflow = new StateGraph(LibraryState)
  .addNode("planner", plannerNode)
  .addNode("coder", coderNode)
  .addNode("tester", testerNode)
  .addNode("executor", executorNode)
  .addNode("critic", criticNode)
  .addNode("fixer", fixerNode)

  .addEdge(START, "planner")
  .addEdge("planner", "coder")
  .addEdge("coder", "tester")
  .addEdge("tester", "executor")
  .addEdge("executor", "critic")
  .addConditionalEdges("critic", shouldContinue)
  .addEdge("fixer", "coder");

const appManager = workflow.compile();

export async function* runLibraryForgeGraph(prompt: string) {
  const stream = await appManager.streamEvents(
    { prompt },
    { version: "v2" }
  );

  for await (const event of stream) {
    if (event.event === "on_chain_start" && event.name === "LangGraph") {
      yield { type: "system", message: "Starting LibraryForge AI multi-agent execution..." };
    }
    if (event.event === "on_chain_start" && ["planner", "coder", "tester", "executor", "critic", "fixer"].includes(event.name)) {
      yield { type: "agent_start", agent: event.name };
    }
    if (event.event === "on_chain_end") {
      if (["planner", "coder", "tester", "executor", "critic", "fixer"].includes(event.name)) {
        yield { type: "agent_finish", agent: event.name, data: event.data?.output };
      }
      if (event.name === "LangGraph") {
        yield { type: "final_state", state: event.data?.output };
      }
    }
  }
}
