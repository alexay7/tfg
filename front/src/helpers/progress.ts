import {api} from "../api/api";
import {Book, BookProgress} from "../types/book";

export async function createProgress(bookData:Book, page?:number, time?:number, characters?:number, doublePages?:boolean):Promise<void> {
    const paramsString = window.location.search;
    const searchParams = new URLSearchParams(paramsString);

    if (searchParams.has("private")) return;

    let currentPage = page;
    if (currentPage) {
        if (currentPage > bookData.pages || (currentPage === bookData.pages - 1 && doublePages)) {
            currentPage = bookData.pages;
        }
    }

    const newProgress:BookProgress = {
        book:bookData._id,
        time,
        currentPage:currentPage,
        status:"unread",
        characters:characters
    };

    if (currentPage) {
        if (bookData.pages <= currentPage) {
        // Libro terminado
            newProgress.status = "completed";
            newProgress.endDate = new Date();
        } else if (currentPage > 0) {

            // progreso normal
            newProgress.status = "reading";
        }
    }

    if (!page) {
        newProgress.status = "reading";
    }

    await api.post<BookProgress, Book>("readprogress", newProgress);
}