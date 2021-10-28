import { db } from "../databases/databases";
import { Logger } from "../utils/logger";
import { Request, Response } from "express";
import { Category, VideoID } from "../types/segments.model";
import { config } from "../config";

const possibleCategoryList = config.categoryList;
interface lockArray {
    category: Category;
    locked: number,
    reason: string,
    userID: string,
    userName: string,
}

export async function getLockReason(req: Request, res: Response): Promise<Response> {
    const videoID = req.query.videoID as VideoID;
    let categories: Category[] = [];
    try {
        categories = req.query.categories
            ? JSON.parse(req.query.categories as string)
            : req.query.category
                ? Array.isArray(req.query.category)
                    ? req.query.category
                    : [req.query.category]
                : []; // default to empty, will be set to all
        if (!Array.isArray(categories)) {
            return res.status(400).send("Categories parameter does not match format requirements.");
        }
    } catch(error) {
        return res.status(400).send("Bad parameter: categories (invalid JSON)");
    }
    // only take valid categories
    const searchCategories = (categories.length === 0 ) ? possibleCategoryList : categories.filter(x => possibleCategoryList.includes(x));

    if (videoID == undefined) {
        //invalid request
        return res.sendStatus(400);
    }

    try {
        // Get existing lock categories markers
        const row = await db.prepare("all", 'SELECT "category", "reason", "userID" from "lockCategories" where "videoID" = ?', [videoID]) as {category: Category, reason: string, userID: string }[];
        // map to object array
        const locks = [];
        const userIDs = new Set();
        // get all locks for video, check if requested later
        for (const lock of row) {
            locks.push({
                category: lock.category,
                locked: 1,
                reason: lock.reason,
                userID: lock?.userID || "",
                userName: "",
            } as lockArray);
            userIDs.add(lock.userID);
        }
        // all userName from userIDs
        const userNames = await db.prepare(
            "all",
            `SELECT "userName", "userID" FROM "userNames" WHERE "userID" IN (${Array.from("?".repeat(userIDs.size)).join()}) LIMIT ?`,
            [...userIDs, userIDs.size]
        ) as { userName: string, userID: string }[];

        const results = [];
        for (const category of searchCategories)  {
            const lock = locks.find(l => l.category === category);
            if (lock?.userID) {
                // mapping userName to locks
                const user = userNames.find(u => u.userID === lock.userID);
                lock.userName = user?.userName || "";
                results.push(lock);
            } else {
                // add empty locks for categories requested but not locked
                results.push({
                    category,
                    locked: 0,
                    reason: "",
                    userID: "",
                    userName: "",
                } as lockArray);
            }
        }

        return res.send(results);
    } catch (err) {
        Logger.error(err as string);
        return res.sendStatus(500);
    }
}
