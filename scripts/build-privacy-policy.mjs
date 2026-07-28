import { readFileSync, writeFileSync } from "node:fs";
import { marked } from "marked";

const md = readFileSync("docs/privacy-policy.md", "utf-8");
const body = marked.parse(md);

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Setpeta プライバシーポリシー</title>
<style>
  body {
    max-width: 720px;
    margin: 0 auto;
    padding: 32px 20px 64px;
    font-family: -apple-system, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", sans-serif;
    line-height: 1.8;
    color: #202124;
  }
  h1 { font-size: 22px; }
  h2 { font-size: 16px; margin-top: 32px; }
  code { background: #f0f0f4; padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
</style>
</head>
<body>
${body}</body>
</html>
`;

writeFileSync("docs/privacy-policy.html", html);
