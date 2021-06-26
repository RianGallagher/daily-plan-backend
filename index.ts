import express from "express";
import { Client } from "@notionhq/client";
import dotenv from "dotenv";
import cors from "cors";
import { CREATED_AT } from "./constants";

dotenv.config();
const app = express();
const port = 3056;

const notion = new Client({ auth: process.env.NOTION_API_KEY });

app.use(cors());
app.use(express.json());

app.get("/", async (_req, res) => {
    const databaseId = process.env.NOTION_DATABASE_ID ?? "";
    try {
        const response = await notion.databases.retrieve({ database_id: databaseId });
        res.send(response);
    } catch (error) {
        res.send(error);
    }
});

app.get("/daily-todos", async (_request, response) => {
    const databaseId = process.env.NOTION_DATABASE_ID ?? "";
    try {
        const { results } = await notion.databases.query({
            database_id: databaseId,
            sorts: [{ property: CREATED_AT, direction: "descending" }],
        });

        const propertiesData = results.map(({ id, properties }) => {
            const property = properties.Day;
            const createdAt = properties["Created at"];

            if (property.type === "title" && createdAt.type === "created_time") {
                const title = property.title.map((item) => item.plain_text).join(" ");
                return { createdAt: new Date(createdAt.created_time), id, title };
            }
        });
        response.json(propertiesData);
    } catch (error) {
        response.send(error);
    }
});

interface Todo {
    readonly checked: boolean;
    readonly id: string;
    readonly text: string;
}
app.get("/daily-todos/:pageId", async (request, response) => {
    const pageId = request.params.pageId;
    try {
        const { results } = await notion.blocks.children.list({ block_id: pageId });
        const todos = results.reduce<Todo[]>((todoArray, block) => {
            if (block.type === "to_do") {
                const { checked, text } = block.to_do;
                block.id;
                const todo = {
                    checked,
                    id: block.id,
                    text: text.map((item) => item.plain_text).join(" "),
                };
                return [...todoArray, todo];
            }
            return todoArray;
        }, []);

        response.json(todos);
    } catch (error) {
        console.error(error);
    }
});

app.post("/daily-todos/:blockId", async (request, response) => {
    const blockId = request.params.blockId;
    const todo = request.body.todo;
    try {
        const thing = await notion.blocks.children.append({
            block_id: blockId,
            children: [
                {
                    object: "block",
                    type: "to_do",
                    to_do: {
                        text: [
                            {
                                annotations: {
                                    bold: false,
                                    italic: false,
                                    strikethrough: false,
                                    underline: false,
                                    code: false,
                                    color: "default",
                                },
                                plain_text: todo,
                                type: "text",
                                text: { content: todo },
                            },
                        ],
                        checked: false,
                        children: [],
                    },
                },
            ] as any, // The types are wrong for the library at the moment.
        });
        response.sendStatus(204);
    } catch (error) {
        console.error(error);
        response.sendStatus(500);
    }
});

app.listen(port, () => {
    return console.log(`server is listening on ${port}`);
});
