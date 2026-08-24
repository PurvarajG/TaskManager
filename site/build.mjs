import { cp, mkdir, rm } from "node:fs/promises";

const root = new URL("./", import.meta.url);
const dist = new URL("./dist/", root);

await rm(dist, { recursive: true, force: true });
await mkdir(new URL("server/", dist), { recursive: true });

await Promise.all(
  ["index.html", "styles.css", "tempo-mark.svg"].map((file) =>
    cp(new URL(file, root), new URL(file, dist)),
  ),
);
await cp(new URL("worker/index.js", root), new URL("server/index.js", dist));
