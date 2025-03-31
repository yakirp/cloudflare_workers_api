import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  if (req.method === "POST" && url.pathname === "/function") {
    try {
      const code = await req.text();
      const name = url.searchParams.get("name");
      const custom_domain = url.searchParams.get("custom_domain");

      if (!code || !name) {
        return new Response("Missing 'code' or 'name' in request", {
          status: 400,
        });
      }

      const folderName = `deploy_${crypto.randomUUID().replace(/-/g, "_")}`;
      await Deno.mkdir(folderName, { recursive: true });

      // Write the Worker code
      await Deno.writeTextFile(`${folderName}/index.js`, code);

      // Create wrangler.toml
      const wranglerConfig = `
name = "${name}"
main = "index.js"
compatibility_date = "2024-03-01"
account_id = "${Deno.env.get("CF_ACCOUNT_ID") || "your_account_id"}"
${custom_domain ? `routes = ["${custom_domain}/*"]` : ""}
`;
      await Deno.writeTextFile(`${folderName}/wrangler.toml`, wranglerConfig);

      // Dummy package.json
      await Deno.writeTextFile(
        `${folderName}/package.json`,
        JSON.stringify({ name, version: "1.0.0" })
      );

      // Run wrangler deploy
      const publishProc = Deno.run({
        cmd: ["npx", "wrangler", "deploy"],
        cwd: folderName,
        stdout: "piped",
        stderr: "piped",
      });

      const { code: statusCode } = await publishProc.status();
      const rawOutput = await publishProc.output();
      const rawError = await publishProc.stderrOutput();

      const stdout = new TextDecoder().decode(rawOutput);
      const stderr = new TextDecoder().decode(rawError);

      publishProc.close();

      if (statusCode === 0) {
        if (custom_domain) {
          const zoneId = Deno.env.get("CF_ZONE_ID");
          const accountId = Deno.env.get("CF_ACCOUNT_ID");
          const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN");

          if (!zoneId || !cfToken || !accountId) {
            return new Response(
              "Missing CF_ZONE_ID, CF_ACCOUNT_ID, or CLOUDFLARE_API_TOKEN",
              { status: 500 }
            );
          }

          const domainParts = custom_domain.split(".");
          const subdomain =
            domainParts.length > 2
              ? domainParts.slice(0, domainParts.length - 2).join(".")
              : "@";

          const dnsRes = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${cfToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                type: "CNAME",
                name: subdomain,
                content: `${name}.${accountId}.workers.dev`,
                proxied: true,
              }),
            }
          );

          const dnsJson = await dnsRes.json();

          if (!dnsJson.success) {
            console.error("DNS setup failed:", dnsJson);
            return new Response(
              `Deployment succeeded, but DNS setup failed:\n${JSON.stringify(
                dnsJson.errors,
                null,
                2
              )}`,
              { status: 500 }
            );
          }
        }

        return new Response(`Deployment successful:\n${stdout}`, {
          status: 200,
        });
      } else {
        console.error("Wrangler publish failed:", stderr);
        return new Response(`Deployment failed:\n${stderr}`, { status: 500 });
      }
    } catch (err: any) {
      console.error("Error:", err);
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  } else if (req.method === "GET" && url.pathname === "/function") {
    const name = url.searchParams.get("name");
    if (!name) {
      return new Response("Missing script name", { status: 400 });
    }

    const accountId = Deno.env.get("CF_ACCOUNT_ID");
    const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN");

    if (!accountId || !cfToken) {
      return new Response("Missing CF_ACCOUNT_ID or CLOUDFLARE_API_TOKEN", {
        status: 500,
      });
    }

    try {
      const apiRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${name}`,
        {
          headers: {
            Authorization: `Bearer ${cfToken}`,
            "Content-Type": "application/javascript",
          },
        }
      );

      if (!apiRes.ok) {
        const err = await apiRes.json();
        return new Response(
          `Failed to fetch script: ${JSON.stringify(
            err.errors || err,
            null,
            2
          )}`,
          { status: 500 }
        );
      }

      const raw_script = await apiRes.text();
      let script = "";

      const jsMatch = raw_script.match(
        /Content-Disposition: form-data; name="index\.js"\s+([\s\S]+?)--/
      );

      if (jsMatch && jsMatch[1]) {
        script = jsMatch[1].trim();
        console.log(script);
      } else {
        console.error("Could not extract JavaScript from the response.");
      }

      return new Response(script, {
        status: 200,
        headers: { "Content-Type": "application/javascript" },
      });
    } catch (err: any) {
      console.error("Error fetching script:", err);
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  }
};

console.log("🚀 Server running on http://localhost:8000/");
await serve(handler, { port: 8000 });
