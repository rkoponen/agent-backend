import { tool } from "npm:langchain";
import z from "zod/v3";

export const order = tool(
  async ({ restaurant, items }) => {
    // Calculate random ETA between 5-15 minutes
    const etaMinutes = Math.floor(Math.random() * 11) + 5; // Random between 5-15
    
    // Calculate arrival time in 24-hour format (Finnish time)
    const now = new Date();
    const arrivalDate = new Date(now.getTime() + etaMinutes * 60000);
    const hours = arrivalDate.getHours().toString().padStart(2, '0');
    const minutes = arrivalDate.getMinutes().toString().padStart(2, '0');
    const arrivalTime = `${hours}:${minutes}`;
    
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

// Static hotel data for trip planning
const hotels = [
  {
    id: 1,
    name: "Helsinki Grand Hotel",
    location: "City Center, Helsinki",
    pricePerNight: "€180",
    rating: 4.5,
    amenities: ["Free WiFi", "Breakfast included", "Spa", "Parking"],
    availability: "Available",
  },
  {
    id: 2,
    name: "Seaside Boutique Hotel",
    location: "Waterfront, Helsinki",
    pricePerNight: "€150",
    rating: 4.3,
    amenities: ["Sea view", "Restaurant", "Free WiFi", "Gym"],
    availability: "Available",
  },
  {
    id: 3,
    name: "Nordic Business Inn",
    location: "Business District, Helsinki",
    pricePerNight: "€120",
    rating: 4.0,
    amenities: ["Free WiFi", "Meeting rooms", "Airport shuttle"],
    availability: "Limited - 2 rooms left",
  },
];

export const getHotels = tool(
  ({ destination, preference }) => {
    // Select hotel based on preference
    let selectedHotel;
    if (preference === "luxury" || preference === "nice") {
      selectedHotel = hotels[0]; // Helsinki Grand Hotel
    } else if (preference === "budget") {
      selectedHotel = hotels[2]; // Nordic Business Inn
    } else {
      selectedHotel = hotels[1]; // Seaside Boutique Hotel (default)
    }

    return JSON.stringify({
      hotel: selectedHotel,
      allHotels: hotels.map((h, i) => ({ ...h, number: i + 1 })),
    });
  },
  {
    name: "get_hotels",
    description:
      "Search for hotels in a destination and get a curated recommendation. Use preference 'luxury'/'nice' for upscale hotels, 'budget' for economical, or 'moderate' for balanced options.",
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
  ({ hotelIdentifier }) => {
    let hotel;
    
    // Try to parse as number first
    const hotelNum = parseInt(hotelIdentifier);
    if (!isNaN(hotelNum) && hotelNum >= 1 && hotelNum <= hotels.length) {
      hotel = hotels[hotelNum - 1];
    } else {
      // Try to find by name
      hotel = hotels.find(h => 
        h.name.toLowerCase().includes(hotelIdentifier.toLowerCase())
      ) || hotels[0]; // Default to first hotel if not found
    }

    // Generate a mock booking confirmation
    const confirmationId = `HTL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return `Your hotel is booked! Reservation ID: ${confirmationId}\n\n` +
           `${hotel.name}\n` +
           `${hotel.location}\n` +
           `${hotel.pricePerNight}/night\n` +
           `Amenities: ${hotel.amenities.join(", ")}`;
  },
  {
    name: "book_hotel",
    description:
      "Book a hotel by number (1, 2, 3) or by name. Returns booking confirmation with reservation ID.",
    schema: z.object({
      hotelIdentifier: z
        .string()
        .describe("The hotel number (1, 2, 3) or hotel name to book"),
    }),
  }
);

export const bookRestaurant = tool(
  ({ restaurantIdentifier, time, partySize }) => {
    let restaurant;
    
    // Try to find by name
    restaurant = restaurantRecommendations.find(r => 
      r.name.toLowerCase().includes(restaurantIdentifier.toLowerCase())
    ) || restaurantRecommendations[0]; // Default to first restaurant if not found

    // Generate a mock booking confirmation
    const confirmationId = `RST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return `Your restaurant reservation is confirmed! Reservation ID: ${confirmationId}\n\n` +
           `${restaurant.name}\n` +
           `${time} for ${partySize} ${partySize === 1 ? 'person' : 'people'}\n` +
           `${restaurant.cuisine} cuisine, ${restaurant.priceRange}`;
  },
  {
    name: "book_restaurant",
    description:
      "Book a restaurant reservation by name or from the itinerary. Returns booking confirmation with reservation ID.",
    schema: z.object({
      restaurantIdentifier: z
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

export const getRestaurantRecommendations = tool(
  ({ destination, preference }) => {
    // Select restaurant based on preference
    let selectedRestaurant;
    if (preference === "fine_dining" || preference === "luxury") {
      selectedRestaurant = restaurantRecommendations[2]; // Olo Ravintola (Michelin)
    } else if (preference === "traditional" || preference === "local") {
      selectedRestaurant = restaurantRecommendations[1]; // Savotta
    } else {
      selectedRestaurant = restaurantRecommendations[0]; // Ravintola Nokka (default)
    }

    return JSON.stringify({
      restaurant: selectedRestaurant,
      allRestaurants: restaurantRecommendations,
    });
  },
  {
    name: "get_restaurant_recommendations",
    description:
      "Get a curated restaurant recommendation for a destination. Use preference 'fine_dining'/'luxury' for upscale, 'traditional'/'local' for authentic local cuisine, or 'moderate' for balanced options.",
    schema: z.object({
      destination: z
        .string()
        .describe("The destination city to get restaurant recommendations for"),
      preference: z
        .enum(["fine_dining", "luxury", "traditional", "local", "moderate"])
        .default("moderate")
        .describe("User's dining preference"),
    }),
  }
);

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

