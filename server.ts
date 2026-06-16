import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { runLibraryForgeGraph } from "./server/graph";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // SSE endpoint for graph execution
  app.get("/api/generate", async (req, res) => {
    const prompt = req.query.prompt as string;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      sendEvent("update", { type: "system", message: "Starting LibraryForge AI graph execution..." });

      const stream = await runLibraryForgeGraph(prompt);
      
      for await (const chunk of stream) {
        sendEvent("update", chunk);
      }
      
      sendEvent("complete", "Done");
    } catch (err: any) {
      console.error(err);
      sendEvent("error", err.message || "An error occurred");
    } finally {
      res.end();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
