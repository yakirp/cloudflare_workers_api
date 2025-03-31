# Use a minimal Debian-based Node image
FROM node:20-slim
 
# Install dependencies and Deno
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    unzip \
 && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
 && apt-get clean && rm -rf /var/lib/apt/lists/*
 
# Add Deno to PATH
ENV PATH="/usr/local/bin/deno:${PATH}"
 
# Support build-time secret injection
ARG CLOUDFLARE_API_TOKEN
ARG CF_ACCOUNT_ID
ARG CF_ZONE_ID
 
# Set environment variables (in container runtime)
ENV CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}
ENV CF_ACCOUNT_ID=${CF_ACCOUNT_ID}
ENV CF_ZONE_ID=${CF_ZONE_ID}
 
# Install wrangler globally
RUN npm install -g wrangler
#EXPOSE 8000
# Set working directory
WORKDIR /app
COPY server.ts .

RUN deno cache server.ts --reload
 
# Default command
CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-write", "--allow-run", "--allow-env", "server.ts"]
 