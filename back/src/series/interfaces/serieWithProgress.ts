import {Review} from "../../reviews/schemas/review.schema";
import {Serie} from "../schemas/series.schema";

export interface SerieWithProgress extends Serie {
    unreadBooks:number;
    readlist:boolean;
    thumbnailPath:string;
    type?:string;
}

export interface SerieWithReviews extends Serie {
    reviews:Review[]
}