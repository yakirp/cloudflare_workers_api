# Cloudflare Workers API

An API service for creating and managing Cloudflare Workers dynamically.

## Running Locally with Docker

### 1. Build the Docker image

```bash
docker build \
  --build-arg CLOUDFLARE_API_TOKEN=your_cloudflare_api_token \
  --build-arg CF_ACCOUNT_ID=your_cloudflare_account_id \
  --build-arg CF_ZONE_ID=your_cloudflare_zone_id \
  -t cloudflare-workers-api .
```

### 2. Run the container

```bash
docker run -p 8000:8000 cloudflare-workers-api
```

Replace the build argument values with your actual Cloudflare credentials from your [Cloudflare dashboard](https://dash.cloudflare.com/).

The API will be available at `http://localhost:8000`.

## Deployment

1. Copy the example configuration: `cp fly.toml.example fly.toml`
2. Set environment variables in `fly.toml`

3. Deploy to fly.io:

```bash
fly launch
```

## API Usage

### Creating a serverless function

You can create and deploy a serverless function by making a POST request to the API:

```bash
curl --location --request POST 'https://your-app-name.fly.dev/function?name=hello%20world&packages=uuid' \
--header 'Content-Type: application/javascript' \
--data-raw 'import { v4 as uuidv4 } from "uuid";

export default {
  async fetch(request) {
    const id = uuidv4();
    return new Response(`Hello World! Request ID: ${id}`, {
      headers: { "Content-Type": "text/plain" }
    });
  }
};'
```

Parameters:

- `name`: Name for your function
- `packages`: Comma-separated list of npm packages to include

The request body should contain your JavaScript code to be deployed as a Cloudflare Worker.

### Retrieving a function

You can retrieve the code of a deployed function by making a GET request:

```bash
curl --location --request GET 'https://your-app-name.fly.dev/function?name=hello%20world'
```

Parameters:

- `name`: Name of the function to retrieve
