//app/api/langchain-tools/post2wordpress.ts
import { Tool } from "@langchain/core/tools";
import fetch, { HeadersInit, RequestInit } from "node-fetch";

export interface RequestTool {
  headers: HeadersInit;
  maxOutputLength?: number;
  timeout: number;
}

export class Post2WordPressTool extends Tool implements RequestTool {
  name = "post2wordpress";
  lc_serializable = true;
  maxOutputLength = Infinity;
  timeout = 30000;

  constructor(
    public headers: HeadersInit = {},
    options: { maxOutputLength?: number; timeout?: number } = {},
  ) {
    super();

    this.maxOutputLength = options.maxOutputLength ?? this.maxOutputLength;
    this.timeout = options.timeout ?? this.timeout;
  }

  /** @ignore */
  async _call(input: any) {
    console.log(`_call method started with input: ${JSON.stringify(input)}`);

    let parsedInput: { title: string; content: string };
    if (typeof input === "string") {
      try {
        parsedInput = JSON.parse(input);
      } catch (error) {
        console.error("Failed to parse input as JSON.", error);
        return "FAIL: 输入格式不正确，请使用JSON格式。";
      }
    } else {
      parsedInput = input;
    }

    const { content = "", title = "默认标题" } = parsedInput;
    if (!content) {
      console.error("文章内容不能为空。");
      return "FAIL: 文章内容不能为空。";
    }

    try {
      const result = await this.postToWordPress(title, content);
      console.log(`_call method completed with result: ${result}`);
      return result;
    } catch (error) {
      console.error(`_call method encountered an error: ${error}`);
      return `FAIL: ${error}`;
    }
  }

  async postToWordPress(title: string, content: string): Promise<string> {
    console.log(
      `postToWordPress method started with title: ${title}, content: ${content}`,
    );

    const wpApiUrl = process.env.WP_POST_API_URL;
    const wpUser = process.env.WP_USER;
    const wpPassword = process.env.WP_PASSWORD;

    if (!wpApiUrl || !wpUser || !wpPassword) {
      console.error("Missing required environment variables.");
      return "FAIL: 缺少必要的环境变量。";
    }

    const authToken = Buffer.from(`${wpUser}:${wpPassword}`).toString("base64");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Authorization: `Basic ${authToken}`,
    };

    const postData = {
      title: title,
      content: content,
      status: "publish",
    };

    try {
      const resp = await this.fetchWithTimeout(
        wpApiUrl,
        {
          method: "POST",
          headers: headers,
          body: JSON.stringify(postData),
        },
        this.timeout,
      );

      if (!resp.ok) {
        console.error(
          `Unable to post to WordPress. HTTP status: ${resp.status}`,
        );
        return `FAIL: 无法发布到 WordPress。HTTP 状态: ${resp.status}`;
      }

      const responseText = await resp.text();
      return `SUCCESS: 发布成功，响应: ${responseText}`;
    } catch (error) {
      console.error(`postToWordPress method encountered an error: ${error}`);
      return `FAIL: ${error}`;
    }
  }

  async fetchWithTimeout(
    resource: string,
    options: RequestInit,
    timeout: number = 30000,
  ) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(resource, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      console.error(`fetchWithTimeout encountered an error: ${error}`);
      throw error;
    }
  }

  description = `A tool to post articles to a WordPress site. It uses the WordPress REST API to create new posts.
Input must be a JSON string with 'title' and 'content' properties. Such as {"title": "My Post Title", "content": "My Post Content"}，article will be posted to the WordPress site，，article language must be Chinese.`;
}
