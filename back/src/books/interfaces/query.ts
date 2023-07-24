import {Types} from "mongoose";
import {Book} from "../schemas/book.schema";

export interface SearchQuery {
    name?:string;

    serie?:Types.ObjectId;

    author?:string;

    sort?:string;

    status?:"unread" | "reading" | "readlist" | "completed",
}

export interface UserBook extends Book {
    status:"unread" | "reading" | "readlist" | "completed"
}