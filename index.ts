import express from "express";
import { Client } from "@notionhq/client";
import dotenv from "dotenv";
import cors from "cors";
import { CREATED_AT, DAY } from "./constants";
import { Todo } from "./types";

dotenv.config();
const app = express();
const port = process.env.PORT ?? 3056;

app.use(cors());
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_API_KEY });

/**
 * Query the notion database for all the daily todo lists.
 * @returns An array of todo list objects of the form { createdAt: Date, id: string, title: string }.
 */
app.get("/daily-todos", async (_request, response, next) => {
    const databaseId = process.env.NOTION_DATABASE_ID ?? "";
    try {
        const { results: todoLists } = await notion.databases.query({
            database_id: databaseId,
            sorts: [{ property: CREATED_AT, direction: "descending" }],
        });

        const formattedTodoLists = todoLists.map(({ id, properties }) => {
            const day = properties[DAY];
            const createdAt = properties[CREATED_AT];

            if (day.type === "title" && createdAt.type === "created_time") {
                const title = day.title.map((item) => item.plain_text).join(" ");
                return { createdAt: new Date(createdAt.created_time), id, title };
            }
        });
        response.json(formattedTodoLists);
    } catch (error) {
        console.error(error);
        next(error);
    }
});

/**
 * Get all the todos for a particular todo list.
 * @returns An array of todos of the form { checked: boolean, id: string, text: string }.
 */
app.get("/daily-todos/:pageId", async (request, response, next) => {
    const pageId = request.params.pageId;
    try {
        const { results: todos } = await notion.blocks.children.list({ block_id: pageId });
        const formattedTodos = todos.reduce<Todo[]>((todoArray, block) => {
            if (block.type === "to_do") {
                const { checked, text } = block.to_do;
                const todo = {
                    checked,
                    id: block.id,
                    text: text.map((item) => item.plain_text).join(" "),
                };
                return [...todoArray, todo];
            }
            return todoArray;
        }, []);

        response.json(formattedTodos);
    } catch (error) {
        console.error(error);
        next(error);
    }
});

/**
 * Add a new todo to a todo list.
 */
app.post("/daily-todos/:blockId", async (request, response, next) => {
    const blockId = request.params.blockId;
    const todo = request.body.todo;
    try {
        await notion.blocks.children.append({
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
        next(error);
    }
});

app.listen(port, () => {
    return console.log(`server is listening on ${port}`);
});
