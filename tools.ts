import { tool } from "npm:langchain";
import z from "zod/v3";

export const order = tool(
  async ({ restaurant, items }) => {
    // Calculate random ETA between 5-15 minutes
    const etaMinutes = Math.floor(Math.random() * 11) + 5; // Random between 5-15
    
    // Calculate arrival time in 24-hour format (Finnish time - Europe/Helsinki)
    const now = new Date();
    const arrivalDate = new Date(now.getTime() + etaMinutes * 60000);
    
    // Format in Finnish timezone
    const arrivalTime = arrivalDate.toLocaleTimeString('fi-FI', { 
      timeZone: 'Europe/Helsinki',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    
    const response = await fetch(
      `${Deno.env.get("API_BASE_URL")}/${restaurant}/order`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items, arrivalTime }),
      }
    );
    const orderConfirmation = await response.json();

    console.log(orderConfirmation);

    // Add arrival time information to the response
    const confirmationWithEta = {
      ...orderConfirmation,
      arrivalTime: arrivalTime,
      message: `Order confirmed! Restaurant notified you'll arrive at ${arrivalTime}. Food will be ready when you get there.`,
    };

    return JSON.stringify(confirmationWithEta);
  },
  {
    name: "place_order",
    description: "Place a food order with the specified restaurant. The system automatically calculates and notifies the restaurant of your arrival time.",
    schema: z.object({
      restaurant: z
        .enum(["burger", "pizza", "salad"])
        .describe("The restaurant to place the order with"),
      items: z
        .array(
          z.object({
            id: z.number().describe("The menu item ID from the menu"),
            quantity: z.number().min(1).describe("The quantity to order"),
          })
        )
        .describe("The list of items to order with their IDs and quantities"),
    }),
  }
);

export const getMenu = tool(
  async ({ restaurant }) => {
    const response = await fetch(
      `${Deno.env.get("API_BASE_URL")}/${restaurant}/menu`
    );
    const menu = await response.json();

    return JSON.stringify(menu);
  },
  {
    name: "get_menu",
    schema: z.object({
      restaurant: z
        .enum(["burger", "pizza", "salad"])
        .describe("The restaurant to get the menu from"),
    }),
    description:
      "Fetches the burger restaurant's menu items including names, descriptions, and prices.",
  }
);

// Static parking data for demo
const parkingSpots = [
  {
    id: 1,
    name: "Kamppi Parkkihalli",
    location: "Urho Kekkosen katu 1, Helsinki",
    distance: "300 m",
    duration: "2 min",
    price: "€15",
    hourlyRate: "€5/h",
    availability: "Available",
    features: ["Covered", "24/7 Security", "EV Charging"],
    spaces: 45,
  },
  {
    id: 2,
    name: "Forum Parkki",
    location: "Mannerheimintie 20, Helsinki",
    distance: "600 m",
    duration: "4 min",
    price: "€10",
    hourlyRate: "€3/h",
    availability: "Available",
    features: ["Outdoor", "Well-lit"],
    spaces: 120,
  },
  {
    id: 3,
    name: "Kluuvi Parkki",
    location: "Aleksanterinkatu 22, Helsinki",
    distance: "900 m",
    duration: "6 min",
    price: "€8",
    hourlyRate: "€2.50/h",
    availability: "Limited - 5 spots left",
    features: ["Covered", "Valet Available"],
    spaces: 5,
  },
];

export const getParkingOptions = tool(
  () => {
    const parkingList = parkingSpots
      .map(
        (spot) =>
          `${spot.name} - ${spot.location}\n` +
          `  Distance: ${spot.distance} (${spot.duration})\n` +
          `  Price: ${spot.price} (${spot.hourlyRate})\n` +
          `  Status: ${spot.availability}\n` +
          `  Features: ${spot.features.join(", ")}\n` +
          `  Spaces: ${spot.spaces} available`
      )
      .join("\n\n");

    return `Nearby parking options:\n\n${parkingList}`;
  },
  {
    name: "get_parking_options",
    description:
      "Get a list of nearby parking garages and lots with prices, distance, availability, and features.",
  }
);

// Tyre change garages
const tyreGarages = [
  {
    id: 1,
    name: "Vianor Helsinki Keskusta",
    location: "Mannerheimintie 105, Helsinki",
    distance: "2.3 km",
    duration: "8 min",
    services: ["Tyre change", "Wheel alignment", "Tyre storage"],
    priceRange: "€40-80",
    rating: 4.6,
    availability: "Available today",
    nextSlots: ["14:00", "16:30", "18:00"],
  },
  {
    id: 2,
    name: "Rengasmaailma Kamppi",
    location: "Runeberginkatu 5, Helsinki",
    distance: "1.1 km",
    duration: "5 min",
    services: ["Tyre change", "Puncture repair", "New tyres"],
    priceRange: "€35-70",
    rating: 4.4,
    availability: "Available tomorrow",
    nextSlots: ["09:00", "11:00", "15:00"],
  },
  {
    id: 3,
    name: "Euromaster Helsinki",
    location: "Hämeentie 153, Helsinki",
    distance: "3.5 km",
    duration: "12 min",
    services: ["Tyre change", "Brake service", "Wheel balancing"],
    priceRange: "€45-85",
    rating: 4.7,
    availability: "Available today",
    nextSlots: ["13:00", "15:30", "17:00"],
  },
];

export const getTyreChangeGarages = tool(
  () => {
    // Return the closest garage
    const garage = tyreGarages[0]; // Vianor Helsinki Keskusta - closest at 2.3km

    return JSON.stringify({
      name: garage.name,
      location: garage.location,
      distance: garage.distance,
      duration: garage.duration,
      services: garage.services,
      priceRange: garage.priceRange,
      rating: garage.rating,
      availability: garage.availability,
      nextSlots: garage.nextSlots,
    });
  },
  {
    name: "get_tyre_change_garages",
    description:
      "Find a nearby garage that offers tyre change services. Returns the closest option with availability, pricing, and time slots.",
  }
);

export const bookTyreChange = tool(
  ({ garageName, timeSlot, serviceType }) => {
    // Find the garage
    const garage = tyreGarages.find(g => 
      g.name.toLowerCase().includes(garageName.toLowerCase())
    ) || tyreGarages[0];

    // Generate booking confirmation
    const bookingId = `TYRE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    // Parse date from timeSlot (format: "2025-11-26T14:00:00")
    const bookingDate = new Date(timeSlot);
    const dateStr = bookingDate.toLocaleDateString('fi-FI', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const timeStr = bookingDate.toLocaleTimeString('fi-FI', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });

    return JSON.stringify({
      bookingId,
      garage: garage.name,
      location: garage.location,
      service: serviceType,
      dateTime: timeSlot,
      dateFormatted: dateStr,
      timeFormatted: timeStr,
      estimatedDuration: "30-45 minutes",
      priceEstimate: garage.priceRange,
      message: `Tyre change booked at ${garage.name} for ${dateStr} at ${timeStr}. Booking ID: ${bookingId}`,
    });
  },
  {
    name: "book_tyre_change",
    description:
      "Book a tyre change appointment at a garage. Returns booking confirmation with details.",
    schema: z.object({
      garageName: z
        .string()
        .describe("The name of the garage to book with"),
      timeSlot: z
        .string()
        .describe("The appointment time in ISO 8601 format (e.g., '2025-11-26T14:00:00')"),
      serviceType: z
        .string()
        .default("Tyre change")
        .describe("Type of service (e.g., 'Tyre change', 'Seasonal tyre change')"),
    }),
  }
);

export const getHotels = tool(
  ({ destination, preference }) => {
    // This tool indicates that the agent should generate hotel recommendations
    // The agent will use its knowledge to suggest appropriate hotels based on the destination and preference
    return `AGENT_GENERATE_HOTELS: Search for hotels in ${destination} with ${preference} preference. Generate 2-3 realistic hotel recommendations with details like name, location, price per night in euros, rating, amenities, and availability.`;
  },
  {
    name: "get_hotels",
    description:
      "Use this tool to indicate you need to generate hotel recommendations for the destination. After calling this tool, you should generate 2-3 realistic hotel options based on your knowledge of hotels in that destination. Include details: name, location, price per night (€), rating, key amenities. Match the preference: 'luxury'/'nice' for upscale hotels (€150-250+/night), 'budget' for economical (€60-100/night), or 'moderate' for balanced options (€100-150/night).",
    schema: z.object({
      destination: z
        .string()
        .describe("The destination city to search for hotels"),
      preference: z
        .enum(["luxury", "nice", "budget", "moderate"])
        .default("moderate")
        .describe("User's accommodation preference"),
    }),
  }
);

export const bookHotel = tool(
  ({ hotelName, pricePerNight }) => {
    // Generate a mock booking confirmation
    const confirmationId = `HTL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return `Hotel booked! Reservation ID: ${confirmationId}\n\n` +
           `${hotelName}\n` +
           `${pricePerNight}/night`;
  },
  {
    name: "book_hotel",
    description:
      "Book a hotel that you previously recommended. Provide the hotel name and price.",
    schema: z.object({
      hotelName: z
        .string()
        .describe("The name of the hotel to book"),
      pricePerNight: z
        .string()
        .describe("The price per night (e.g., '€150')"),
    }),
  }
);

export const bookRestaurant = tool(
  ({ restaurantName, time, partySize }) => {
    let restaurant;
    
    // Try to find by name

    // Generate a mock booking confirmation
    const confirmationId = `RST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return `Your restaurant reservation is confirmed! Reservation ID: ${confirmationId}\n\n` +
           `${restaurantName}\n` +
           `${time} for ${partySize} ${partySize === 1 ? 'person' : 'people'}\n`;
  },
  {
    name: "book_restaurant",
    description:
      "Book a restaurant reservation by name or from the itinerary. Returns booking confirmation with reservation ID.",
    schema: z.object({
      restaurantName: z
        .string()
        .describe("The restaurant name to book"),
      time: z
        .string()
        .describe("The reservation time (e.g., '7:00 PM', '19:00')"),
      partySize: z
        .number()
        .describe("Number of people for the reservation"),
    }),
  }
);

// Restaurant recommendations for trip planning
const restaurantRecommendations = [
  {
    name: "Ravintola Nokka",
    cuisine: "Finnish",
    priceRange: "€€€",
    specialty: "Local Nordic cuisine",
    rating: 4.6,
  },
  {
    name: "Savotta",
    cuisine: "Traditional Finnish",
    priceRange: "€€",
    specialty: "Authentic Finnish dishes",
    rating: 4.4,
  },
  {
    name: "Olo Ravintola",
    cuisine: "Fine Dining",
    priceRange: "€€€€",
    specialty: "Michelin-starred experience",
    rating: 4.7,
  },
];

export const buildItinerary = tool(
  ({ destination, hotelData, restaurantData, parkingData }) => {
    const hotel = JSON.parse(hotelData).hotel;
    const restaurant = JSON.parse(restaurantData).restaurant;
    const parking = parkingSpots[0]; // Select closest parking (Downtown Garage)
    
    const itinerary = `Your ${destination} trip itinerary:\n\n` +
      `Hotel: ${hotel.name} in ${hotel.location}. ${hotel.pricePerNight} per night, rated ${hotel.rating} stars. ` +
      `Amenities include ${hotel.amenities.join(", ")}.\n\n` +
      `Restaurant: ${restaurant.name}, a ${restaurant.cuisine} restaurant with ${restaurant.specialty}. ` +
      `Price range ${restaurant.priceRange}, rated ${restaurant.rating} stars.\n\n` +
      `Parking: ${parking.name} at ${parking.location}, ${parking.duration} from your hotel. ` +
      `${parking.price}, ${parking.hourlyRate}. Features ${parking.features.join(", ")}.\n\n` +
      `Say "book the hotel" to reserve your accommodation, or "book the restaurant" to make a dinner reservation.`;
    
    return itinerary;
  },
  {
    name: "build_itinerary",
    description:
      "Build a complete trip itinerary with selected hotel, restaurant, and parking. Use this after getting hotel and restaurant data to present a curated trip plan.",
    schema: z.object({
      destination: z.string().describe("The destination city"),
      hotelData: z.string().describe("JSON string from get_hotels tool"),
      restaurantData: z.string().describe("JSON string from get_restaurant_recommendations tool"),
      parkingData: z.string().optional().describe("Parking information (optional)"),
    }),
  }
);

// Google Calendar Integration
async function getGoogleAccessToken() {
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken!,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  return data.access_token;
}

export const getCalendarEvents = tool(
  async ({ timeMin, timeMax, maxResults }) => {
    const accessToken = await getGoogleAccessToken();

    // Default to today if no timeMin provided
    const start = timeMin || new Date().toISOString();
    // Default to 7 days from now if no timeMax provided
    const end = timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}&maxResults=${maxResults || 10}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return "No events found in the specified time range.";
    }

    const events = data.items.map((event: any) => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;
      return {
        summary: event.summary,
        start: start,
        end: end,
        location: event.location || "No location",
        description: event.description || "No description",
      };
    });

    return JSON.stringify({ events, count: events.length });
  },
  {
    name: "get_calendar_events",
    description:
      "Fetch events from Google Calendar within a specified time range. Returns upcoming events with their details.",
    schema: z.object({
      timeMin: z
        .string()
        .optional()
        .describe("Start time in ISO 8601 format (e.g., '2025-11-20T00:00:00Z'). Defaults to now."),
      timeMax: z
        .string()
        .optional()
        .describe("End time in ISO 8601 format. Defaults to 7 days from now."),
      maxResults: z
        .number()
        .optional()
        .describe("Maximum number of events to return. Defaults to 10."),
    }),
  }
);

export const createCalendarEvent = tool(
  async ({ summary, startTime, endTime, location, description }) => {
    const accessToken = await getGoogleAccessToken();

    const event = {
      summary: summary,
      location: location,
      description: description,
      start: {
        dateTime: startTime,
        timeZone: "Europe/Helsinki",
      },
      end: {
        dateTime: endTime,
        timeZone: "Europe/Helsinki",
      },
    };

    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    const data = await response.json();

    if (data.error) {
      return `Error creating event: ${data.error.message}`;
    }

    return `Event created successfully! "${summary}" scheduled for ${startTime}. Event ID: ${data.id}`;
  },
  {
    name: "create_calendar_event",
    description:
      "Create a new event in Google Calendar with specified details.",
    schema: z.object({
      summary: z.string().describe("The title/summary of the event"),
      startTime: z
        .string()
        .describe("Start time in ISO 8601 format (e.g., '2025-11-20T14:00:00')"),
      endTime: z
        .string()
        .describe("End time in ISO 8601 format (e.g., '2025-11-20T15:00:00')"),
      location: z
        .string()
        .optional()
        .describe("Location of the event (optional)"),
      description: z
        .string()
        .optional()
        .describe("Description of the event (optional)"),
    }),
  }
);

