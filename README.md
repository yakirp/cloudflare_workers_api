docker build -t my-deno-app-a --build-arg CLOUDFLARE_API_TOKEN=--build-arg CF_ACCOUNT_ID=--build-arg CF_ZONE_ID= .
docker run -p 8000:8000 --rm my-deno-app-a
