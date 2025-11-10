import { createAgent, ToolMessage } from "npm:langchain";
import { MemorySaver } from "npm:@langchain/langgraph";
import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import { getMenu } from "./tools.ts";
import { model } from "./model.ts";
import { burgerAgent } from "./agents/burger-agent.ts";
import { saladAgent } from "./agents/salad-agent.ts";
import { orchestratorAgent } from "./agents/orchestrator-agent.ts";
import { pizzaAgent } from "./agents/pizza-agent.ts";

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

export const agents = {
  orchestratorAgent: orchestratorAgent,
  burgerAgent: burgerAgent,
  saladAgent: saladAgent,
  pizzaAgent: pizzaAgent,
};

// Session-based agent management - each session has its own agent
const sessionAgents = new Map<string, keyof typeof agents>();

// Track current session for tool calls
let currentSessionId: string | null = null;

export const setCurrentSession = (sessionId: string) => {
  currentSessionId = sessionId;
};

export const changeAgent = (agentName: keyof typeof agents) => {
  if (!currentSessionId) {
    console.error("No active session for agent change");
    return;
  }
  if (agents[agentName]) {
    console.log(
      `Session ${currentSessionId}: Switching to agent: ${agentName}`
    );
    sessionAgents.set(currentSessionId, agentName);
  } else {
    console.error(`Agent not found: ${agentName}`);
  }
};

export const getCurrentAgent = (sessionId: string) => {
  const agentName = sessionAgents.get(sessionId) || "orchestratorAgent";
  return agents[agentName];
};

const router = new Router();

router.get("/", async (context) => {
  try {
    const html = await Deno.readTextFile("./chat-interface.html");
    context.response.headers.set("Content-Type", "text/html");
    context.response.body = html;
  } catch (error) {
    console.error("Error serving HTML:", error);
    context.response.status = 500;
    context.response.body = "Error loading page";
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
          // Set the current session for tool calls
          setCurrentSession(sessionId);

          // Get the current agent for this session
          const currentAgent = getCurrentAgent(sessionId);

          // Track the agent before streaming starts
          const agentBeforeStream = currentAgent;
          let agentSwitched = false;

          // Stream the agent's response token by token
          const streamResponse = await currentAgent.stream(
            { messages: [{ role: "user", content: message }] },
            config
          );

          for await (const [token, _metadata] of streamResponse) {
            // console.log(token);
            // console.log(_metadata);
            // Only stream content from the agent node, not tool calls or tool responses
            // Extract content blocks from the token
            if (
              token.content &&
              token.content.length > 0 &&
              !(token instanceof ToolMessage)
            ) {
              const data = `data: ${JSON.stringify({
                content: token.content,
              })}\n\n`;

              controller.enqueue(encoder.encode(data));
            }

            // Check if agent switched during the stream (either to a specialist or back to orchestrator)
            const newCurrentAgent = getCurrentAgent(sessionId);
            if (newCurrentAgent !== agentBeforeStream) {
              agentSwitched = true;
            }
          }

          // If agent was switched, activate the new agent with a greeting
          const finalAgent = getCurrentAgent(sessionId);
          if (agentSwitched && finalAgent !== orchestratorAgent) {
            console.log(
              `Session ${sessionId}: Agent switched from ${
                agentBeforeStream === orchestratorAgent
                  ? "orchestrator"
                  : "specialist"
              } to ${
                finalAgent === orchestratorAgent ? "orchestrator" : "specialist"
              }`
            );

            // Send greeting to the new agent to trigger its response
            const welcomeStream = await finalAgent.stream(
              { messages: [{ role: "user", content: "Hello" }] },
              config
            );

            for await (const [token, _metadata] of welcomeStream) {
              if (
                token.content &&
                token.content.length > 0 &&
                !(token instanceof ToolMessage)
              ) {
                const data = `data: ${JSON.stringify({
                  content: token.content,
                })}\n\n`;

                controller.enqueue(encoder.encode(data));
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
