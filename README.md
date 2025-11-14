### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd agent-backend
```

2. Create a `.env` file in the project root:
```bash
touch .env
```

3. Add your API keys to `.env`:
```env
GOOGLE_GENAI_API_KEY=your-api-key-here
API_BASE_URL=your-restaurant-api-url
```

### Running the Application

Start the development server with auto-reload:
```bash
deno task dev
```

The server will start on `http://localhost:8000`

## API Endpoints

### `POST /chat/stream`
Stream chat messages with the agent system
