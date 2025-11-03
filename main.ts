import { ChatGoogleGenerativeAI } from "npm:@langchain/google-genai";
import { createAgent } from "npm:langchain";
import { MemorySaver } from "npm:@langchain/langgraph";
import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import z from "zod/v3";
import { getMenu } from "./tools.ts";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0.7,
  apiKey: Deno.env.get("GOOGLE_GENAI_API_KEY") ?? "",
});

const systemPrompt = `You are a friendly and helpful restaurant customer service agent.
You assist customers with their inquiries about restaurant services, menu items, reservations, and more.
Always provide accurate and courteous responses to ensure a positive customer experience.
Take orders when requested and confirm details with the customer.
You can recommend dishes based on customer preferences.

When asked about the menu, use the 'get_restaurant_menu' tool to fetch the latest menu information.
IMPORTANT: After receiving the menu data from the tool, DO NOT display the raw JSON data to the customer.
Instead, present the menu in a friendly, conversational way by:
- Summarizing the available categories
- Highlighting popular items
- Offering to provide more details about specific items if asked
- Using natural language to describe the offerings

Never show raw JSON data, IDs, or technical information to customers.`;

// Create a memory saver to store conversation history per session
const checkpointer = new MemorySaver();

const agent = createAgent({
  model,
  systemPrompt: systemPrompt,
  checkpointer: checkpointer,
  tools: [getMenu],
});

const router = new Router();

router.get("/", (context) => {
  context.response.body = "hello world";
});

router.post("/chat", async (context) => {
  try {
    // Parse the request body
    const bodyJson = await context.request.body.json();

    const message = bodyJson.message;
    const sessionId = bodyJson.sessionId;

    // Validate required fields
    if (!message || typeof message !== "string") {
      context.response.status = 400;
      context.response.body = {
        error: "Field 'message' is required and must be a string",
      };
      return;
    }

    if (!sessionId || typeof sessionId !== "string") {
      context.response.status = 400;
      context.response.body = {
        error: "Field 'sessionId' is required and must be a string",
      };
      return;
    }

    // Configure the agent with the session ID
    const config = {
      configurable: { thread_id: sessionId },
    };

    // Invoke the agent with the user's message
    const llmResponse = await agent.invoke(
      { messages: [{ role: "user", content: message }] },
      config
    );

    // Extract the reply from the agent's response
    const reply = llmResponse.messages[llmResponse.messages.length - 1].content;

    // Send the response
    context.response.status = 200;
    context.response.body = {
      sessionId,
      reply,
    };
  } catch (error) {
    console.error("Error in /chat endpoint:", error);
    context.response.status = 500;
    context.response.body = { error: "Internal server error" };
  }
});

router.post("/chat/stream", async (context) => {
  try {
    // Parse the request body
    const bodyJson = await context.request.body.json();

    const message = bodyJson.message;
    const sessionId = bodyJson.sessionId;

    // Validate required fields
    if (!message || typeof message !== "string") {
      context.response.status = 400;
      context.response.body = {
        error: "Field 'message' is required and must be a string",
      };
      return;
    }

    if (!sessionId || typeof sessionId !== "string") {
      context.response.status = 400;
      context.response.body = {
        error: "Field 'sessionId' is required and must be a string",
      };
      return;
    }

    // Configure the agent with the session ID for token-level streaming
    const config = {
      configurable: { thread_id: sessionId },
      streamMode: "messages" as const,
    };

    // Set up Server-Sent Events (SSE) headers
    context.response.headers.set("Content-Type", "text/event-stream");
    context.response.headers.set("Cache-Control", "no-cache");
    context.response.headers.set("Connection", "keep-alive");

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // Stream the agent's response token by token
          const streamResponse = await agent.stream(
            { messages: [{ role: "user", content: message }] },
            config
          );

          for await (const [token, metadata] of streamResponse) {
            // Only stream content from the agent node, not tool calls or tool responses
            if (metadata.langgraph_node === "agent") {
              // Extract content blocks from the token
              if (token.contentBlocks && token.contentBlocks.length > 0) {
                // Send each token as SSE data
                for (const block of token.contentBlocks) {
                  if (block.text) {
                    const data = `data: ${JSON.stringify({
                      content: block.text,
                      node: metadata.langgraph_node,
                    })}\n\n`;
                    controller.enqueue(encoder.encode(data));
                  }
                }
              }
            }
          }

          // Send done signal
          const doneMessage = `data: ${JSON.stringify({ done: true })}\n\n`;
          controller.enqueue(encoder.encode(doneMessage));
          controller.close();
        } catch (error) {
          console.error("Error in stream:", error);
          const errorMessage = `data: ${JSON.stringify({
            error: "Stream error",
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
          controller.close();
        }
      },
    });

    context.response.body = stream;
  } catch (error) {
    console.error("Error in /chat/stream endpoint:", error);
    context.response.status = 500;
    context.response.body = { error: "Internal server error" };
  }
});

export function add(a: number, b: number): number {
  return a + b;
}

// Start the server when run directly
if (import.meta.main) {
  const app = new Application();

  // Enable CORS for all routes
  app.use(
    oakCors({
      origin: "*", // Allow all origins - restrict this in production
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.use(router.routes());
  app.use(router.allowedMethods());

  const port = 8000;
  console.log(`🚀 Restaurant Agent API listening on http://localhost:${port}`);
  console.log(
    `POST /chat - Send messages with { "message": "...", "sessionId": "..." }`
  );
  console.log(
    `POST /chat/stream - Stream messages with { "message": "...", "sessionId": "..." }`
  );

  await app.listen({ port });
}
