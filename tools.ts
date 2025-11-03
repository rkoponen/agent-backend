import { tool } from "npm:langchain";

export const getMenu = tool(
  async () => {
    const response = await fetch(`${Deno.env.get("API_BASE_URL")}/menu`);
    const data = await response.json();

    return JSON.stringify(data);
  },
  {
    name: "get_restaurant_menu",
    description:
      "Fetches the restaurant's menu items including names, descriptions, and prices.",
  }
);
